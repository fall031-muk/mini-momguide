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
  redis: { incr: vi.fn().mockResolvedValue(1), disconnect: vi.fn() },
  connectRedis: vi.fn().mockResolvedValue(undefined),
}));

vi.mock('../config/elasticsearch.js', () => ({
  esClient: { search: vi.fn(), close: vi.fn() },
  pingEs: vi.fn().mockResolvedValue(undefined),
}));

const app = createApp();

async function getToken(email: string, nickname: string) {
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email, password: 'password123', nickname });
  return res.body.data.token as string;
}

describe('Payment API (E2E)', () => {
  it('signup → login → 주문 → 결제 confirm 풀 플로우', async () => {
    const email = `flow_${Date.now()}@test.com`;
    const nickname = `flow_${Date.now()}`;

    const signupRes = await request(app)
      .post('/api/auth/signup')
      .send({ email, password: 'password123', nickname });
    expect(signupRes.status).toBe(201);
    const token = signupRes.body.data.token;

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: seedData.products.soap1.id, quantity: 1 }] });
    expect(orderRes.status).toBe(201);
    expect(orderRes.body.data.status).toBe('PENDING');
    expect(orderRes.body.data.totalAmount).toBe(7430);
    const { orderUid, totalAmount } = orderRes.body.data;

    const payRes = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderUid, paymentKey: 'mock_ok_e2e', amount: totalAmount });
    expect(payRes.status).toBe(200);
    expect(payRes.body.data.order.status).toBe('PAID');
    expect(payRes.body.data.payment.status).toBe('PAID');
    expect(payRes.body.data.alreadyPaid).toBe(false);
  });

  it('Authorization 헤더 없으면 401', async () => {
    const res = await request(app)
      .post('/api/orders')
      .send({ items: [{ productId: 1, quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it('잘못된 토큰은 401', async () => {
    const res = await request(app)
      .post('/api/orders')
      .set('Authorization', 'Bearer not-a-real-token')
      .send({ items: [{ productId: 1, quantity: 1 }] });
    expect(res.status).toBe(401);
  });

  it('금액 위변조 시 400', async () => {
    const token = await getToken(`tamper_${Date.now()}@test.com`, `tamper_${Date.now()}`);
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: seedData.products.soap1.id, quantity: 1 }] });
    const { orderUid } = orderRes.body.data;

    const payRes = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderUid, paymentKey: 'mock_ok_attack', amount: 1 });
    expect(payRes.status).toBe(400);
  });

  it('다른 유저의 주문은 결제 불가 (403)', async () => {
    const aliceToken = await getToken(`a_${Date.now()}@t.com`, `a_${Date.now()}`);
    const bobToken = await getToken(`b_${Date.now()}@t.com`, `b_${Date.now()}`);

    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${aliceToken}`)
      .send({ items: [{ productId: seedData.products.soap1.id, quantity: 1 }] });
    const { orderUid, totalAmount } = orderRes.body.data;

    const payRes = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${bobToken}`)
      .send({ orderUid, paymentKey: 'mock_ok_x', amount: totalAmount });
    expect(payRes.status).toBe(403);
  });
});
