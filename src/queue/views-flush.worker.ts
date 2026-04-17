import { Worker } from 'bullmq';
import { queueConnection } from './connection.js';
import { VIEWS_FLUSH_QUEUE } from './views-flush.queue.js';
import { redis } from '../config/redis.js';
import { Product } from '../db/models/product.js';
import { logger } from '../common/logger.js';
import { enqueueProductIndex } from './product-indexer.queue.js';

const VIEW_KEY_PREFIX = 'product:views:';

export function startViewsFlushWorker() {
  const worker = new Worker(
    VIEWS_FLUSH_QUEUE,
    async () => {
      const keys = await redis.keys(`${VIEW_KEY_PREFIX}*`);
      if (keys.length === 0) return { flushed: 0 };

      let flushed = 0;
      for (const key of keys) {
        const count = await redis.getdel(key);
        if (!count || Number(count) === 0) continue;

        const productId = Number(key.replace(VIEW_KEY_PREFIX, ''));
        await Product.increment('views', {
          by: Number(count),
          where: { id: productId },
        });

        await enqueueProductIndex(productId).catch(() => {});
        flushed++;
      }

      logger.info({ flushed, keys: keys.length }, '📊 Views flushed to DB');
      return { flushed };
    },
    { connection: queueConnection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '🔴 views flush failed');
  });

  return worker;
}
