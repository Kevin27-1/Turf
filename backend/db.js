import pg from 'pg';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let isPostgres = false;
let pgPool = null;
let sqliteDb = null;

// Determine if we should use PostgreSQL (check common Vercel/environment keys)
const databaseUrl = process.env.DATABASE_URL || 
                    process.env.POSTGRES_URL || 
                    process.env.STORAGE_URL || 
                    process.env.POSTGRES_PRISMA_URL;

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
} else {
  console.log('DATABASE_URL not set. Database client: Configured for SQLite fallback.');
}

// Initialise SQLite if not using PostgreSQL
if (!isPostgres) {
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
export const query = (text, params = []) => {
  if (isPostgres) {
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
export const getDbEngine = () => (isPostgres ? 'PostgreSQL' : 'SQLite');
