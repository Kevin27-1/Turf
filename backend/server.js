import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { initializeApp, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import Razorpay from 'razorpay';
import { query, getDbEngine, getDbDiagnostics } from './db.js';
import { seedSlots } from './seed.js';
import { authenticateUser } from './auth.js';

dotenv.config();

// Razorpay SDK Setup
// NOTE: For live payments, configure RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET in Vercel dashboard env variables.
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholderKeyId',
  key_secret: process.env.RAZORPAY_KEY_SECRET || 'placeholderKeySecret',
});

const ADVANCE_PAYMENT_PERCENTAGE = 40; // 40% advance payment required online


// Initialize Firebase Admin SDK if not already initialized by db.js
if (getApps().length === 0) {
  initializeApp({
    projectId: process.env.FIREBASE_PROJECT_ID || 'turf-d68e9'
  });
}

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

// Log active database engine on startup
console.log(`Express server is using database engine: ${getDbEngine()}`);

const JWT_SECRET = process.env.JWT_SECRET || 'turf-booking-secret-key-123';
const pendingOtps = new Map(); // phone -> mock otp cache

// POST /api/auth/send-otp (Simulate sending SMS verification code)
app.post('/api/auth/send-otp', (req, res) => {
  const { phone } = req.body;
  if (!phone) {
    return res.status(400).json({ error: 'Phone number is required' });
  }

  // Set mock code (always 123456 for offline testing/development)
  const otp = '123456';
  pendingOtps.set(phone, otp);

  console.log(`[SMS AUTH] OTP Code: ${otp} sent to: ${phone}`);
  
  res.json({ success: true, message: 'OTP sent (use mock code 123456)' });
});

// POST /api/auth/verify-otp (Verify mock verification code)
app.post('/api/auth/verify-otp', async (req, res) => {
  const { phone, otp } = req.body;
  if (!phone || !otp) {
    return res.status(400).json({ error: 'Phone number and verification OTP code are required' });
  }

  const storedOtp = pendingOtps.get(phone);
  if (otp !== storedOtp && otp !== '123456') { // Allow 123456 override
    return res.status(400).json({ error: 'Invalid verification code' });
  }

  pendingOtps.delete(phone); // Consume OTP

  try {
    const userCheck = await query('SELECT id, name, phone, created_at FROM users WHERE phone = $1', [phone]);
    
    if (userCheck.rows.length === 0) {
      // First-time user needs name registration
      return res.json({ success: true, isNewUser: true, phone });
    }

    const user = userCheck.rows[0];
    const token = jwt.sign({ id: user.id, name: user.name, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ success: true, isNewUser: false, user, token });
  } catch (err) {
    console.error('Error verifying OTP:', err);
    res.status(500).json({ error: 'Failed to process OTP verification' });
  }
});

// POST /api/auth/register (Create users and sign token)
app.post('/api/auth/register', async (req, res) => {
  const { phone, name } = req.body;
  if (!phone || !name) {
    return res.status(400).json({ error: 'Phone number and Name are required' });
  }

  try {
    const userCheck = await query('SELECT id FROM users WHERE phone = $1', [phone]);
    if (userCheck.rows.length > 0) {
      return res.status(400).json({ error: 'User with this phone number is already registered' });
    }

    const userId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    
    await query(
      'INSERT INTO users (id, name, phone, created_at) VALUES ($1, $2, $3, $4)',
      [userId, name, phone, createdAt]
    );

    const user = { id: userId, name, phone, created_at: createdAt };
    const token = jwt.sign({ id: userId, name, phone }, JWT_SECRET, { expiresIn: '7d' });

    res.status(201).json({ success: true, user, token });
  } catch (err) {
    console.error('Failed to register user:', err);
    res.status(500).json({ error: 'Failed to complete user registration' });
  }
});

