import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import crypto from 'crypto';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';
import { getAuth } from 'firebase-admin/auth';
import { query, getDbEngine } from './db.js';
import { seedSlots } from './seed.js';
import { authenticateUser } from './auth.js';

dotenv.config();

// Initialize Firebase Admin SDK
admin.initializeApp({
  projectId: process.env.FIREBASE_PROJECT_ID || 'turf-d68e9'
});

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

// GET /api/slots?date=YYYY-MM-DD
app.get('/api/slots', async (req, res) => {
  const { date } = req.query;
  if (!date) {
    return res.status(400).json({ error: 'Date query parameter is required (YYYY-MM-DD)' });
  }

  try {
    const slotsRes = await query(
      'SELECT id, date, start_time, end_time, status, price FROM slots WHERE date = $1 ORDER BY start_time',
      [date]
    );
    res.json(slotsRes.rows);
  } catch (err) {
    console.error('Error fetching slots:', err);
    res.status(500).json({ error: 'Database error fetching slots' });
  }
});

// GET /api/bookings
app.get('/api/bookings', authenticateUser, async (req, res) => {
  const user_id = req.user.id;
  try {
    const bookingsRes = await query(
      `SELECT b.id, b.slot_id, b.created_at, b.user_id,
              u.name as customer_name, u.phone as customer_phone,
              s.date, s.start_time, s.end_time, s.price
       FROM bookings b
       JOIN slots s ON b.slot_id = s.id
       JOIN users u ON b.user_id = u.id
       WHERE b.user_id = $1
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

// POST /api/bookings
app.post('/api/bookings', authenticateUser, async (req, res) => {
  const { slot_id } = req.body;
  const user_id = req.user.id;

  if (!slot_id) {
    return res.status(400).json({ error: 'slot_id is required' });
  }

  try {
    // Start transaction
    await query('BEGIN');

    // Check if the slot exists and is available
    const slotCheck = await query(
      'SELECT status, date, start_time, end_time, price FROM slots WHERE id = $1',
      [slot_id]
    );

    if (slotCheck.rows.length === 0) {
      await query('ROLLBACK');
      return res.status(404).json({ error: 'Slot not found' });
    }

    const slot = slotCheck.rows[0];
    if (slot.status !== 'available') {
      await query('ROLLBACK');
      return res.status(400).json({ error: 'This slot is already booked' });
    }

    // Insert booking record
    const bookingId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    await query(
      'INSERT INTO bookings (id, slot_id, user_id, created_at) VALUES ($1, $2, $3, $4)',
      [bookingId, slot_id, user_id, createdAt]
    );

    // Update slot status to booked
    await query(
      'UPDATE slots SET status = $1 WHERE id = $2',
      ['booked', slot_id]
    );

    // Commit transaction
    await query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Booking confirmed',
      booking: {
        id: bookingId,
        slot_id,
        user_id,
        customer_name: req.user.name,
        customer_phone: req.user.phone,
        created_at: createdAt,
        slot: {
          date: slot.date,
          start_time: slot.start_time,
          end_time: slot.end_time,
          price: slot.price
        }
      }
    });

  } catch (err) {
    // Rollback transaction in case of failure
    try {
      await query('ROLLBACK');
    } catch (rollbackErr) {
      console.error('Error rolling back transaction:', rollbackErr);
    }
    console.error('Error creating booking:', err);
    res.status(500).json({ error: 'Failed to complete booking process' });
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
  res.json({ status: 'ok', db: getDbEngine() });
});

app.listen(PORT, () => {
  console.log(`Backend server running on port ${PORT}`);
});

export default app;
