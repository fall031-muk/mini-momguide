import type { estypes } from '@elastic/elasticsearch';
import { esClient } from '../config/elasticsearch.js';
import { logger } from '../common/logger.js';

export const PRODUCT_INDEX = 'products';

const settings: estypes.IndicesIndexSettings = {
  analysis: {
    tokenizer: {
      nori_user_dict: {
        type: 'nori_tokenizer',
        decompound_mode: 'mixed',
      },
    },
    analyzer: {
      korean: {
        type: 'custom',
        tokenizer: 'nori_user_dict',
        filter: ['lowercase', 'nori_part_of_speech', 'nori_readingform'],
      },
    },
  },
};

const mappings: estypes.MappingTypeMapping = {
  properties: {
    id: { type: 'integer' },
    name: {
      type: 'text',
      analyzer: 'korean',
      fields: {
        keyword: { type: 'keyword' },
      },
    },
    brand: {
      properties: {
        id: { type: 'integer' },
        name: {
          type: 'text',
          analyzer: 'korean',
          fields: { keyword: { type: 'keyword' } },
        },
      },
    },
    category: {
      properties: {
        id: { type: 'integer' },
        name: { type: 'keyword' },
        path: { type: 'keyword' },
      },
    },
    imgUrl: { type: 'keyword', index: false },
    price: { type: 'integer' },
    views: { type: 'integer' },
    score: { type: 'float' },
    scoreCnt: { type: 'integer' },
    productGrade: { type: 'keyword' },
    ingredientGrade: { type: 'keyword' },
    isDiscontinued: { type: 'boolean' },
    ingredients: {
      type: 'nested',
      properties: {
        id: { type: 'integer' },
        korName: {
          type: 'text',
          analyzer: 'korean',
          fields: { keyword: { type: 'keyword' } },
        },
        engName: { type: 'text' },
        ewgGrade: { type: 'keyword' },
        isFragrance: { type: 'boolean' },
        isSlsSles: { type: 'boolean' },
        isColor: { type: 'boolean' },
        isHumid: { type: 'boolean' },
        isAllergic: { type: 'boolean' },
      },
    },
    createdAt: { type: 'date' },
    updatedAt: { type: 'date' },
  },
};

export async function ensureProductIndex(opts: { recreate?: boolean } = {}) {
  const exists = await esClient.indices.exists({ index: PRODUCT_INDEX });
  if (exists && opts.recreate) {
    await esClient.indices.delete({ index: PRODUCT_INDEX });
    logger.info(`🗑️  Deleted index: ${PRODUCT_INDEX}`);
  }
  if (!exists || opts.recreate) {
    await esClient.indices.create({
      index: PRODUCT_INDEX,
      settings,
      mappings,
    });
    logger.info(`✅ Created index: ${PRODUCT_INDEX}`);
  }
}
