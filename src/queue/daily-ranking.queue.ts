import { Queue } from 'bullmq';
import { queueConnection } from './connection.js';

export const DAILY_RANKING_QUEUE = 'daily-ranking';

export const dailyRankingQueue = new Queue(DAILY_RANKING_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 30 },
    removeOnFail: { count: 100 },
  },
});

export async function registerDailyRankingSchedule() {
  await dailyRankingQueue.upsertJobScheduler(
    'daily-ranking-3am',
    { pattern: '0 3 * * *' },
    { name: 'compute-ranking' },
  );
}
