import jwt from 'jsonwebtoken';
import { query } from './db.js';

const JWT_SECRET = process.env.JWT_SECRET || 'turf-booking-secret-key-123';

export const authenticateUser = async (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Unauthorized: No token provided' });
  }

  const token = authHeader.split('Bearer ')[1];
  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const userCheck = await query('SELECT id, name, phone FROM users WHERE id = $1', [decoded.id]);
    if (!userCheck.rows || userCheck.rows.length === 0) {
      return res.status(401).json({ error: 'Unauthorized: Account no longer exists' });
    }
    req.user = userCheck.rows[0];
    next();
  } catch (error) {
    console.error('Error verifying token:', error.message);
    return res.status(401).json({ error: 'Unauthorized: Invalid token' });
  }
};
