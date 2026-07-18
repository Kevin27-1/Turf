import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';
import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';

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
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
        projectId: serviceAccount.project_id
      });
    }
    firestoreDb = admin.firestore();
    isFirestore = true;
    console.log('Database client: Configured for Firebase Cloud Firestore.');
  } catch (err) {
    dbInitError = err.message;
    console.error('Failed to initialize Firebase Admin SDK for Firestore:', err.message);
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
    await initializePostgresTables();
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
            const hasCustomerName = columns.some(col => col.name === 'customer_name');
            if (hasCustomerName) {
              console.log("Old bookings table schema detected. Dropping bookings table for schema migration...");
              sqliteDb.run("DROP TABLE bookings", (dropErr) => {
                if (dropErr) {
                  console.error("Failed to drop bookings table:", dropErr.message);
                }
                initializeSqliteTables();
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

// Initialize SQLite tables if they do not exist
function initializeSqliteTables() {
  const ddl = `
    CREATE TABLE IF NOT EXISTS slots (
      id TEXT PRIMARY KEY,
      date TEXT NOT NULL,
      start_time TEXT NOT NULL,
      end_time TEXT NOT NULL,
      status TEXT CHECK(status IN ('available', 'booked')) NOT NULL DEFAULT 'available',
      price REAL NOT NULL
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
      FOREIGN KEY (slot_id) REFERENCES slots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  sqliteDb.exec(ddl, (err) => {
    if (err) {
      console.error('Error initializing SQLite tables:', err.message);
    } else {
      console.log('SQLite tables initialized successfully.');
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
      status TEXT CHECK(status IN ('available', 'booked')) NOT NULL DEFAULT 'available',
      price REAL NOT NULL
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
      FOREIGN KEY (slot_id) REFERENCES slots(id),
      FOREIGN KEY (user_id) REFERENCES users(id)
    );
  `;

  try {
    await pgPool.query(ddl);
    console.log('PostgreSQL tables initialized successfully.');
  } catch (err) {
    console.error('Error initializing PostgreSQL tables:', err.message);
  }
}

// Unified query function
export const query = async (text, params = []) => {
  if (isFirestore) {
    try {
      const trimmedText = text.trim();
      
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
      
      // 7. INSERT INTO bookings (id, slot_id, user_id, created_at)
      if (trimmedText.startsWith('INSERT INTO bookings')) {
        // Fetch denormalized info
        const slotDoc = await firestoreDb.collection('slots').doc(params[1]).get();
        const userDoc = await firestoreDb.collection('users').doc(params[2]).get();
        
        await firestoreDb.collection('bookings').doc(params[0]).set({
          slot_id: params[1],
          user_id: params[2],
          created_at: params[3],
          customer_name: userDoc.exists ? userDoc.data().name : '',
          customer_phone: userDoc.exists ? userDoc.data().phone : '',
          slot: slotDoc.exists ? slotDoc.data() : null
        });
        return { rows: [] };
      }
      
      // 8. UPDATE slots SET status = $1 WHERE id = $2
      if (trimmedText.startsWith('UPDATE slots SET status =')) {
        await firestoreDb.collection('slots').doc(params[1]).update({ status: params[0] });
        return { rows: [] };
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