// POST /api/auth/firebase-login (Verify Firebase ID token and return/register local user session)
app.post('/api/auth/firebase-login', async (req, res) => {
  const { token } = req.body;
  if (!token) {
    return res.status(400).json({ error: 'Token is required' });
  }

  try {
    const decodedToken = await getAuth().verifyIdToken(token);
    const phoneWithCode = decodedToken.phone_number; // e.g. "+919876543210"
    if (!phoneWithCode) {
      return res.status(400).json({ error: 'Phone number verification is required in Firebase' });
    }

    // Clean up country code prefix
    const phone = phoneWithCode.replace(/^\+91/, '').replace(/\D/g, '');

    // Check if user already exists in local SQLite db
    const userCheck = await query('SELECT id, name, phone, created_at FROM users WHERE phone = $1', [phone]);

    if (userCheck.rows.length === 0) {
      // First-time user needs name registration, return temporary register flag
      return res.json({ success: true, isNewUser: true, phone });
    }

    const user = userCheck.rows[0];
    const localToken = jwt.sign({ id: user.id, name: user.name, phone: user.phone }, JWT_SECRET, { expiresIn: '7d' });
    
    res.json({ success: true, isNewUser: false, user, token: localToken });
  } catch (err) {
    console.error('Firebase token verification failed:', err);
    res.status(401).json({ error: 'Unauthorized: Invalid Firebase credentials' });
  }
});

// Revert slots that have been held longer than 5 minutes back to available
async function revertExpiredHolds() {
  try {
    const now = new Date().toISOString();
    await query(
      "UPDATE slots SET status = 'available', held_until = NULL, held_by_user_id = NULL WHERE status = 'held' AND held_until < $1",
      [now]
    );
  } catch (err) {
    console.error('[HOLD EXPIRE ERROR] Failed to automatically revert expired slot holds:', err);
  }
}

// Clean up expired holds every minute in the background
setInterval(revertExpiredHolds, 60000);

// GET /api/slots?date=YYYY-MM-DD
app.get('/api/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Date query parameter is required (YYYY-MM-DD)' });
  }

  try {
    // Check and revert any expired holds before showing slots to user
    await revertExpiredHolds();

    const slotsRes = await query(
      'SELECT id, date, start_time, end_time, status, price, held_until, held_by_user_id FROM slots WHERE date = $1 ORDER BY start_time',
      [date]
    );
    res.json(slotsRes.rows);
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ error: 'Database error fetching slots' });
  }
});

// GET /api/config/razorpay-key
app.get('/api/config/razorpay-key', (req, res) => {
  // Returns the public Key ID for the frontend to initialize checkout
  res.json({ keyId: process.env.RAZORPAY_KEY_ID || 'rzp_test_placeholderKeyId' });
});

// GET /api/bookings
app.get('/api/bookings', authenticateUser, async (req, res) => {
  const user_id = req.user.id;
  try {
    const bookingsRes = await query(
      `SELECT b.id, b.slot_id, b.created_at, b.user_id,
              u.name as customer_name, u.phone as customer_phone,
              b.total_amount, b.advance_amount, b.advance_paid_amount, b.balance_amount, b.booking_status,
              s.date, s.start_time, s.end_time, s.price
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN users u ON b.user_id = u.id
       WHERE b.user_id = $1 AND b.booking_status = 'confirmed'
       ORDER BY s.date DESC, s.start_time DESC`,
      [user_id]
    );

    const bookings = bookingsRes.rows.map(row => ({
      id: row.id,
      slot_id: row.slot_id,
      customer_name: row.customer_name,
      customer_phone: row.customer_phone,
      created_at: row.created_at,
      user_id: row.user_id,
      total_amount: row.total_amount,
      advance_amount: row.advance_amount,
      advance_paid_amount: row.advance_paid_amount,
      balance_amount: row.balance_amount,
      booking_status: row.booking_status,
      slot: {
        date: row.date,
        start_time: row.start_time,
        end_time: row.end_time,
        price: row.price
      }
    }));

    res.json(bookings);
  } catch (err) {
    console.error('Error fetching user bookings:', err);
    res.status(500).json({ error: 'Database error fetching bookings' });
  }
});

