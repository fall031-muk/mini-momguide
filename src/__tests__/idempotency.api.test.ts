import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';

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
vi.mock('../queue/order-ttl.queue.js', () => ({
  enqueueOrderTtl: vi.fn().mockResolvedValue(undefined),
  orderTtlQueue: { add: vi.fn() },
  ORDER_PENDING_TTL_MS: 1000,
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

import { seedData } from './setup.js';
import { createApp } from '../app.js';
import { Payment } from '../db/models/payment.js';
import { IdempotencyKey } from '../db/models/idempotency-key.js';

const app = createApp();

async function getToken() {
  const email = `idem_${Date.now()}_${Math.random()}@t.com`;
  const nickname = `idem_${Date.now()}_${Math.floor(Math.random() * 1000)}`;
  const res = await request(app)
    .post('/api/auth/signup')
    .send({ email, password: 'password123', nickname });
  return res.body.data.token;
}

describe('Idempotency-Key on /api/payments/confirm', () => {
  it('같은 키로 재요청 시 첫 응답을 그대로 재생', async () => {
    const token = await getToken();
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: seedData.products.soap1.id, quantity: 1 }] });
    const { orderUid, totalAmount } = orderRes.body.data;
    const idemKey = `idem-${Date.now()}`;

    const first = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey)
      .send({ orderUid, paymentKey: 'mock_ok_idem_1', amount: totalAmount });
    expect(first.status).toBe(200);
    expect(first.body.data.alreadyPaid).toBe(false);
    const firstPaymentId = first.body.data.payment.id;

    // 같은 키로 다시 — 다른 paymentKey 보내도 첫 응답 그대로
    const second = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .set('Idempotency-Key', idemKey)
      .send({ orderUid, paymentKey: 'mock_ok_idem_2', amount: totalAmount });
    expect(second.status).toBe(200);
    expect(second.body.data.payment.id).toBe(firstPaymentId);

    // payment row는 한 개만
    const payments = await Payment.findAll({});
    const matching = payments.filter((p) => p.id === firstPaymentId);
    expect(matching).toHaveLength(1);
  });

  it('헤더 없으면 일반 처리 (멱등 row 생성 X)', async () => {
    const token = await getToken();
    const orderRes = await request(app)
      .post('/api/orders')
      .set('Authorization', `Bearer ${token}`)
      .send({ items: [{ productId: seedData.products.soap1.id, quantity: 1 }] });
    const { orderUid, totalAmount } = orderRes.body.data;

    const before = await IdempotencyKey.count();
    const res = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${token}`)
      .send({ orderUid, paymentKey: 'mock_ok_no_idem', amount: totalAmount });
    expect(res.status).toBe(200);
    const after = await IdempotencyKey.count();
    expect(after).toBe(before);
  });

  it('다른 사용자가 같은 키 사용해도 충돌 X (스코프=userId)', async () => {
    const tokenA = await getToken();
    const tokenB = await getToken();

    const makeOrder = async (token: string) => {
      const r = await request(app)
        .post('/api/orders')
        .set('Authorization', `Bearer ${token}`)
        .send({ items: [{ productId: seedData.products.soap1.id, quantity: 1 }] });
      return r.body.data;
    };
    const orderA = await makeOrder(tokenA);
    const orderB = await makeOrder(tokenB);
    const sharedKey = `shared-${Date.now()}`;

    const a = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${tokenA}`)
      .set('Idempotency-Key', sharedKey)
      .send({ orderUid: orderA.orderUid, paymentKey: 'mock_ok_a', amount: orderA.totalAmount });
    const b = await request(app)
      .post('/api/payments/confirm')
      .set('Authorization', `Bearer ${tokenB}`)
      .set('Idempotency-Key', sharedKey)
      .send({ orderUid: orderB.orderUid, paymentKey: 'mock_ok_b', amount: orderB.totalAmount });

    expect(a.status).toBe(200);
    expect(b.status).toBe(200);
    expect(a.body.data.payment.id).not.toBe(b.body.data.payment.id);
  });
});
