import { describe, it, expect, vi } from 'vitest';
import { seedData } from './setup.js';
import { createReview, listReviews } from '../modules/reviews/review.service.js';
import { Product } from '../db/models/product.js';

vi.mock('../queue/product-indexer.queue.js', () => ({
  enqueueProductIndex: vi.fn().mockResolvedValue(undefined),
}));

describe('ReviewService', () => {
  describe('createReview', () => {
    it('리뷰를 생성하고 제품 점수를 갱신한다', async () => {
      const review = await createReview({
        userId: seedData.users.alice.id,
        productId: seedData.products.soap1.id,
        score: 5,
        content: '아기 빨래 잘 돼요',
      });

      expect(review.id).toBeDefined();
      expect(review.score).toBe(5);
      expect(review.content).toBe('아기 빨래 잘 돼요');

      const product = await Product.findByPk(seedData.products.soap1.id);
      expect(Number(product!.scoreSum)).toBe(5);
      expect(product!.scoreCnt).toBe(1);
    });

    it('같은 유저가 같은 제품에 중복 리뷰 불가', async () => {
      await createReview({
        userId: seedData.users.bob.id,
        productId: seedData.products.cleaner.id,
        score: 4,
      });

      await expect(
        createReview({
          userId: seedData.users.bob.id,
          productId: seedData.products.cleaner.id,
          score: 3,
        }),
      ).rejects.toThrow('Already reviewed');
    });

    it('존재하지 않는 제품에 리뷰 시 404', async () => {
      await expect(
        createReview({ userId: seedData.users.alice.id, productId: 99999, score: 5 }),
      ).rejects.toThrow('Product not found');
    });

    it('존재하지 않는 유저로 리뷰 시 404', async () => {
      await expect(
        createReview({ userId: 99999, productId: seedData.products.soap1.id, score: 5 }),
      ).rejects.toThrow('User not found');
    });

    it('리뷰 생성 후 ES 색인 큐에 발행한다', async () => {
      const { enqueueProductIndex } = await import('../queue/product-indexer.queue.js');

      await createReview({
        userId: seedData.users.alice.id,
        productId: seedData.products.soap2.id,
        score: 4,
      });

      expect(enqueueProductIndex).toHaveBeenCalledWith(seedData.products.soap2.id);
    });
  });

  describe('listReviews', () => {
    it('제품별 리뷰 목록을 반환한다', async () => {
      await createReview({
        userId: seedData.users.alice.id,
        productId: seedData.products.soap1.id,
        score: 5,
        content: '좋아요',
      });
      await createReview({
        userId: seedData.users.bob.id,
        productId: seedData.products.soap1.id,
        score: 4,
        content: '괜찮아요',
      });

      const result = await listReviews({
        productId: seedData.products.soap1.id,
        page: 1,
        size: 10,
      });

      expect(result.count).toBe(2);
      expect(result.rows.length).toBe(2);
      expect(result.rows[0].user).toBeDefined();
      expect(result.rows[0].user?.nickname).toBeTruthy();
    });

    it('최신순으로 정렬된다', async () => {
      await createReview({
        userId: seedData.users.alice.id,
        productId: seedData.products.cleaner.id,
        score: 5,
      });
      await createReview({
        userId: seedData.users.bob.id,
        productId: seedData.products.cleaner.id,
        score: 3,
      });

      const result = await listReviews({
        productId: seedData.products.cleaner.id,
        page: 1,
        size: 10,
      });

      const dates = result.rows.map((r) => new Date(r.createdAt).getTime());
      expect(dates[0]).toBeGreaterThanOrEqual(dates[1]);
    });
  });
});
