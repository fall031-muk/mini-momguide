import { sequelize } from '../../db/sequelize.js';
import { Product } from '../../db/models/product.js';
import { Review } from '../../db/models/review.js';
import { User } from '../../db/models/user.js';
import { HttpError } from '../../middleware/error-handler.js';

type CreateReviewInput = {
  userId: number;
  productId: number;
  score: number;
  content?: string;
};

export async function createReview(input: CreateReviewInput) {
  return sequelize.transaction(async (tx) => {
    const product = await Product.findByPk(input.productId, {
      transaction: tx,
      lock: tx.LOCK.UPDATE,
    });
    if (!product) throw new HttpError(404, 'Product not found');

    const user = await User.findByPk(input.userId, { transaction: tx });
    if (!user) throw new HttpError(404, 'User not found');

    const existing = await Review.findOne({
      where: { userId: input.userId, productId: input.productId },
      transaction: tx,
    });
    if (existing) throw new HttpError(409, 'Already reviewed');

    const review = await Review.create(
      {
        userId: input.userId,
        productId: input.productId,
        score: input.score,
        content: input.content ?? null,
      },
      { transaction: tx },
    );

    product.scoreSum = Number(product.scoreSum) + input.score;
    product.scoreCnt = product.scoreCnt + 1;
    await product.save({ transaction: tx });

    return review;
  });
}

type ListParams = {
  productId: number;
  page: number;
  size: number;
};

export async function listReviews(params: ListParams) {
  const { rows, count } = await Review.findAndCountAll({
    where: { productId: params.productId },
    order: [['createdAt', 'DESC']],
    limit: params.size,
    offset: (params.page - 1) * params.size,
    include: [{ model: User, attributes: ['id', 'nickname'] }],
  });

  return {
    count,
    page: params.page,
    size: params.size,
    rows: rows.map((r) => ({
      id: r.id,
      score: r.score,
      content: r.content,
      createdAt: r.createdAt,
      user: (r as Review & { User?: User }).User
        ? {
            id: (r as Review & { User: User }).User.id,
            nickname: (r as Review & { User: User }).User.nickname,
          }
        : null,
    })),
  };
}
