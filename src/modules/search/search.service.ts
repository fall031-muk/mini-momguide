import { esClient } from '../../config/elasticsearch.js';
import { PRODUCT_INDEX } from '../../search/product-index.js';

export type SearchParams = {
  keyword?: string;
  categoryId?: number;
  brandId?: number;
  grade?: 'A' | 'B' | 'C' | 'D' | 'X';
  includeIngredientIds?: number[];
  excludeIngredientIds?: number[];
  sort?: 'relevance' | 'popular' | 'score' | 'latest';
  page?: number;
  size?: number;
};

type EsMust = Record<string, unknown>;

function buildQuery(p: SearchParams) {
  const must: EsMust[] = [];
  const filter: EsMust[] = [];
  const mustNot: EsMust[] = [];

  if (p.keyword) {
    must.push({
      multi_match: {
        query: p.keyword,
        fields: ['name^3', 'brand.name^2', 'ingredients.korName'],
        type: 'best_fields',
      },
    });
  }
  if (p.categoryId) filter.push({ term: { 'category.id': p.categoryId } });
  if (p.brandId) filter.push({ term: { 'brand.id': p.brandId } });
  if (p.grade) filter.push({ term: { productGrade: p.grade } });

  for (const id of p.includeIngredientIds ?? []) {
    filter.push({
      nested: {
        path: 'ingredients',
        query: { term: { 'ingredients.id': id } },
      },
    });
  }
  for (const id of p.excludeIngredientIds ?? []) {
    mustNot.push({
      nested: {
        path: 'ingredients',
        query: { term: { 'ingredients.id': id } },
      },
    });
  }

  return {
    bool: {
      must: must.length > 0 ? must : [{ match_all: {} }],
      filter,
      must_not: mustNot,
    },
  };
}

function buildSort(sort: SearchParams['sort']): Array<Record<string, 'asc' | 'desc'>> {
  switch (sort) {
    case 'popular':
      return [{ views: 'desc' }];
    case 'score':
      return [{ score: 'desc' }, { scoreCnt: 'desc' }];
    case 'latest':
      return [{ createdAt: 'desc' }];
    case 'relevance':
    default:
      return [];
  }
}

export async function searchProducts(params: SearchParams) {
  const page = params.page ?? 1;
  const size = params.size ?? 20;
  const from = (page - 1) * size;

  const res = await esClient.search({
    index: PRODUCT_INDEX,
    from,
    size,
    query: buildQuery(params),
    sort: buildSort(params.sort),
    aggs: {
      countByGrade: {
        terms: { field: 'productGrade', missing: 'NONE' },
      },
    },
    track_total_hits: true,
  });

  const total =
    typeof res.hits.total === 'number'
      ? res.hits.total
      : (res.hits.total?.value ?? 0);

  const countByGrade: Record<string, number> = {};
  const gradeAgg = res.aggregations?.countByGrade as
    | { buckets: Array<{ key: string; doc_count: number }> }
    | undefined;
  for (const b of gradeAgg?.buckets ?? []) {
    countByGrade[b.key] = b.doc_count;
  }

  return {
    total,
    page,
    size,
    items: res.hits.hits.map((h) => ({
      ...(h._source as Record<string, unknown>),
      _score: h._score,
    })),
    meta: { countByGrade },
  };
}
