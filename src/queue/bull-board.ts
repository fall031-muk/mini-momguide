import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { productIndexerQueue } from './product-indexer.queue.js';
import { viewsFlushQueue } from './views-flush.queue.js';
import { dailyRankingQueue } from './daily-ranking.queue.js';
import { orderTtlQueue } from './order-ttl.queue.js';

export function createBullBoardRouter() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [
      new BullMQAdapter(productIndexerQueue),
      new BullMQAdapter(viewsFlushQueue),
      new BullMQAdapter(dailyRankingQueue),
      new BullMQAdapter(orderTtlQueue),
    ],
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
