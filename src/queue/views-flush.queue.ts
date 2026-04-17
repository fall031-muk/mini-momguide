import { Queue } from 'bullmq';
import { queueConnection } from './connection.js';

export const VIEWS_FLUSH_QUEUE = 'views-flush';

export const viewsFlushQueue = new Queue(VIEWS_FLUSH_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 3000 },
    removeOnComplete: { count: 100 },
    removeOnFail: { count: 500 },
  },
});

export async function registerViewsFlushSchedule() {
  await viewsFlushQueue.upsertJobScheduler(
    'views-flush-every-5min',
    { every: 5 * 60 * 1000 },
    { name: 'flush' },
  );
}
