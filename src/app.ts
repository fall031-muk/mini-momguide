import express from 'express';
import pinoHttp from 'pino-http';
import { logger } from './common/logger.js';
import { errorHandler } from './middleware/error-handler.js';
import { categoryRouter } from './modules/categories/category.route.js';
import { productRouter } from './modules/products/product.route.js';
import { brandRouter } from './modules/brands/brand.route.js';
import { searchRouter } from './modules/search/search.route.js';

export function createApp() {
  const app = express();

  app.use(pinoHttp({ logger }));
  app.use(express.json({ limit: '1mb' }));

  app.get('/health', (_req, res) => {
    res.json({ status: 'ok', uptime: process.uptime() });
  });

  app.use('/api/categories', categoryRouter);
  app.use('/api/products', productRouter);
  app.use('/api/brands', brandRouter);
  app.use('/api/search', searchRouter);

  app.use((_req, res) => {
    res.status(404).json({ success: false, message: 'Not Found' });
  });

  app.use(errorHandler);

  return app;
}