// POST /api/bookings/hold (Atomically hold a slot and create a Razorpay order)
app.post('/api/bookings/hold', authenticateUser, async (req, res) => {
  const { slot_id } = req.body;
  const user_id = req.user.id;

  if (!slot_id) {
    return res.status(400).json({ error: 'slot_id is required' });
  }

  try {
    // 1. Revert any expired holds before trying to acquire ours
    await revertExpiredHolds();

    const heldUntil = new Date(Date.now() + 5 * 60 * 1000).toISOString(); // 5 minutes hold
    const now = new Date().toISOString();

    // 2. Try to hold the slot atomically (covers race conditions)
    const holdResult = await query(
      "UPDATE slots SET status = 'held', held_until = $1, held_by_user_id = $2 WHERE id = $3 AND (status = 'available' OR (status = 'held' AND held_until < $4))",
      [heldUntil, user_id, slot_id, now]
    );

    if (holdResult.rowCount === 0) {
      return res.status(400).json({ error: 'This slot is already booked or held by another player.' });
    }

    // 3. Fetch slot price to calculate advance payment details
    const slotRes = await query('SELECT price, date, start_time FROM slots WHERE id = $1', [slot_id]);
    if (slotRes.rows.length === 0) {
      // Revert hold if slot was not found (should not happen)
      await query("UPDATE slots SET status = 'available', held_until = NULL, held_by_user_id = NULL WHERE id = $1", [slot_id]);
      return res.status(404).json({ error: 'Slot not found' });
    }

    const slot = slotRes.rows[0];
    const totalPrice = slot.price;
    const advanceAmount = Math.round((totalPrice * ADVANCE_PAYMENT_PERCENTAGE) / 100);
    const balanceAmount = totalPrice - advanceAmount;

    // 4. Create Razorpay order (amount in paise, e.g. ₹400 = 40000 paise)
    const options = {
      amount: advanceAmount * 100,
      currency: 'INR',
      receipt: `rcpt_${slot_id.substring(0, 8)}_${Date.now().toString().slice(-6)}`
    };

    let order;
    try {
      order = await razorpay.orders.create(options);
    } catch (rzpErr) {
      console.error('[RAZORPAY ERROR] Failed to create order:', rzpErr);
      // Revert hold
      await query("UPDATE slots SET status = 'available', held_until = NULL, held_by_user_id = NULL WHERE id = $1", [slot_id]);
      return res.status(500).json({ error: 'Failed to initialize payment gateway' });
    }

    // 5. Insert pending booking record
    const bookingId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await query(
      `INSERT INTO bookings (
        id, slot_id, user_id, created_at, 
        total_amount, advance_amount, advance_paid_amount, balance_amount, 
        razorpay_order_id, payment_verified, booking_status
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)`,
      [
        bookingId,
        slot_id,
        user_id,
        createdAt,
        totalPrice,
        advanceAmount,
        0, // Not paid yet
        totalPrice, // Remaining balance starts as total_amount
        order.id,
        false, // payment_verified
        'pending' // booking_status
      ]
    );

    res.status(200).json({
      success: true,
      order_id: order.id,
      booking_id: bookingId,
      total_amount: totalPrice,
      advance_amount: advanceAmount,
      balance_amount: balanceAmount,
      held_until: heldUntil
    });

  } catch (err) {
    console.error('Error holding slot:', err);
    res.status(500).json({ error: 'Failed to initiate hold and payment flow' });
  }
});

// POST /api/bookings/verify (Verify Razorpay signature and confirm the booking)
app.post('/api/bookings/verify', authenticateUser, async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;
  const user_id = req.user.id;

  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
    return res.status(400).json({ error: 'Missing payment signature verification parameters' });
  }

  try {
    // 1. Verify Razorpay cryptographic signature (HMAC SHA-256)
    // Note: uses process.env.RAZORPAY_KEY_SECRET from Vercel
    const secret = process.env.RAZORPAY_KEY_SECRET || 'placeholderKeySecret';
    const shasum = crypto.createHmac('sha256', secret);
    shasum.update(`${razorpay_order_id}|${razorpay_payment_id}`);
    const digest = shasum.digest('hex');

    if (digest !== razorpay_signature) {
      return res.status(400).json({ error: 'Signature verification failed. Payment was not authentic.' });
    }

    // 2. Fetch the corresponding pending booking
    const bookingCheck = await query(
      `SELECT b.id, b.slot_id, b.user_id, b.total_amount, b.advance_amount 
       FROM bookings b 
       WHERE b.razorpay_order_id = $1`,
      [razorpay_order_id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Associated pending booking was not found.' });
    }

    const booking = bookingCheck.rows[0];

    // Ensure users cannot verify bookings they do not own
    if (booking.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden: You cannot confirm a booking for another user.' });
    }

    // 3. Update database status in a transaction
    await query('BEGIN');

    const advancePaid = booking.advance_amount;
    const balance = booking.total_amount - advancePaid;

    // Confirm booking and payment details
    await query(
      `UPDATE bookings 
       SET payment_verified = $1, advance_paid_amount = $2, balance_amount = $3, booking_status = $4, razorpay_payment_id = $5 
       WHERE razorpay_order_id = $6`,
      [true, advancePaid, balance, 'confirmed', razorpay_payment_id, razorpay_order_id]
    );

    // Confirm slot status is permanently booked
    await query(
      "UPDATE slots SET status = 'booked', held_until = NULL, held_by_user_id = NULL WHERE id = $1",
      [booking.slot_id]
    );

    await query('COMMIT');

    // 4. Fetch fully detailed confirmed booking record
    const updatedBookingRes = await query(
      `SELECT b.id, b.slot_id, b.created_at, b.user_id,
              u.name as customer_name, u.phone as customer_phone,
              b.total_amount, b.advance_amount, b.advance_paid_amount, b.balance_amount, b.booking_status,
              s.date, s.start_time, s.end_time, s.price
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN users u ON b.user_id = u.id
       WHERE b.id = $1`,
      [booking.id]
    );

    const updatedBooking = updatedBookingRes.rows[0];
    const formattedBooking = {
      id: updatedBooking.id,
      slot_id: updatedBooking.slot_id,
      customer_name: updatedBooking.customer_name,
      customer_phone: updatedBooking.customer_phone,
      created_at: updatedBooking.created_at,
      user_id: updatedBooking.user_id,
      total_amount: updatedBooking.total_amount,
      advance_amount: updatedBooking.advance_amount,
      advance_paid_amount: updatedBooking.advance_paid_amount,
      balance_amount: updatedBooking.balance_amount,
      booking_status: updatedBooking.booking_status,
      slot: {
        date: updatedBooking.date,
        start_time: updatedBooking.start_time,
        end_time: updatedBooking.end_time,
        price: updatedBooking.price
      }
    };

    res.status(200).json({
      success: true,
      message: 'Payment verified and booking confirmed',
      booking: formattedBooking
    });

  } catch (err) {
    try {
      await query('ROLLBACK');
    } catch (rbErr) {}
    console.error('Error verifying payment:', err);
    res.status(500).json({ error: 'Failed to verify payment and complete booking process' });
  }
});

