import { query } from './db.js';
import crypto from 'crypto';

export async function seedSlots() {
  console.log('Starting slots seeding...');
  let seededCount = 0;
  
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
    for (let hour = 0; hour < 24; hour++) {
      const startHourStr = String(hour).padStart(2, '0');
      const endHourStr = String((hour + 1) % 24).padStart(2, '0');
      
      const start_time = `${startHourStr}:00`;
      const end_time = `${endHourStr}:00`;
      
      // Night slots are 7pm (19:00) to 6am (06:00)
      const isNight = hour >= 19 || hour < 6;
      const price = isNight ? 1200 : 900;
      
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
