import { query } from './db.js';
import crypto from 'crypto';

export async function ensureSlotsForDate(dateStr) {
  if (!dateStr || !/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return 0;

  try {
    const existingSlotsRes = await query('SELECT start_time FROM slots WHERE date = $1', [dateStr]);
    const existingStartTimes = new Set((existingSlotsRes.rows || []).map(r => r.start_time));

    let settings = {
      operating_hours_start: '06:00',
      operating_hours_end: '23:00',
      slot_duration_minutes: 60,
      price_per_slot: 1200,
      price_per_slot_day: 1200,
      price_per_slot_night: 1500
    };

    const res = await query('SELECT * FROM admin_settings LIMIT 1');
    if (res.rows && res.rows.length > 0) {
      settings = res.rows[0];
    }

    const [startHour, startMin] = (settings.operating_hours_start || '06:00').split(':').map(Number);
    const [endHour, endMin] = (settings.operating_hours_end || '23:00').split(':').map(Number);
    const startTotalMinutes = startHour * 60 + startMin;
    const endTotalMinutes = endHour * 60 + endMin;
    const duration = settings.slot_duration_minutes || 60;
    const priceDay = settings.price_per_slot_day ?? settings.price_per_slot ?? 1200;
    const priceNight = settings.price_per_slot_night ?? settings.price_per_slot ?? 1500;

    let addedCount = 0;
    for (let min = startTotalMinutes; min + duration <= endTotalMinutes; min += duration) {
      const sh = Math.floor(min / 60);
      const sm = min % 60;
      const eh = Math.floor((min + duration) / 60);
      const em = (min + duration) % 60;

      const start_time = `${String(sh).padStart(2, '0')}:${String(sm).padStart(2, '0')}`;
      const end_time = `${String(eh).padStart(2, '0')}:${String(em).padStart(2, '0')}`;

      if (existingStartTimes.has(start_time)) {
        continue;
      }

      const slotPrice = (start_time >= '06:00' && start_time < '19:00') ? priceDay : priceNight;
      const slotId = crypto.randomUUID();

      await query(
        'INSERT INTO slots (id, date, start_time, end_time, status, price) VALUES ($1, $2, $3, $4, $5, $6)',
        [slotId, dateStr, start_time, end_time, 'available', slotPrice]
      );
      addedCount++;
    }
    return addedCount;
  } catch (err) {
    console.error(`Failed to ensure slots for ${dateStr}:`, err.message);
    return 0;
  }
}

export async function seedSlots() {
  console.log('Starting slots seeding...');
  let totalSeeded = 0;

  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' });
  const [ty, tm, td] = todayStr.split('-').map(Number);
  const baseDate = new Date(ty, tm - 1, td, 12, 0, 0);

  for (let i = 0; i < 14; i++) {
    const d = new Date(baseDate);
    d.setDate(baseDate.getDate() + i);

    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const dateStr = `${year}-${month}-${day}`;

    const added = await ensureSlotsForDate(dateStr);
    totalSeeded += added;
  }

  console.log(`Seeding finished. Added ${totalSeeded} new slots.`);
  return totalSeeded;
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

