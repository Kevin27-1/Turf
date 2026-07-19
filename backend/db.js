import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isFirestore = false;
let isPostgres = false;
let pgPool = null;
let sqliteDb = null;
let firestoreDb = null;
let dbInitError = null;
const isSaJsonDefined = !!process.env.FIREBASE_SERVICE_ACCOUNT_JSON;

// Determine if we should use Firestore (Service Account JSON)
const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
if (serviceAccountJson) {
  try {
    const serviceAccount = JSON.parse(serviceAccountJson);
    if (getApps().length === 0) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    firestoreDb = getFirestore();
    isFirestore = true;
    console.log('Database client: Configured for Firebase Cloud Firestore.');
    await initializeFirestoreSettings();
  } catch (err) {
    dbInitError = err.message;
    console.error('Failed to initialize Firebase Admin SDK for Firestore:', err.message);
  }
}

// Helper to seed default settings in Firestore
async function initializeFirestoreSettings() {
  try {
    const docRef = firestoreDb.collection('admin_settings').doc('settings');
    const doc = await docRef.get();
    if (!doc.exists) {
      console.log('Initializing default admin settings in Firestore...');
      await docRef.set({
        turf_name: 'Golden Arm Turf',
        operating_hours_start: '06:00',
        operating_hours_end: '23:00',
        slot_duration_minutes: 60,
        price_per_slot: 1200,
        advance_payment_percentage: 40,
        cancellation_window_hours: 4,
        sport_types_offered: 'Football, Cricket'
      });
    }
  } catch (err) {
    console.error('Failed to initialize Firestore admin settings:', err.message);
  }
}

// Determine if we should use PostgreSQL (check common Vercel/environment keys) if not using Firestore
const databaseUrl = !isFirestore && (process.env.DATABASE_URL || 
                    process.env.POSTGRES_URL || 
                    process.env.STORAGE_URL || 
                    process.env.POSTGRES_PRISMA_URL);

if (databaseUrl) {
  try {
    pgPool = new pg.Pool({
      connectionString: databaseUrl,
      // Add SSL config if required (common on neon/render/heroku)
      ssl: databaseUrl.includes('localhost') ? false : { rejectUnauthorized: false }
    });
    isPostgres = true;
    console.log('Database client: Configured for PostgreSQL.');
    await checkAndMigratePostgres();
  } catch (err) {
    console.error('Failed to initialize PostgreSQL pool, falling back to SQLite:', err.message);
  }
} else if (!isFirestore) {
  console.log('DATABASE_URL not set. Database client: Configured for SQLite fallback.');
}

// Initialise SQLite if not using PostgreSQL or Firestore
if (!isPostgres && !isFirestore) {
  try {
    const sqlite3Module = await import('sqlite3');
    const sqlite3 = sqlite3Module.default;
    
    // Use /tmp directory on Vercel since the project directory is read-only
    const dbPath = process.env.VERCEL 
      ? '/tmp/turf.db' 
      : path.join(__dirname, 'turf.db');
      
    sqliteDb = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Could not open SQLite database:', err.message);
      } else {
        console.log(`SQLite database opened at: ${dbPath}`);
        // Perform database migration check first
        sqliteDb.all("PRAGMA table_info(bookings)", [], (err, columns) => {
          if (!err && columns && columns.length > 0) {
            const hasBalancePaymentStatus = columns.some(col => col.name === 'balance_payment_status');
            if (!hasBalancePaymentStatus) {
              console.log("Old bookings table schema detected (missing balance_payment_status). Dropping tables for schema migration...");
              sqliteDb.serialize(() => {
                sqliteDb.run("DROP TABLE IF EXISTS bookings", (dropErr) => {
                  if (dropErr) console.error("Failed to drop bookings table:", dropErr.message);
                  sqliteDb.run("DROP TABLE IF EXISTS slots", (dropErr2) => {
                    if (dropErr2) console.error("Failed to drop slots table:", dropErr2.message);
                    sqliteDb.run("DROP TABLE IF EXISTS admin_settings", (dropErr3) => {
                      initializeSqliteTables();
                    });
                  });
                });
              });
              return;
            }
          }
          initializeSqliteTables();
        });
      }
    });
  } catch (err) {
    console.error("Failed to load SQLite module. SQLite fallback is disabled:", err.message);
    console.error("Please ensure the DATABASE_URL environment variable is set to connect to PostgreSQL.");
  }
}

