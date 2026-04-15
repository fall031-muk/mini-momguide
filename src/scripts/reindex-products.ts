import { sequelize } from '../db/sequelize.js';
import { setupAssociations } from '../db/associations.js';
import { ensureProductIndex } from '../search/product-index.js';
import { reindexAll } from '../search/indexer.service.js';
import { esClient } from '../config/elasticsearch.js';
import { logger } from '../common/logger.js';

async function main() {
  setupAssociations();
  await sequelize.authenticate();
  await ensureProductIndex({ recreate: true });
  const total = await reindexAll();
  logger.info(`Done. Indexed ${total} products.`);
  await sequelize.close();
  await esClient.close();
}

main().catch((err) => {
  logger.error({ err }, 'Reindex failed');
  process.exit(1);
});
