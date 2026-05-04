import { describe, it, expect, vi } from 'vitest';
import request from 'supertest';
import { createHmac } from 'node:crypto';

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
import { env } from '../config/env.js';
import { createOrder } from '../modules/orders/order.service.js';
import { confirmPayment } from '../modules/payments/payment.service.js';

const app = createApp();

function sign(rawJson: string) {
  return createHmac('sha256', env.PG_WEBHOOK_SECRET).update(rawJson).digest('hex');
}

describe('POST /api/payments/webhook', () => {
  async function paidOrder() {
    const order = await createOrder({
      userId: seedData.users.alice.id,
      items: [{ productId: seedData.products.soap1.id, quantity: 1 }],
    });
    const { payment } = await confirmPayment({
      userId: order.userId,
      orderUid: order.orderUid,
      paymentKey: `mock_ok_wh_${Math.random()}`,
      amount: order.totalAmount,
    });
    return { order, payment };
  }

  it('서명 헤더 없으면 401', async () => {
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .send({ eventType: 'PAYMENT_CANCELLED', paymentKey: 'x', orderUid: 'y' });
    expect(res.status).toBe(401);
  });

  it('서명이 틀리면 401', async () => {
    const body = JSON.stringify({
      eventType: 'PAYMENT_CANCELLED',
      paymentKey: 'pk',
      orderUid: 'ord_x',
    });
    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', 'deadbeef')
      .send(body);
    expect(res.status).toBe(401);
  });

  it('올바른 서명으로 PAYMENT_CANCELLED 처리', async () => {
    const { order, payment } = await paidOrder();
    const body = JSON.stringify({
      eventType: 'PAYMENT_CANCELLED',
      paymentKey: payment.pgPaymentKey,
      orderUid: order.orderUid,
    });

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', sign(body))
      .send(body);

    expect(res.status).toBe(200);
    expect(res.body.data.applied).toBe(true);
  });

  it('body 단 1바이트만 변조해도 서명 실패', async () => {
    const original = JSON.stringify({
      eventType: 'PAYMENT_CANCELLED',
      paymentKey: 'pk',
      orderUid: 'ord_z',
    });
    const sig = sign(original);
    const tampered = original.replace('PAYMENT_CANCELLED', 'PAYMENT_CONFIRMED');

    const res = await request(app)
      .post('/api/payments/webhook')
      .set('Content-Type', 'application/json')
      .set('X-Signature', sig)
      .send(tampered);

    expect(res.status).toBe(401);
  });
});
