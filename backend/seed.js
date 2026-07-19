import { query } from './db.js';
import crypto from 'crypto';

export async function seedSlots() {
  console.log('Starting slots seeding...');
  let seededCount = 0;
  
  // Load settings dynamically
  let settings = {
    operating_hours_start: '06:00',
    operating_hours_end: '23:00',
    slot_duration_minutes: 60,
    price_per_slot: 1200
  };
  try {
    const res = await query('SELECT * FROM admin_settings LIMIT 1');
    if (res.rows && res.rows.length > 0) {
      settings = res.rows[0];
    }
  } catch (err) {
    console.error('Failed to load admin settings for seeding, using defaults:', err.message);
  }

  const [startHour, startMin] = settings.operating_hours_start.split(':').map(Number);
  const [endHour, endMin] = settings.operating_hours_end.split(':').map(Number);
  const startTotalMinutes = startHour * 60 + startMin;
  const endTotalMinutes = endHour * 60 + endMin;
  const duration = settings.slot_duration_minutes || 60;
  const price = settings.price_per_slot || 1200;

  for (let i = 0; i < 7; i++) {
    const d = new Date();
    d.setDate(d.getDate() + i);
    
    // Format date as YYYY-MM-DD in local time
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    // Check if slots already exist for this date
    const checkRes = await query('SELECT COUNT(*) as count FROM slots WHERE date = $1', [dateStr]);
    
    // Support count key differences between SQLite and PostgreSQL
    const count = parseInt(checkRes.rows[0].count ?? checkRes.rows[0]['COUNT(*)'] ?? 0, 10);

    if (count > 0) {
      console.log(`Slots for ${dateStr} already exist (${count} slots). Skipping.`);
      continue;
    }

    console.log(`Seeding slots for ${dateStr}...`);
    for (let min = startTotalMinutes; min + duration <= endTotalMinutes; min += duration) {
      const sh = Math.floor(min / 60);
      const sm = min % 60;
      const eh = Math.floor((min + duration) / 60);
      const em = (min + duration) % 60;
      
      const start_time = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      const end_time = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;
      
      const slotId = crypto.randomUUID();
      
      await query(
        'INSERT INTO slots (id, date, start_time, end_time, status, price) VALUES ($1, $2, $3, $4, $5, $6)',
        [slotId, dateStr, start_time, end_time, 'available', price]
      );
      seededCount++;
    }
  }
  
  console.log(`Seeding finished. Added ${seededCount} new slots.`);
  return seededCount;
}

// Check if run directly
const isMain = process.argv[1] && (
  process.argv[1].endsWith('seed.js') || 
  process.argv[1].endsWith('seed')
);

if (isMain) {
  seedSlots()
    .then(() => {
      console.log('Seeding process exit.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Seeding process encountered an error:', err);
      process.exit(1);
    });
}
