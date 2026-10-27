/**
 * Saylani HCM Lite - Vercel Serverless Function Entry Point
 * Exports Express application to handle /api requests on Vercel's serverless runtime.
 */
import express from 'express';
import dotenv from 'dotenv';
import { apiRouter } from '../server/api.ts';

dotenv.config();

const app = express();

// Body parsers
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Security headers
app.use((_req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  next();
});

// Mount router on both '/api' and '/' to ensure proper matching regardless of Vercel path forwarding
app.use('/api', apiRouter);
app.use('/', apiRouter);

// Global Error Handler
app.use((err: any, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Vercel Serverless API Error]:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

export default app;