// Check and migrate Postgres tables if columns are missing
async function checkAndMigratePostgres() {
  try {
    const tableCheck = await pgPool.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'bookings' AND column_name = 'balance_payment_status'
    `);
    if (tableCheck.rows.length === 0) {
      console.log("Migration: Dropping old tables to recreate with new cancellation & admin settings schema in Postgres...");
      await pgPool.query("DROP TABLE IF EXISTS bookings CASCADE");
      await pgPool.query("DROP TABLE IF EXISTS slots CASCADE");
      await pgPool.query("DROP TABLE IF EXISTS admin_settings CASCADE");
    }
  } catch (err) {
    console.warn("Postgres migration check failed, skipping drops:", err.message);
  }
  await initializePostgresTables();
}

// Initialize SQLite tables if they do not exist
function initializeSqliteTables() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT CHECK(status IN ('available', 'held', 'booked', 'blocked')) NOT NULL DEFAULT 'available',
      price REAL NOT NULL,
      held_until TEXT,
      held_by_user_id TEXT,
      FOREIGN KEY (held_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      total_amount REAL,
      advance_amount REAL,
      advance_paid_amount REAL DEFAULT 0,
      balance_amount REAL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      payment_verified BOOLEAN DEFAULT FALSE,
      booking_status TEXT DEFAULT 'pending',
      cancellation_deadline TEXT,
      cancelled_at TEXT,
      refund_amount REAL,
      refund_status TEXT,
      balance_payment_status TEXT DEFAULT 'pending',
      FOREIGN KEY (slot_id) REFERENCES slots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      turf_name TEXT NOT NULL,
      operating_hours_start TEXT NOT NULL,
      operating_hours_end TEXT NOT NULL,
      slot_duration_minutes INTEGER NOT NULL,
      price_per_slot REAL NOT NULL,
      advance_payment_percentage INTEGER NOT NULL,
      cancellation_window_hours INTEGER NOT NULL,
      sport_types_offered TEXT NOT NULL
    );
  `;

  sqliteDb.exec(ddl, (err) => {
    if (err) {
      console.error('Error initializing SQLite tables:', err.message);
    } else {
      console.log('SQLite tables initialized successfully.');
      sqliteDb.run(`
        INSERT OR IGNORE INTO admin_settings (
          id, turf_name, operating_hours_start, operating_hours_end, 
          slot_duration_minutes, price_per_slot, advance_payment_percentage, 
          cancellation_window_hours, sport_types_offered
        ) VALUES (1, 'Golden Arm Turf', '06:00', '23:00', 60, 1200, 40, 4, 'Football, Cricket')
      `, (seedErr) => {
        if (seedErr) console.error('Failed to seed SQLite default settings:', seedErr.message);
      });
    }
  });
}

// Initialize PostgreSQL tables if they do not exist
async function initializePostgresTables() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT CHECK(status IN ('available', 'held', 'booked', 'blocked')) NOT NULL DEFAULT 'available',
      price REAL NOT NULL,
      held_until TEXT,
      held_by_user_id TEXT,
      FOREIGN KEY (held_by_user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS bookings (
      id TEXT PRIMARY KEY,
      slot_id TEXT NOT NULL,
      user_id TEXT NOT NULL,
      created_at TEXT NOT NULL,
      total_amount REAL,
      advance_amount REAL,
      advance_paid_amount REAL DEFAULT 0,
      balance_amount REAL,
      razorpay_order_id TEXT,
      razorpay_payment_id TEXT,
      payment_verified BOOLEAN DEFAULT FALSE,
      booking_status TEXT DEFAULT 'pending',
      cancellation_deadline TEXT,
      cancelled_at TEXT,
      refund_amount REAL,
      refund_status TEXT,
      balance_payment_status TEXT DEFAULT 'pending',
      FOREIGN KEY (slot_id) REFERENCES slots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS admin_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      turf_name TEXT NOT NULL,
      operating_hours_start TEXT NOT NULL,
      operating_hours_end TEXT NOT NULL,
      slot_duration_minutes INTEGER NOT NULL,
      price_per_slot REAL NOT NULL,
      advance_payment_percentage INTEGER NOT NULL,
      cancellation_window_hours INTEGER NOT NULL,
      sport_types_offered TEXT NOT NULL
    );
  `;

  try {
    await pgPool.query(ddl);
    console.log('PostgreSQL tables initialized successfully.');
    await pgPool.query(`
      INSERT INTO admin_settings (
        id, turf_name, operating_hours_start, operating_hours_end, 
        slot_duration_minutes, price_per_slot, advance_payment_percentage, 
        cancellation_window_hours, sport_types_offered
      ) VALUES (1, 'Golden Arm Turf', '06:00', '23:00', 60, 1200, 40, 4, 'Football, Cricket')
      ON CONFLICT (id) DO NOTHING
    `);
  } catch (err) {
    console.error('Error initializing PostgreSQL tables:', err.message);
  }
}

// Unified query function
export const query = async (text, params = []) => {
  if (isFirestore) {
    try {
      const trimmedText = text.replace(/\s+/g, ' ').trim();
      
      // 1. SELECT id, name, phone, created_at FROM users WHERE phone = $1
      // OR SELECT id FROM users WHERE phone = $1
      if (trimmedText.includes('FROM users') && trimmedText.includes('phone = $1')) {
        const snap = await firestoreDb.collection('users').where('phone', '==', params[0]).get();
        const rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        return { rows };
      }
      
      // 2. INSERT INTO users (id, name, phone, created_at)
      if (trimmedText.startsWith('INSERT INTO users')) {
        await firestoreDb.collection('users').doc(params[0]).set({
          name: params[1],
          phone: params[2],
          created_at: params[3]
        });
        return { rows: [] };
      }
      
      // 3. SELECT COUNT(*) as count FROM slots WHERE date = $1
      if (trimmedText.includes('COUNT(*)') && trimmedText.includes('FROM slots') && trimmedText.includes('date = $1')) {
        const snap = await firestoreDb.collection('slots').where('date', '==', params[0]).get();
        return { rows: [{ count: snap.size }] };
      }
      
      // 4. INSERT INTO slots (id, date, start_time, end_time, status, price)
      if (trimmedText.startsWith('INSERT INTO slots')) {
        await firestoreDb.collection('slots').doc(params[0]).set({
          date: params[1],
          start_time: params[2],
          end_time: params[3],
          status: params[4],
          price: params[5]
        });
        return { rows: [] };
      }
      
      // 5. SELECT id, date, start_time, end_time, status, price FROM slots WHERE date = $1 ORDER BY start_time
      if (trimmedText.includes('FROM slots WHERE date = $1')) {
        const snap = await firestoreDb.collection('slots').where('date', '==', params[0]).get();
        let rows = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        rows.sort((a, b) => a.start_time.localeCompare(b.start_time));
        return { rows };
      }
      
      // 6. SELECT status, date, start_time, end_time, price FROM slots WHERE id = $1
      // OR SELECT date, start_time FROM slots WHERE id = $1
      if (trimmedText.includes('FROM slots WHERE id = $1')) {
        const doc = await firestoreDb.collection('slots').doc(params[0]).get();
        return { rows: doc.exists ? [{ id: doc.id, ...doc.data() }] : [] };
      }
      
      // 7. INSERT INTO bookings (id, slot_id, user_id, created_at, ...)
      if (trimmedText.startsWith('INSERT INTO bookings')) {
        const slotDoc = await firestoreDb.collection('slots').doc(params[1]).get();
        const userDoc = await firestoreDb.collection('users').doc(params[2]).get();
        
        await firestoreDb.collection('bookings').doc(params[0]).set({
          slot_id: params[1],
          user_id: params[2],
          created_at: params[3],
          total_amount: params[4],
          advance_amount: params[5],
          advance_paid_amount: params[6] || 0,
          balance_amount: params[7],
          razorpay_order_id: params[8],
          payment_verified: params[9] === true || params[9] === 1,
          booking_status: params[10] || 'pending',
          balance_payment_status: 'pending',
          customer_name: userDoc.exists ? userDoc.data().name : '',
          customer_phone: userDoc.exists ? userDoc.data().phone : '',
          slot: slotDoc.exists ? slotDoc.data() : null
        });
        return { rows: [] };
      }
      
      // 8. UPDATE slots SET status = $1 WHERE id = $2 (and variations for holds)
      if (trimmedText.startsWith('UPDATE slots SET status =') || trimmedText.startsWith('UPDATE slots SET status=')) {
        if (trimmedText.includes('held_until = NULL') && trimmedText.includes('held_until <')) {
          // Revert expired holds query: UPDATE slots SET status = 'available', ... WHERE held_until < $1
          const snap = await firestoreDb.collection('slots')
            .where('status', '==', 'held')
            .get();
          const batch = firestoreDb.batch();
          let count = 0;
          snap.docs.forEach(doc => {
            const data = doc.data();
            if (data.held_until && data.held_until < params[0]) {
              batch.update(doc.ref, {
                status: 'available',
                held_until: null,
                held_by_user_id: null
              });
              count++;
            }
          });
          if (count > 0) {
            await batch.commit();
          }
          return { rows: [] };
        } else if (trimmedText.includes("status = 'available'") && trimmedText.includes('held_until = NULL') && trimmedText.includes('WHERE id =')) {
          // Revert hold query: UPDATE slots SET status = 'available', held_until = NULL, held_by_user_id = NULL WHERE id = $1
          const slotId = params[0];
          await firestoreDb.collection('slots').doc(slotId).update({
            status: 'available',
            held_until: null,
            held_by_user_id: null
          });
          return { rows: [] };
        } else if (trimmedText.includes("status = 'booked'") || (trimmedText.includes('held_until = NULL') && trimmedText.includes('held_by_user_id = NULL'))) {
          // Confirm booking query: UPDATE slots SET status = 'booked', held_until = NULL, held_by_user_id = NULL WHERE id = $1
          const slotId = params[0];
          await firestoreDb.collection('slots').doc(slotId).update({
            status: 'booked',
            held_until: null,
            held_by_user_id: null
          });
          return { rows: [] };
        } else if (trimmedText.includes("status = 'held'") || trimmedText.includes("status='held'")) {
          // Place hold query: UPDATE slots SET status = 'held', held_until = $1, held_by_user_id = $2 WHERE id = $3 ...
          let rowCount = 0;
          await firestoreDb.runTransaction(async (transaction) => {
            const docRef = firestoreDb.collection('slots').doc(params[2]);
            const doc = await transaction.get(docRef);
            if (doc.exists) {
              const data = doc.data();
              const isAvailable = data.status === 'available';
              const isHoldExpired = data.status === 'held' && data.held_until && data.held_until < params[3];
              if (isAvailable || isHoldExpired) {
                transaction.update(docRef, {
                  status: 'held',
                  held_until: params[0],
                  held_by_user_id: params[1]
                });
                rowCount = 1;
              }
            }
          });
          return { rows: [], rowCount };
        } else {
          // Normal status update: UPDATE slots SET status = $1 WHERE id = $2
          await firestoreDb.collection('slots').doc(params[1]).update({ status: params[0] });
          return { rows: [] };
        }
      }
      
      // 9. SELECT slot_id, user_id FROM bookings WHERE id = $1
      if (trimmedText.includes('FROM bookings WHERE id = $1')) {
        const doc = await firestoreDb.collection('bookings').doc(params[0]).get();
        return { rows: doc.exists ? [{ id: doc.id, ...doc.data() }] : [] };
      }
      
      // 10. DELETE FROM bookings WHERE id = $1
      if (trimmedText.startsWith('DELETE FROM bookings WHERE id =')) {
        await firestoreDb.collection('bookings').doc(params[0]).delete();
        return { rows: [] };
      }
      
      // 11. SELECT b.id, b.slot_id, b.created_at, b.user_id, u.name as customer_name, u.phone as customer_phone, ... WHERE b.user_id = $1
      if (trimmedText.includes('FROM bookings b') && trimmedText.includes('b.user_id = $1')) {
        const snap = await firestoreDb.collection('bookings').where('user_id', '==', params[0]).get();
        let rows = snap.docs.map(d => {
          const data = d.data();
          return {
            id: d.id,
            slot_id: data.slot_id,
            user_id: data.user_id,
            created_at: data.created_at,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            total_amount: data.total_amount,
            advance_amount: data.advance_amount,
            advance_paid_amount: data.advance_paid_amount,
            balance_amount: data.balance_amount,
            booking_status: data.booking_status,
            cancellation_deadline: data.cancellation_deadline || null,
            cancelled_at: data.cancelled_at || null,
            refund_amount: data.refund_amount !== undefined ? data.refund_amount : null,
            refund_status: data.refund_status || null,
            date: data.slot?.date,
            start_time: data.slot?.start_time,
            end_time: data.slot?.end_time,
            price: data.slot?.price
          };
        });
        // Sort by date DESC, start_time DESC
        rows.sort((a, b) => {
          const dateComp = (b.date || '').localeCompare(a.date || '');
          if (dateComp !== 0) return dateComp;
          return (b.start_time || '').localeCompare(a.start_time || '');
        });
        return { rows };
      }
      
      // 11b. UPDATE bookings SET payment_verified = ... WHERE razorpay_order_id = ...
      if (trimmedText.startsWith('UPDATE bookings SET payment_verified =') || trimmedText.startsWith('UPDATE bookings SET payment_verified=')) {
        // If query has 7 params (meaning it includes cancellation_deadline), order_id is params[6], else params[5]
        const orderIdParam = params.length >= 7 ? params[6] : params[5];
        const snap = await firestoreDb.collection('bookings').where('razorpay_order_id', '==', orderIdParam).get();
        const batch = firestoreDb.batch();
        snap.docs.forEach(doc => {
          const updateData = {
            payment_verified: params[0] === true || params[0] === 1,
            advance_paid_amount: params[1],
            balance_amount: params[2],
            booking_status: params[3],
            razorpay_payment_id: params[4]
          };
          if (params.length >= 7) {
            updateData.cancellation_deadline = params[5];
          }
          batch.update(doc.ref, updateData);
        });
        await batch.commit();
        return { rows: [] };
      }

      // 11c. SELECT b.id, b.slot_id, b.user_id, b.total_amount, b.advance_amount ... WHERE b.razorpay_order_id = $1
      if (trimmedText.includes('FROM bookings b') && trimmedText.includes('b.razorpay_order_id = $1')) {
        const snap = await firestoreDb.collection('bookings').where('razorpay_order_id', '==', params[0]).get();
        if (snap.size > 0) {
          const data = snap.docs[0].data();
          return {
            rows: [{
              id: snap.docs[0].id,
              slot_id: data.slot_id,
              user_id: data.user_id,
              total_amount: data.total_amount,
              advance_amount: data.advance_amount,
              date: data.slot?.date,
              start_time: data.slot?.start_time,
              end_time: data.slot?.end_time
            }]
          };
        }
        return { rows: [] };
      }

      // 11d. SELECT b.id, b.slot_id, b.user_id, ... FROM bookings b JOIN slots s ... WHERE b.id = $1
      if (trimmedText.includes('FROM bookings b') && trimmedText.includes('WHERE b.id = $1')) {
        const doc = await firestoreDb.collection('bookings').doc(params[0]).get();
        if (doc.exists) {
          const data = doc.data();
          return {
            rows: [{
              id: doc.id,
              slot_id: data.slot_id,
              user_id: data.user_id,
              created_at: data.created_at,
              customer_name: data.customer_name,
              customer_phone: data.customer_phone,
              total_amount: data.total_amount,
              advance_amount: data.advance_amount,
              advance_paid_amount: data.advance_paid_amount,
              balance_amount: data.balance_amount,
              razorpay_payment_id: data.razorpay_payment_id,
              cancellation_deadline: data.cancellation_deadline,
              cancelled_at: data.cancelled_at,
              refund_amount: data.refund_amount,
              refund_status: data.refund_status,
              booking_status: data.booking_status,
              date: data.slot?.date,
              start_time: data.slot?.start_time,
              end_time: data.slot?.end_time,
              price: data.slot?.price
            }]
          };
        }
        return { rows: [] };
      }

      // 11e. UPDATE bookings SET booking_status = ... WHERE id = ...
      if (trimmedText.startsWith('UPDATE bookings SET booking_status =') || trimmedText.startsWith('UPDATE bookings SET booking_status=')) {
        await firestoreDb.collection('bookings').doc(params[4]).update({
          booking_status: params[0],
          cancelled_at: params[1],
          refund_amount: params[2],
          refund_status: params[3]
        });
        return { rows: [] };
      }

      // 11f. UPDATE bookings SET refund_status = ... WHERE id = ...
      if (trimmedText.startsWith('UPDATE bookings SET refund_status =') || trimmedText.startsWith('UPDATE bookings SET refund_status=')) {
        await firestoreDb.collection('bookings').doc(params[1]).update({
          refund_status: params[0]
        });
        return { rows: [] };
      }

      // 11g. SELECT * FROM admin_settings
      if (trimmedText.includes('FROM admin_settings')) {
        const doc = await firestoreDb.collection('admin_settings').doc('settings').get();
        if (doc.exists) {
          const data = doc.data();
          return {
            rows: [{
              id: 1,
              ...data
            }]
          };
        }
        return { rows: [] };
      }

      // 11h. UPDATE admin_settings
      if (trimmedText.startsWith('UPDATE admin_settings')) {
        await firestoreDb.collection('admin_settings').doc('settings').update({
          turf_name: params[0],
          operating_hours_start: params[1],
          operating_hours_end: params[2],
          slot_duration_minutes: params[3],
          price_per_slot: params[4],
          advance_payment_percentage: params[5],
          cancellation_window_hours: params[6],
          sport_types_offered: params[7]
        });
        return { rows: [] };
      }

      // 11i. SELECT bookings join slots join users WHERE s.date = $1 (Today's Bookings)
      if (trimmedText.includes('FROM bookings b') && trimmedText.includes('s.date = $1')) {
        const snap = await firestoreDb.collection('bookings').get();
        const rows = [];
        for (const doc of snap.docs) {
          const data = doc.data();
          if (data.slot && data.slot.date === params[0]) {
            rows.push({
              id: doc.id,
              slot_id: data.slot_id,
              user_id: data.user_id,
              created_at: data.created_at,
              customer_name: data.customer_name,
              customer_phone: data.customer_phone,
              total_amount: data.total_amount,
              advance_amount: data.advance_amount,
              advance_paid_amount: data.advance_paid_amount,
              balance_amount: data.balance_amount,
              booking_status: data.booking_status,
              cancellation_deadline: data.cancellation_deadline,
              balance_payment_status: data.balance_payment_status || 'pending',
              date: data.slot.date,
              start_time: data.slot.start_time,
              end_time: data.slot.end_time,
              price: data.slot.price
            });
          }
        }
        rows.sort((a, b) => (a.start_time || '').localeCompare(b.start_time || ''));
        return { rows };
      }

      // 11j. SELECT bookings join slots join users WHERE b.balance_payment_status = $1 (Pending Balances)
      if (trimmedText.includes('FROM bookings b') && trimmedText.includes('b.balance_payment_status = $1')) {
        const snap = await firestoreDb.collection('bookings')
          .where('balance_payment_status', '==', params[0])
          .where('booking_status', '==', params[1])
          .get();
        const rows = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            slot_id: data.slot_id,
            user_id: data.user_id,
            created_at: data.created_at,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            total_amount: data.total_amount,
            advance_amount: data.advance_amount,
            advance_paid_amount: data.advance_paid_amount,
            balance_amount: data.balance_amount,
            booking_status: data.booking_status,
            cancellation_deadline: data.cancellation_deadline,
            balance_payment_status: data.balance_payment_status || 'pending',
            date: data.slot?.date,
            start_time: data.slot?.start_time,
            end_time: data.slot?.end_time,
            price: data.slot?.price
          };
        });
        rows.sort((a, b) => {
          const dateComp = (a.date || '').localeCompare(b.date || '');
          if (dateComp !== 0) return dateComp;
          return (a.start_time || '').localeCompare(b.start_time || '');
        });
        return { rows };
      }

      // 11k. SELECT bookings join slots join users WHERE b.booking_status = $1 ORDER BY cancelled_at DESC (Cancellations Log)
      if (trimmedText.includes('FROM bookings b') && trimmedText.includes('b.booking_status = $1') && trimmedText.includes('ORDER BY b.cancelled_at')) {
        const snap = await firestoreDb.collection('bookings')
          .where('booking_status', '==', params[0])
          .get();
        const rows = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            slot_id: data.slot_id,
            user_id: data.user_id,
            created_at: data.created_at,
            customer_name: data.customer_name,
            customer_phone: data.customer_phone,
            total_amount: data.total_amount,
            advance_amount: data.advance_amount,
            advance_paid_amount: data.advance_paid_amount,
            balance_amount: data.balance_amount,
            booking_status: data.booking_status,
            cancellation_deadline: data.cancellation_deadline,
            cancelled_at: data.cancelled_at,
            refund_amount: data.refund_amount,
            refund_status: data.refund_status,
            balance_payment_status: data.balance_payment_status || 'pending',
            date: data.slot?.date,
            start_time: data.slot?.start_time,
            end_time: data.slot?.end_time,
            price: data.slot?.price
          };
        });
        rows.sort((a, b) => (b.cancelled_at || '').localeCompare(a.cancelled_at || ''));
        return { rows };
      }

      // 11l. UPDATE bookings SET balance_payment_status = $1 WHERE id = $2
      if (trimmedText.startsWith('UPDATE bookings SET balance_payment_status =') || trimmedText.startsWith('UPDATE bookings SET balance_payment_status=')) {
        await firestoreDb.collection('bookings').doc(params[1]).update({
          balance_payment_status: params[0]
        });
        return { rows: [] };
      }

      // 11m. UPDATE bookings SET booking_status = $1 WHERE id = $2 (For Completion / No-Show)
      if (trimmedText.startsWith('UPDATE bookings SET booking_status = $1 WHERE id = $2') || trimmedText.startsWith('UPDATE bookings SET booking_status=$1 WHERE id=$2')) {
        await firestoreDb.collection('bookings').doc(params[1]).update({
          booking_status: params[0]
        });
        return { rows: [] };
      }

      // 11n. SELECT bookings for stats (excluding pending)
      if (trimmedText.includes('FROM bookings b') && trimmedText.includes("booking_status != 'pending'") && trimmedText.includes("s.date")) {
        const snap = await firestoreDb.collection('bookings').where('booking_status', '!=', 'pending').get();
        const rows = snap.docs.map(doc => {
          const data = doc.data();
          return {
            id: doc.id,
            total_amount: data.total_amount,
            advance_paid_amount: data.advance_paid_amount,
            balance_amount: data.balance_amount,
            booking_status: data.booking_status,
            balance_payment_status: data.balance_payment_status || 'pending',
            date: data.slot?.date
          };
        });
        return { rows };
      }

      // 12. Transaction markers
      if (trimmedText === 'BEGIN' || trimmedText === 'COMMIT' || trimmedText === 'ROLLBACK') {
        return { rows: [] };
      }

      throw new Error(`Unmapped SQL query for Firestore: ${text}`);
    } catch (err) {
      console.error('Firestore query mapping error:', err.message, 'SQL:', text);
      throw err;
    }
  } else if (isPostgres) {
    return pgPool.query(text, params);
  } else {
    return new Promise((resolve, reject) => {
      // Translate Postgres $1, $2 parameter syntax to SQLite ?1, ?2 syntax
      const sqliteText = text.replace(/\$(\d+)/g, '?$1');
      
      const trimmedText = sqliteText.trim().toUpperCase();
      const isSelect = trimmedText.startsWith('SELECT') || trimmedText.startsWith('WITH');
      
      if (isSelect) {
        sqliteDb.all(sqliteText, params, (err, rows) => {
          if (err) {
            console.error('SQLite query error:', err.message, 'SQL:', sqliteText);
            return reject(err);
          }
          resolve({ rows });
        });
      } else {
        sqliteDb.run(sqliteText, params, function(err) {
          if (err) {
            console.error('SQLite execute error:', err.message, 'SQL:', sqliteText);
            return reject(err);
          }
          resolve({
            rows: [],
            rowCount: this.changes,
            lastID: this.lastID
          });
        });
      }
    });
  }
};

// Database utility helper to check active engine
export const getDbEngine = () => {
  if (isFirestore) return 'Firestore';
  if (isPostgres) return 'PostgreSQL';
  return 'SQLite';
};

// Database utility helper to get diagnostics
export const getDbDiagnostics = () => ({
  isSaJsonDefined,
  dbInitError,
  hasDbUrl: !!databaseUrl
});
