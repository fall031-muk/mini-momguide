import { Queue } from 'bullmq';
import { queueConnection } from './connection.js';

export const PRODUCT_INDEXER_QUEUE = 'product-indexer';

export type ProductIndexJob =
  | { action: 'index'; productId: number }
  | { action: 'delete'; productId: number };

export const productIndexerQueue = new Queue<ProductIndexJob>(
  PRODUCT_INDEXER_QUEUE,
  {
    connection: queueConnection,
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: 'exponential', delay: 2000 },
      removeOnComplete: { count: 1000 },
      removeOnFail: { count: 5000 },
    },
  },
);

export async function enqueueProductIndex(productId: number) {
  await productIndexerQueue.add(
    'index',
    { action: 'index', productId },
    { jobId: `index-${productId}-${Date.now()}` },
  );
}

export async function enqueueProductDelete(productId: number) {
  await productIndexerQueue.add(
    'delete',
    { action: 'delete', productId },
    { jobId: `delete-${productId}-${Date.now()}` },
  );
}
