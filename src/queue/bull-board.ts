import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';
import { productIndexerQueue } from './product-indexer.queue.js';

export function createBullBoardRouter() {
  const serverAdapter = new ExpressAdapter();
  serverAdapter.setBasePath('/admin/queues');

  createBullBoard({
    queues: [new BullMQAdapter(productIndexerQueue)],
    serverAdapter,
  });

  return serverAdapter.getRouter();
}
