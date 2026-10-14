import { Request, Response, NextFunction } from 'express';

const allowedOrigins = new Set(
  (process.env.CORS_ALLOWED_ORIGINS || 'http://localhost:3000,http://127.0.0.1:3000')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
);

export function corsMiddleware(req: Request, res: Response, next: NextFunction) {
  const origin = req.get('Origin');
  if (origin && !allowedOrigins.has(origin)) {
    return res.status(403).json({ error: 'Origin not allowed' });
  }

  if (origin) {
    res.header('Access-Control-Allow-Origin', origin);
    res.header('Vary', 'Origin');
  }
  res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept, Authorization');
  if (req.method === 'OPTIONS') {
    return res.sendStatus(200);
  }
  next();
}
