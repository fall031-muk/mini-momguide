import { describe, it, expect, vi } from 'vitest';
import { seedData } from './setup.js';
import { listProducts, getProductDetail, createProduct } from '../modules/products/product.service.js';

vi.mock('../queue/product-indexer.queue.js', () => ({
  enqueueProductIndex: vi.fn().mockResolvedValue(undefined),
  enqueueProductDelete: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/redis.js', () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    disconnect: vi.fn(),
  },
  connectRedis: vi.fn().mockResolvedValue(undefined),
}));

describe('ProductService', () => {
  describe('listProducts', () => {
    it('전체 제품 리스트를 반환한다', async () => {
      const result = await listProducts({ page: 1, size: 20 });

      expect(result.count).toBe(3);
      expect(result.rows.length).toBe(3);
    });

    it('categoryId로 필터링한다', async () => {
      const result = await listProducts({
        categoryId: seedData.categories.soap.id,
        page: 1,
        size: 20,
      });

      expect(result.count).toBe(3);
      result.rows.forEach((row) => {
        expect(row.category?.id).toBe(seedData.categories.soap.id);
      });
    });

    it('brandId로 필터링한다', async () => {
      const result = await listProducts({
        brandId: seedData.brands.motherK.id,
        page: 1,
        size: 20,
      });

      expect(result.count).toBe(1);
      expect(result.rows[0].name).toBe('디아 세탁비누');
    });

    it('grade로 필터링한다', async () => {
      const result = await listProducts({ grade: 'A', page: 1, size: 20 });

      expect(result.count).toBe(1);
      expect(result.rows[0].name).toBe('비앤비 세탁비누');
    });

    it('인기순 정렬 (views DESC)', async () => {
      const result = await listProducts({ sort: 'popular', page: 1, size: 20 });

      const views = result.rows.map((r) => r.views);
      expect(views).toEqual([...views].sort((a, b) => (b ?? 0) - (a ?? 0)));
    });

    it('페이지네이션이 동작한다', async () => {
      const page1 = await listProducts({ page: 1, size: 2 });
      const page2 = await listProducts({ page: 2, size: 2 });

      expect(page1.rows.length).toBe(2);
      expect(page2.rows.length).toBe(1);
      expect(page1.count).toBe(3);
    });

    it('각 항목에 brand/category가 포함된다', async () => {
      const result = await listProducts({ page: 1, size: 20 });

      result.rows.forEach((row) => {
        expect(row.brand).toBeDefined();
        expect(row.brand?.name).toBeTruthy();
        expect(row.category).toBeDefined();
        expect(row.category?.name).toBeTruthy();
      });
    });

    it('scoreCnt가 0이면 score는 null', async () => {
      const result = await listProducts({ page: 1, size: 20 });

      result.rows.forEach((row) => {
        expect(row.score).toBeNull();
        expect(row.scoreCnt).toBe(0);
      });
    });
  });

  describe('getProductDetail', () => {
    it('제품 상세와 성분 정보를 반환한다', async () => {
      const detail = await getProductDetail(seedData.products.soap1.id);

      expect(detail.id).toBe(seedData.products.soap1.id);
      expect(detail.name).toBe('디아 세탁비누');
      expect(detail.ingredients.length).toBe(3);
    });

    it('성분이 byInterest로 그루핑된다', async () => {
      const detail = await getProductDetail(seedData.products.soap1.id);

      expect(detail.groupedIngredients.byInterest.isFragrance.length).toBe(1);
      expect(detail.groupedIngredients.byInterest.isFragrance[0].korName).toBe('향료');
    });

    it('성분이 byCaution으로 그루핑된다', async () => {
      const detail = await getProductDetail(seedData.products.soap1.id);

      expect(detail.groupedIngredients.byCaution.middle.length).toBe(1);
      expect(detail.groupedIngredients.byCaution.middle[0].ewgGrade).toBe('D');
    });

    it('존재하지 않는 제품은 404 에러', async () => {
      await expect(getProductDetail(99999)).rejects.toThrow('Product not found');
    });
  });

  describe('createProduct', () => {
    it('제품을 생성하고 큐에 발행한다', async () => {
      const { enqueueProductIndex } = await import('../queue/product-indexer.queue.js');

      const product = await createProduct({
        name: '테스트 제품',
        brandId: seedData.brands.motherK.id,
        categoryId: seedData.categories.soap.id,
      });

      expect(product.id).toBeDefined();
      expect(product.name).toBe('테스트 제품');
      expect(enqueueProductIndex).toHaveBeenCalledWith(product.id);
    });
  });
});
