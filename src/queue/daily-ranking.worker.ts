import { Worker } from 'bullmq';
import { queueConnection } from './connection.js';
import { DAILY_RANKING_QUEUE } from './daily-ranking.queue.js';
import { Product } from '../db/models/product.js';
import { sequelize } from '../db/sequelize.js';
import { logger } from '../common/logger.js';
import { reindexAll } from '../search/indexer.service.js';

export function startDailyRankingWorker() {
  const worker = new Worker(
    DAILY_RANKING_QUEUE,
    async () => {
      logger.info('🏆 Computing daily ranking...');

      const products = await Product.findAll({
        attributes: ['id', 'views', 'scoreSum', 'scoreCnt', 'rank'],
        where: { isDiscontinued: false },
        order: [
          ['views', 'DESC'],
          ['scoreCnt', 'DESC'],
        ],
        raw: true,
      });

      const tx = await sequelize.transaction();
      try {
        for (let i = 0; i < products.length; i++) {
          const newRank = i + 1;
          const oldRank = products[i].rank;
          const diff = oldRank != null ? oldRank - newRank : 0;
          await Product.update(
            { rank: newRank, rankDiff: diff },
            { where: { id: products[i].id }, transaction: tx },
          );
        }
        await tx.commit();
      } catch (err) {
        await tx.rollback();
        throw err;
      }

      await reindexAll();

      logger.info(
        { totalRanked: products.length },
        '✅ Daily ranking complete',
      );
      return { totalRanked: products.length };
    },
    { connection: queueConnection, concurrency: 1 },
  );

  worker.on('failed', (job, err) => {
    logger.error({ jobId: job?.id, err }, '🔴 daily ranking failed');
  });

  return worker;
}
