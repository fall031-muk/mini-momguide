import { esClient } from '../config/elasticsearch.js';
import { Product } from '../db/models/product.js';
import { Brand } from '../db/models/brand.js';
import { Category } from '../db/models/category.js';
import { Ingredient } from '../db/models/ingredient.js';
import { logger } from '../common/logger.js';
import { PRODUCT_INDEX } from './product-index.js';

type ProductRow = Product & {
  Brand?: Brand;
  Category?: Category;
  ingredients?: Ingredient[];
};

function toDoc(p: ProductRow) {
  const scoreSum = Number(p.scoreSum ?? 0);
  const scoreCnt = p.scoreCnt ?? 0;
  const avg = scoreCnt > 0 ? Number((scoreSum / scoreCnt).toFixed(2)) : 0;
  return {
    id: p.id,
    name: p.name,
    brand: p.Brand ? { id: p.Brand.id, name: p.Brand.name } : null,
    category: p.Category
      ? { id: p.Category.id, name: p.Category.name }
      : null,
    imgUrl: p.imgUrl ?? null,
    price: p.price ?? null,
    views: p.views ?? 0,
    score: avg,
    scoreCnt,
    productGrade: p.productGrade ?? null,
    ingredientGrade: p.ingredientGrade ?? null,
    isDiscontinued: p.isDiscontinued ?? false,
    ingredients: (p.ingredients ?? []).map((i) => ({
      id: i.id,
      korName: i.korName,
      engName: i.engName ?? null,
      ewgGrade: i.ewgGrade,
      isFragrance: !!i.isFragrance,
      isSlsSles: !!i.isSlsSles,
      isColor: !!i.isColor,
      isHumid: !!i.isHumid,
      isAllergic: !!i.isAllergic,
    })),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

export async function indexProductById(id: number) {
  const product = (await Product.findByPk(id, {
    include: [Brand, Category, { model: Ingredient, as: 'ingredients' }],
  })) as ProductRow | null;
  if (!product) {
    await esClient.delete({ index: PRODUCT_INDEX, id: String(id) }).catch(() => {});
    return;
  }
  await esClient.index({
    index: PRODUCT_INDEX,
    id: String(product.id),
    document: toDoc(product),
  });
}

export async function reindexAll(batchSize = 500) {
  let offset = 0;
  let total = 0;
  while (true) {
    const rows = (await Product.findAll({
      include: [Brand, Category, { model: Ingredient, as: 'ingredients' }],
      limit: batchSize,
      offset,
      order: [['id', 'ASC']],
    })) as ProductRow[];
    if (rows.length === 0) break;

    const operations = rows.flatMap((row) => [
      { index: { _index: PRODUCT_INDEX, _id: String(row.id) } },
      toDoc(row),
    ]);

    const res = await esClient.bulk({ operations, refresh: false });
    if (res.errors) {
      const firstErr = res.items.find((it) => it.index?.error)?.index?.error;
      logger.error({ firstErr }, 'Bulk indexing had errors');
      throw new Error('Bulk indexing failed');
    }
    total += rows.length;
    offset += batchSize;
    logger.info(`Indexed ${total} products so far...`);
  }
  await esClient.indices.refresh({ index: PRODUCT_INDEX });
  logger.info(`✅ Reindex complete. Total: ${total}`);
  return total;
}
