import { Client } from '@elastic/elasticsearch';
import { env } from './env.js';
import { logger } from '../common/logger.js';

export const esClient = new Client({ node: env.ES_NODE });

export async function pingEs() {
  await esClient.ping();
  logger.info('🔍 Elasticsearch connected');
}
