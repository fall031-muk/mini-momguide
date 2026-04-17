import { Worker } from 'bullmq';
import { queueConnection } from './connection.js';
import {
  PRODUCT_INDEXER_QUEUE,
  type ProductIndexJob,
} from './product-indexer.queue.js';
import { indexProductById } from '../search/indexer.service.js';
import { esClient } from '../config/elasticsearch.js';
import { PRODUCT_INDEX } from '../search/product-index.js';
import { logger } from '../common/logger.js';

export function startProductIndexerWorker() {
  const worker = new Worker<ProductIndexJob>(
    PRODUCT_INDEXER_QUEUE,
    async (job) => {
      if (job.data.action === 'index') {
        await indexProductById(job.data.productId);
        return { indexed: job.data.productId };
      }
      if (job.data.action === 'delete') {
        await esClient
          .delete({ index: PRODUCT_INDEX, id: String(job.data.productId) })
          .catch((err) => {
            if (err?.meta?.statusCode !== 404) throw err;
          });
        return { deleted: job.data.productId };
      }
    },
    { connection: queueConnection, concurrency: 4 },
  );

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, '🟢 index job completed');
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '🔴 index job failed');
  });

  return worker;
}
