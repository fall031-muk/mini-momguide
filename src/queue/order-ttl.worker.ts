import { Worker } from 'bullmq';
import { queueConnection } from './connection.js';
import { ORDER_TTL_QUEUE, type OrderTtlJob } from './order-ttl.queue.js';
import { expirePendingOrder } from '../modules/orders/order.service.js';
import { logger } from '../common/logger.js';

export function startOrderTtlWorker() {
  const worker = new Worker<OrderTtlJob>(
    ORDER_TTL_QUEUE,
    async (job) => {
      const result = await expirePendingOrder(job.data.orderId);
      return result;
    },
    { connection: queueConnection, concurrency: 4 },
  );

  worker.on('completed', (job, result) => {
    logger.info({ jobId: job.id, result }, '🟢 order-ttl job completed');
  });
  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '🔴 order-ttl job failed');
  });

  return worker;
}
