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

async function getAdminSettings() {
  try {
    const res = await query('SELECT * FROM admin_settings LIMIT 1');
    if (res.rows && res.rows.length > 0) {
      return res.rows[0];
    }
  } catch (err) {
    console.error('Failed to load admin settings from DB, using fallback defaults:', err.message);
  }
  return {
    turf_name: 'Golden Arm Turf',
    operating_hours_start: '06:00',
    operating_hours_end: '23:00',
    slot_duration_minutes: 60,
    price_per_slot: 1200,
    advance_payment_percentage: 40,
    cancellation_window_hours: 4,
    sport_types_offered: 'Football, Cricket'
  };
}


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
              b.cancellation_deadline, b.cancelled_at, b.refund_amount, b.refund_status,
              s.date, s.start_time, s.end_time, s.price
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN users u ON b.user_id = u.id
       WHERE b.user_id = $1 AND b.booking_status != 'pending'
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
      cancellation_deadline: row.cancellation_deadline,
      cancelled_at: row.cancelled_at,
      refund_amount: row.refund_amount,
      refund_status: row.refund_status,
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

// GET /api/reviews (Fetch Google Place Details reviews or use mock testimonials)
app.get('/api/reviews', async (req, res) => {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  const placeId = process.env.GOOGLE_PLACE_ID;
  
  if (apiKey && placeId) {
    try {
      const response = await fetch(`https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=reviews,rating,user_ratings_total&key=${apiKey}`);
      const data = await response.json();
      if (data.status === 'OK' && data.result) {
        return res.json({
          rating: data.result.rating || 5,
          total_ratings: data.result.user_ratings_total || 1,
          reviews: (data.result.reviews || []).map(r => ({
            author_name: r.author_name,
            profile_photo_url: r.profile_photo_url,
            rating: r.rating,
            relative_time_description: r.relative_time_description,
            text: r.text
          }))
        });
      }
    } catch (err) {
      console.error('Error fetching Google Places reviews:', err.message);
    }
  }

  // Fallback / default reviews for Golden Arm Turf Alakode
  return res.json({
    rating: 4.9,
    total_ratings: 84,
    reviews: [
      {
        author_name: "Abhinav Ramesh",
        profile_photo_url: null,
        rating: 5,
        relative_time_description: "2 days ago",
        text: "The best football turf in the Alakode/Karuvanchal region! Premium artificial grass, perfect cushioning, and high-mast lights make night matches amazing. Very easy to book slots."
      },
      {
        author_name: "Saurav K.",
        profile_photo_url: null,
        rating: 5,
        relative_time_description: "1 week ago",
        text: "Outstanding facilities and clean changing rooms. Played cricket here last weekend, the bounce is very consistent. Highly recommended!"
      },
      {
        author_name: "Jithin Mathew",
        profile_photo_url: null,
        rating: 5,
        relative_time_description: "2 weeks ago",
        text: "Great turf court with excellent stadium lights. Easy location to find near Karuvanchal, plenty of parking space. Online advance payment system works flawlessly."
      },
      {
        author_name: "Rahul Nambiar",
        profile_photo_url: null,
        rating: 4,
        relative_time_description: "3 weeks ago",
        text: "FIFA-quality grass that is soft on the knees. Playing 5-a-side matches under the floodlights here is pure bliss. Will definitely book again!"
      },
      {
        author_name: "Midhun Lal",
        profile_photo_url: null,
        rating: 5,
        relative_time_description: "1 month ago",
        text: "Very well maintained turf and reasonable rates. Friendly management and smooth booking system. Free drinking water and clean amenities are a huge plus."
      }
    ]
  });
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
    const settings = await getAdminSettings();
    const advPct = settings.advance_payment_percentage || 40;
    const advanceAmount = Math.round((totalPrice * advPct) / 100);
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
      advance_pct: advPct,
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

    // 2. Fetch the corresponding pending booking (joining slots to calculate deadline)
    const bookingCheck = await query(
      `SELECT b.id, b.slot_id, b.user_id, b.total_amount, b.advance_amount,
              s.date, s.start_time
       FROM bookings b 
       JOIN slots s ON b.slot_id = s.id
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

    // No cancellation deadline (cancellations and refunds disabled)
    const cancellationDeadline = null;

    // 3. Update database status in a transaction
    await query('BEGIN');

    const advancePaid = booking.advance_amount;
    const balance = booking.total_amount - advancePaid;

    // Confirm booking, payment details, and cancellation deadline
    await query(
      `UPDATE bookings 
       SET payment_verified = $1, advance_paid_amount = $2, balance_amount = $3, booking_status = $4, razorpay_payment_id = $5, cancellation_deadline = $6 
       WHERE razorpay_order_id = $7`,
      [true, advancePaid, balance, 'confirmed', razorpay_payment_id, cancellationDeadline, razorpay_order_id]
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
              b.cancellation_deadline, b.cancelled_at, b.refund_amount, b.refund_status,
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
      cancellation_deadline: updatedBooking.cancellation_deadline,
      cancelled_at: updatedBooking.cancelled_at,
      refund_amount: updatedBooking.refund_amount,
      refund_status: updatedBooking.refund_status,
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



// JWT Admin Authentication Middleware
const authenticateAdmin = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: Missing admin token' });
  }
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    if (decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Forbidden: Admin access required' });
    }
    req.admin = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Unauthorized: Invalid admin token' });
  }
};

// POST /api/admin/login
app.post('/api/admin/login', (req, res) => {
  const { email, password } = req.body;
  const adminEmail = process.env.ADMIN_EMAIL || 'admin@goldenarm.com';
  const adminPassword = process.env.ADMIN_PASSWORD || 'admin123';

  if (email === adminEmail && password === adminPassword) {
    const token = jwt.sign({ email, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json({ token });
  } else {
    return res.status(401).json({ error: 'Invalid admin credentials' });
  }
});

// GET /api/admin/settings
app.get('/api/admin/settings', authenticateAdmin, async (req, res) => {
  try {
    const settings = await getAdminSettings();
    res.json(settings);
  } catch (err) {
    console.error('Failed to get settings:', err);
    res.status(500).json({ error: 'Failed to retrieve admin settings' });
  }
});

// PUT /api/admin/settings
app.put('/api/admin/settings', authenticateAdmin, async (req, res) => {
  const {
    turf_name,
    operating_hours_start,
    operating_hours_end,
    slot_duration_minutes,
    price_per_slot,
    advance_payment_percentage,
    cancellation_window_hours,
    sport_types_offered
  } = req.body;

  try {
    await query(
      `UPDATE admin_settings 
       SET turf_name = $1, operating_hours_start = $2, operating_hours_end = $3, 
           slot_duration_minutes = $4, price_per_slot = $5, advance_payment_percentage = $6, 
           cancellation_window_hours = $7, sport_types_offered = $8 
       WHERE id = 1`,
      [
        turf_name,
        operating_hours_start,
        operating_hours_end,
        parseInt(slot_duration_minutes, 10),
        parseFloat(price_per_slot),
        parseInt(advance_payment_percentage, 10),
        parseInt(cancellation_window_hours || 4, 10),
        sport_types_offered
      ]
    );
    res.json({ success: true, message: 'Admin settings updated successfully' });
  } catch (err) {
    console.error('Failed to update settings:', err);
    res.status(500).json({ error: 'Failed to update settings' });
  }
});

// GET /api/admin/bookings
app.get('/api/admin/bookings', authenticateAdmin, async (req, res) => {
  const { date, balance_payment_status, booking_status } = req.query;

  try {
    let sql = '';
    let params = [];

    if (date) {
      // Today's Bookings
      sql = `
        SELECT b.id, b.slot_id, b.created_at, b.user_id,
               u.name as customer_name, u.phone as customer_phone,
               b.total_amount, b.advance_amount, b.advance_paid_amount, b.balance_amount, b.booking_status,
               b.cancellation_deadline, b.balance_payment_status,
               s.date, s.start_time, s.end_time, s.price
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        JOIN users u ON b.user_id = u.id
        WHERE s.date = $1
        ORDER BY s.start_time ASC
      `;
      params = [date];
    } else if (balance_payment_status && booking_status) {
      // Pending Balances
      sql = `
        SELECT b.id, b.slot_id, b.created_at, b.user_id,
               u.name as customer_name, u.phone as customer_phone,
               b.total_amount, b.advance_amount, b.advance_paid_amount, b.balance_amount, b.booking_status,
               b.cancellation_deadline, b.balance_payment_status,
               s.date, s.start_time, s.end_time, s.price
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        JOIN users u ON b.user_id = u.id
        WHERE b.balance_payment_status = $1 AND b.booking_status = $2
        ORDER BY s.date ASC, s.start_time ASC
      `;
      params = [balance_payment_status, booking_status];
    } else if (booking_status === 'cancelled') {
      // Cancellations Log
      sql = `
        SELECT b.id, b.slot_id, b.created_at, b.user_id,
               u.name as customer_name, u.phone as customer_phone,
               b.total_amount, b.advance_amount, b.advance_paid_amount, b.balance_amount, b.booking_status,
               b.cancellation_deadline, b.cancelled_at, b.refund_amount, b.refund_status,
               s.date, s.start_time, s.end_time, s.price
        FROM bookings b
        JOIN slots s ON b.slot_id = s.id
        JOIN users u ON b.user_id = u.id
        WHERE b.booking_status = $1
        ORDER BY b.cancelled_at DESC
      `;
      params = [booking_status];
    } else {
      return res.status(400).json({ error: 'Missing filter parameters' });
    }

    const bookingsRes = await query(sql, params);
    res.json(bookingsRes.rows);
  } catch (err) {
    console.error('Failed to get admin bookings:', err);
    res.status(500).json({ error: 'Failed to retrieve bookings list' });
  }
});

// POST /api/admin/bookings/:id/pay-balance
app.post('/api/admin/bookings/:id/pay-balance', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await query(
      "UPDATE bookings SET balance_payment_status = $1 WHERE id = $2",
      ['paid_at_venue', id]
    );
    res.json({ success: true, message: 'Balance marked as paid at venue' });
  } catch (err) {
    console.error('Failed to update balance payment:', err);
    res.status(500).json({ error: 'Failed to update balance payment' });
  }
});

// POST /api/admin/bookings/:id/complete
app.post('/api/admin/bookings/:id/complete', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await query(
      "UPDATE bookings SET booking_status = $1 WHERE id = $2",
      ['completed', id]
    );
    res.json({ success: true, message: 'Booking marked as completed' });
  } catch (err) {
    console.error('Failed to update booking status:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// POST /api/admin/bookings/:id/no-show
app.post('/api/admin/bookings/:id/no-show', authenticateAdmin, async (req, res) => {
  const { id } = req.params;
  try {
    await query(
      "UPDATE bookings SET booking_status = $1 WHERE id = $2",
      ['no_show', id]
    );
    res.json({ success: true, message: 'Booking marked as no-show' });
  } catch (err) {
    console.error('Failed to update booking status:', err);
    res.status(500).json({ error: 'Failed to update booking status' });
  }
});

// POST /api/admin/slots/block
app.post('/api/admin/slots/block', authenticateAdmin, async (req, res) => {
  const { slot_ids } = req.body;
  if (!slot_ids || !Array.isArray(slot_ids)) {
    return res.status(400).json({ error: 'Invalid slot_ids' });
  }

  try {
    await query('BEGIN');
    for (const slotId of slot_ids) {
      await query("UPDATE slots SET status = $1 WHERE id = $2", ['blocked', slotId]);
    }
    await query('COMMIT');
    res.json({ success: true, message: 'Slots blocked successfully' });
  } catch (err) {
    try { await query('ROLLBACK'); } catch (rb) {}
    console.error('Failed to block slots:', err);
    res.status(500).json({ error: 'Failed to block slots' });
  }
});

// POST /api/admin/slots/unblock
app.post('/api/admin/slots/unblock', authenticateAdmin, async (req, res) => {
  const { slot_ids } = req.body;
  if (!slot_ids || !Array.isArray(slot_ids)) {
    return res.status(400).json({ error: 'Invalid slot_ids' });
  }

  try {
    await query('BEGIN');
    for (const slotId of slot_ids) {
      await query("UPDATE slots SET status = $1 WHERE id = $2", ['available', slotId]);
    }
    await query('COMMIT');
    res.json({ success: true, message: 'Slots unblocked successfully' });
  } catch (err) {
    try { await query('ROLLBACK'); } catch (rb) {}
    console.error('Failed to unblock slots:', err);
    res.status(500).json({ error: 'Failed to unblock slots' });
  }
});

// GET /api/admin/stats
app.get('/api/admin/stats', authenticateAdmin, async (req, res) => {
  try {
    // Fetch all bookings that are confirmed or completed (non-pending)
    const bookingsRes = await query(`
      SELECT b.total_amount, b.advance_paid_amount, b.balance_amount, b.booking_status, b.balance_payment_status, s.date
      FROM bookings b
      JOIN slots s ON b.slot_id = s.id
      WHERE b.booking_status != 'pending'
    `);
    const bookings = bookingsRes.rows;

    const today = new Date();
    
    // Calculate week start (Monday) and end (Sunday) in local time
    const currentDay = today.getDay();
    const distanceToMonday = currentDay === 0 ? -6 : 1 - currentDay;
    const monday = new Date(today);
    monday.setDate(today.getDate() + distanceToMonday);
    monday.setHours(0, 0, 0, 0);

    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);
    sunday.setHours(23, 59, 59, 999);

    // Calculate month boundaries for current and previous month
    const startOfCurrentMonth = new Date(today.getFullYear(), today.getMonth(), 1, 0, 0, 0, 0);
    const endOfCurrentMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0, 23, 59, 59, 999);

    const startOfLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1, 0, 0, 0, 0);
    const endOfLastMonth = new Date(today.getFullYear(), today.getMonth(), 0, 23, 59, 59, 999);

    let bookingsThisWeek = 0;
    let revenueThisWeek = 0;
    let bookingsThisMonth = 0;
    let revenueThisMonth = 0;
    let revenueLastMonth = 0;

    // Daily breakdown for the last 30 days
    const dailyEarningsMap = {};
    for (let i = 29; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const y = d.getFullYear();
      const m = String(d.getMonth() + 1).padStart(2, '0');
      const dayStr = String(d.getDate()).padStart(2, '0');
      const dateKey = `${y}-${m}-${dayStr}`;
      dailyEarningsMap[dateKey] = 0;
    }

    bookings.forEach(b => {
      if (!b.date) return;
      const [year, month, day] = b.date.split('-').map(Number);
      const slotDate = new Date(year, month - 1, day, 12, 0, 0, 0); // midday comparison

      const isConfirmedOrCompleted = b.booking_status === 'confirmed' || b.booking_status === 'completed';
      if (!isConfirmedOrCompleted) return;

      const balancePaid = b.balance_payment_status === 'paid_at_venue' ? (b.balance_amount || 0) : 0;
      const totalSlotRevenue = (b.advance_paid_amount || 0) + balancePaid;

      if (slotDate >= monday && slotDate <= sunday) {
        bookingsThisWeek++;
        revenueThisWeek += totalSlotRevenue;
      }

      if (slotDate >= startOfCurrentMonth && slotDate <= endOfCurrentMonth) {
        bookingsThisMonth++;
        revenueThisMonth += totalSlotRevenue;
      }

      if (slotDate >= startOfLastMonth && slotDate <= endOfLastMonth) {
        revenueLastMonth += totalSlotRevenue;
      }

      if (dailyEarningsMap[b.date] !== undefined) {
        dailyEarningsMap[b.date] += totalSlotRevenue;
      }
    });

    const monthlyDailyEarnings = Object.keys(dailyEarningsMap).map(dateStr => {
      const d = new Date(dateStr);
      return {
        date: dateStr,
        label: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        amount: dailyEarningsMap[dateStr]
      };
    });

    // Month over month percentage growth comparison
    let monthOverMonthChangePct = 0;
    if (revenueLastMonth > 0) {
      monthOverMonthChangePct = Math.round(((revenueThisMonth - revenueLastMonth) / revenueLastMonth) * 100);
    } else if (revenueThisMonth > 0) {
      monthOverMonthChangePct = 100;
    }

    res.json({
      bookingsThisWeek,
      revenueThisWeek,
      bookingsThisMonth,
      revenueThisMonth,
      revenueLastMonth,
      monthOverMonthChangePct,
      monthlyDailyEarnings
    });
  } catch (err) {
    console.error('Failed to get stats:', err);
    res.status(500).json({ error: 'Failed to retrieve stats' });
  }
});

// GET /api/settings/public
app.get('/api/settings/public', async (req, res) => {
  try {
    const settings = await getAdminSettings();
    res.json({
      turf_name: settings.turf_name,
      sport_types_offered: settings.sport_types_offered ? settings.sport_types_offered.split(',').map(s => s.trim()) : []
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to retrieve public settings' });
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
