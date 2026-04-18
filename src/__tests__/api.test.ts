import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { seedData } from './setup.js';
import { createApp } from '../app.js';

vi.mock('../queue/product-indexer.queue.js', () => ({
  enqueueProductIndex: vi.fn().mockResolvedValue(undefined),
  enqueueProductDelete: vi.fn().mockResolvedValue(undefined),
  productIndexerQueue: { add: vi.fn() },
}));

vi.mock('../queue/views-flush.queue.js', () => ({
  viewsFlushQueue: { add: vi.fn() },
}));

vi.mock('../queue/daily-ranking.queue.js', () => ({
  dailyRankingQueue: { add: vi.fn() },
}));

vi.mock('../queue/bull-board.js', () => ({
  createBullBoardRouter: () => {
    const { Router } = require('express');
    return Router();
  },
}));

vi.mock('../config/redis.js', () => ({
  redis: {
    incr: vi.fn().mockResolvedValue(1),
    disconnect: vi.fn(),
  },
  connectRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/elasticsearch.js', () => ({
  esClient: {
    search: vi.fn().mockResolvedValue({
      hits: { total: { value: 0 }, hits: [] },
      aggregations: { countByGrade: { buckets: [] } },
    }),
    close: vi.fn(),
  },
  pingEs: vi.fn().mockResolvedValue(undefined),
}));

const app = createApp();

describe('API Endpoints', () => {
  describe('GET /health', () => {
    it('200 OK를 반환한다', async () => {
      const res = await request(app).get('/health');

      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
      expect(res.body.uptime).toBeDefined();
    });
  });

  describe('GET /api/categories', () => {
    it('카테고리 트리를 반환한다', async () => {
      const res = await request(app).get('/api/categories');

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.data.length).toBeGreaterThanOrEqual(1);
      expect(res.body.data[0].children).toBeDefined();
    });
  });

  describe('POST /api/categories', () => {
    it('유효한 요청으로 카테고리 생성', async () => {
      const res = await request(app)
        .post('/api/categories')
        .send({ name: 'API 테스트 카테고리' });

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(res.body.data.name).toBe('API 테스트 카테고리');
    });

    it('name 없으면 400 에러', async () => {
      const res = await request(app).post('/api/categories').send({});

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
    });
  });

  describe('GET /api/brands', () => {
    it('브랜드 목록을 반환한다', async () => {
      const res = await request(app).get('/api/brands');

      expect(res.status).toBe(200);
      expect(res.body.data.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('GET /api/products', () => {
    it('제품 리스트를 반환한다', async () => {
      const res = await request(app).get('/api/products');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);
      expect(res.body.data.rows.length).toBe(3);
    });

    it('categoryId 필터가 동작한다', async () => {
      const res = await request(app)
        .get(`/api/products?categoryId=${seedData.categories.soap.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(3);
    });

    it('grade 필터가 동작한다', async () => {
      const res = await request(app).get('/api/products?grade=B');

      expect(res.status).toBe(200);
      expect(res.body.data.count).toBe(1);
    });

    it('페이지네이션이 동작한다', async () => {
      const res = await request(app).get('/api/products?page=1&size=2');

      expect(res.status).toBe(200);
      expect(res.body.data.rows.length).toBe(2);
      expect(res.body.data.count).toBe(3);
    });
  });

  describe('GET /api/products/:id', () => {
    it('제품 상세를 반환한다', async () => {
      const res = await request(app)
        .get(`/api/products/${seedData.products.soap1.id}`);

      expect(res.status).toBe(200);
      expect(res.body.data.name).toBe('디아 세탁비누');
      expect(res.body.data.ingredients).toBeDefined();
      expect(res.body.data.groupedIngredients).toBeDefined();
    });

    it('존재하지 않는 ID는 404', async () => {
      const res = await request(app).get('/api/products/99999');

      expect(res.status).toBe(404);
    });

    it('잘못된 ID는 400', async () => {
      const res = await request(app).get('/api/products/abc');

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/products', () => {
    it('제품을 생성한다', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({
          name: 'API 테스트 제품',
          brandId: seedData.brands.motherK.id,
          categoryId: seedData.categories.soap.id,
        });

      expect(res.status).toBe(201);
      expect(res.body.data.name).toBe('API 테스트 제품');
    });

    it('필수 필드 없으면 400', async () => {
      const res = await request(app)
        .post('/api/products')
        .send({ name: '이름만' });

      expect(res.status).toBe(400);
    });
  });

  describe('POST /api/products/:productId/reviews', () => {
    it('리뷰를 생성한다', async () => {
      const res = await request(app)
        .post(`/api/products/${seedData.products.soap1.id}/reviews`)
        .send({
          userId: seedData.users.alice.id,
          score: 5,
          content: '좋아요',
        });

      expect(res.status).toBe(201);
      expect(res.body.data.score).toBe(5);
    });

    it('score 범위 벗어나면 400', async () => {
      const res = await request(app)
        .post(`/api/products/${seedData.products.soap2.id}/reviews`)
        .send({ userId: seedData.users.alice.id, score: 10 });

      expect(res.status).toBe(400);
    });
  });

  describe('404 핸들링', () => {
    it('없는 경로는 404', async () => {
      const res = await request(app).get('/api/nonexistent');

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
    });
  });
});