// DELETE /api/bookings/:id
app.delete('/api/bookings/:id', authenticateUser, async (req, res) => {
  const { id } = req.params;
  const user_id = req.user.id;

  try {
    // 1. Get the booking to find the slot and user credentials
    const bookingCheck = await query(
      'SELECT slot_id, user_id FROM bookings WHERE id = $1',
      [id]
    );

    if (bookingCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Booking not found' });
    }

    const booking = bookingCheck.rows[0];

    // Ensure user owns the booking
    if (booking.user_id && booking.user_id !== user_id) {
      return res.status(403).json({ error: 'Forbidden: You cannot cancel another user\'s booking' });
    }

    const { slot_id } = booking;

    // 2. Get the slot to verify start time
    const slotCheck = await query(
      'SELECT date, start_time FROM slots WHERE id = $1',
      [slot_id]
    );

    if (slotCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Associated slot not found' });
    }

    const slot = slotCheck.rows[0];

    // Parse date and time to construct slot Date object
    const [year, month, day] = slot.date.split('-').map(Number);
    const [hour, minute] = slot.start_time.split(':').map(Number);
    const slotStartTime = new Date(year, month - 1, day, hour, minute, 0, 0);

    const timeDiffMs = slotStartTime.getTime() - Date.now();
    const timeDiffHours = timeDiffMs / (1000 * 60 * 60);

    if (timeDiffHours < 4) {
      return res.status(400).json({ 
        error: 'Bookings can only be canceled at least 4 hours before the slot start time.' 
      });
    }

    // 3. Perform cancellation in a transaction
    await query('BEGIN');

    // Update slot status back to available
    await query('UPDATE slots SET status = $1 WHERE id = $2', ['available', slot_id]);

    // Delete booking record
    await query('DELETE FROM bookings WHERE id = $1', [id]);

    await query('COMMIT');

    res.json({ success: true, message: 'Booking canceled successfully' });

  } catch (err) {
    try {
      await query('ROLLBACK');
    } catch (rbErr) {
      console.error('Error rolling back cancellation:', rbErr);
    }
    console.error('Error canceling booking:', err);
    res.status(500).json({ error: 'Failed to process booking cancellation' });
  }
});

// POST /api/seed
app.post('/api/seed', async (req, res) => {
  try {
    const seededCount = await seedSlots();
    res.json({ success: true, message: `Seeded ${seededCount} slots.` });
  } catch (err) {
    console.error('Error seeding slots:', err);
    res.status(500).json({ error: 'Seeding failed' });
  }
});

// Root check endpoint
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', db: getDbEngine(), diagnostics: getDbDiagnostics() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

export default app;
