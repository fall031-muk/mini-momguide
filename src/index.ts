import { createApp } from './app.js';
import { env } from './config/env.js';
import { logger } from './common/logger.js';
import { connectDb, sequelize } from './db/sequelize.js';
import { setupAssociations } from './db/associations.js';
import { connectRedis, redis } from './config/redis.js';
import { startProductIndexerWorker } from './queue/product-indexer.worker.js';
import { productIndexerQueue } from './queue/product-indexer.queue.js';
import { queueConnection } from './queue/connection.js';

async function bootstrap() {
  setupAssociations();
  await connectDb();
  await connectRedis();

  const worker = startProductIndexerWorker();
  logger.info('🛠️  Product indexer worker started');

  const app = createApp();
  const server = app.listen(env.PORT, () => {
    logger.info(`🚀 Server listening on http://localhost:${env.PORT}`);
  });

  const shutdown = async (signal: string) => {
    logger.info(`${signal} received, shutting down...`);
    server.close(async () => {
      await worker.close();
      await productIndexerQueue.close();
      queueConnection.disconnect();
      await sequelize.close();
      redis.disconnect();
      process.exit(0);
    });
  };

  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

bootstrap().catch((err) => {
  logger.error({ err }, 'Fatal bootstrap error');
  process.exit(1);
});
