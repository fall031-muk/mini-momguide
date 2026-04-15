import Redis from 'ioredis';
import { env } from './env.js';
import { logger } from '../common/logger.js';

export const redis = new Redis({
  host: env.REDIS_HOST,
  port: env.REDIS_PORT,
  lazyConnect: true,
  maxRetriesPerRequest: 3,
});

redis.on('error', (err) => logger.error({ err }, 'Redis error'));
redis.on('connect', () => logger.info('✅ Redis connected'));

export async function connectRedis() {
  await redis.connect();
}
