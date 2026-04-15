import { Op, type WhereOptions } from 'sequelize';
import { Product, type ProductGrade } from '../../db/models/product.js';
import { Brand } from '../../db/models/brand.js';
import { Category } from '../../db/models/category.js';
import { Ingredient } from '../../db/models/ingredient.js';
import { HttpError } from '../../middleware/error-handler.js';
import { redis } from '../../config/redis.js';
import { cacheKeys } from '../../common/cache-keys.js';
import { toProductListItem, toProductDetail } from './product.dto.js';

type ListParams = {
  categoryId?: number;
  brandId?: number;
  grade?: ProductGrade;
  keyword?: string;
  sort?: 'latest' | 'popular' | 'score';
  page: number;
  size: number;
};

export async function listProducts(params: ListParams) {
  const where: WhereOptions = {};
  if (params.categoryId) where.categoryId = params.categoryId;
  if (params.brandId) where.brandId = params.brandId;
  if (params.grade) where.productGrade = params.grade;
  if (params.keyword) where.name = { [Op.like]: `%${params.keyword}%` };

  const order: [string, 'ASC' | 'DESC'][] =
    params.sort === 'popular'
      ? [['views', 'DESC']]
      : params.sort === 'score'
        ? [['scoreSum', 'DESC']]
        : [['createdAt', 'DESC']];

  const { rows, count } = await Product.findAndCountAll({
    where,
    order,
    limit: params.size,
    offset: (params.page - 1) * params.size,
    include: [
      { model: Brand, attributes: ['id', 'name'] },
      { model: Category, attributes: ['id', 'name'] },
    ],
  });

  return {
    count,
    page: params.page,
    size: params.size,
    rows: rows.map(toProductListItem),
  };
}

export async function getProductDetail(id: number) {
  const product = await Product.findByPk(id, {
    include: [
      { model: Brand, attributes: ['id', 'name', 'imgUrl'] },
      { model: Category, attributes: ['id', 'name'] },
      {
        model: Ingredient,
        as: 'ingredients',
        through: { attributes: [] },
      },
    ],
  });

  if (!product) throw new HttpError(404, 'Product not found');

  const bufferedViews = await redis
    .incr(cacheKeys.productViews(id))
    .catch(() => 0);

  return toProductDetail(product, bufferedViews);
}

export async function createProduct(input: {
  name: string;
  brandId: number;
  categoryId: number;
  imgUrl?: string;
  price?: number;
  priceUnit?: string;
}) {
  return Product.create(input);
}
