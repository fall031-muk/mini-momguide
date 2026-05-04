import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('../queue/order-ttl.queue.js', () => ({
  enqueueOrderTtl: vi.fn().mockResolvedValue(undefined),
  orderTtlQueue: { add: vi.fn() },
  ORDER_PENDING_TTL_MS: 1000,
}));

import { seedData } from './setup.js';
import { createOrder } from '../modules/orders/order.service.js';
import { confirmPayment } from '../modules/payments/payment.service.js';
import { Order } from '../db/models/order.js';
import { Payment } from '../db/models/payment.js';
import { Product } from '../db/models/product.js';

async function makeOrder(userId = seedData.users.alice.id) {
  return createOrder({
    userId,
    items: [{ productId: seedData.products.soap1.id, quantity: 2 }],
  });
}

describe('payment.service.confirmPayment', () => {
  it('정상 결제 시 PAID 전이 + payment row 생성', async () => {
    const order = await makeOrder();

    const result = await confirmPayment({
      userId: order.userId,
      orderUid: order.orderUid,
      paymentKey: `mock_ok_${Date.now()}`,
      amount: order.totalAmount,
    });

    expect(result.alreadyPaid).toBe(false);
    expect(result.order.status).toBe('PAID');
    expect(result.payment.status).toBe('PAID');
    expect(result.payment.amount).toBe(order.totalAmount);
    expect(result.payment.pgProvider).toBe('mock');
  });

  it('금액 위변조(클라 amount ≠ DB total) → 400', async () => {
    const order = await makeOrder();

    await expect(
      confirmPayment({
        userId: order.userId,
        orderUid: order.orderUid,
        paymentKey: 'mock_ok_attack',
        amount: 100,
      }),
    ).rejects.toMatchObject({ status: 400 });

    const fresh = await Order.findByPk(order.id);
    expect(fresh!.status).toBe('PENDING');
  });

  it('PG가 다른 사용자의 주문에는 403', async () => {
    const order = await makeOrder(seedData.users.alice.id);

    await expect(
      confirmPayment({
        userId: seedData.users.bob.id,
        orderUid: order.orderUid,
        paymentKey: 'mock_ok_x',
        amount: order.totalAmount,
      }),
    ).rejects.toMatchObject({ status: 403 });
  });

  it('PG 거절 시 주문은 FAILED + 재고 복구', async () => {
    const before = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    const order = await makeOrder();
    const afterOrder = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    expect(afterOrder).toBe(before - 2);

    await expect(
      confirmPayment({
        userId: order.userId,
        orderUid: order.orderUid,
        paymentKey: 'mock_fail_decline',
        amount: order.totalAmount,
      }),
    ).rejects.toMatchObject({ status: 402 });

    const fresh = await Order.findByPk(order.id);
    expect(fresh!.status).toBe('FAILED');
    const restored = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    expect(restored).toBe(before);
  });

  it('PG 응답 금액이 요청 금액과 다르면 500 (서버측 재검증)', async () => {
    const order = await makeOrder();

    await expect(
      confirmPayment({
        userId: order.userId,
        orderUid: order.orderUid,
        paymentKey: 'mock_amount_skew',
        amount: order.totalAmount,
      }),
    ).rejects.toMatchObject({ status: 500 });

    const fresh = await Order.findByPk(order.id);
    expect(fresh!.status).toBe('PENDING');
  });

  it('이미 결제된 주문에 다시 confirm — 같은 결제를 멱등하게 반환', async () => {
    const order = await makeOrder();
    const first = await confirmPayment({
      userId: order.userId,
      orderUid: order.orderUid,
      paymentKey: 'mock_ok_first',
      amount: order.totalAmount,
    });
    const second = await confirmPayment({
      userId: order.userId,
      orderUid: order.orderUid,
      paymentKey: 'mock_ok_second',
      amount: order.totalAmount,
    });

    expect(second.alreadyPaid).toBe(true);
    expect(second.payment.id).toBe(first.payment.id);

    const payments = await Payment.findAll({ where: { orderId: order.id } });
    expect(payments).toHaveLength(1);
  });

  it('동시에 같은 주문에 두 confirm 요청 — 정확히 하나만 성공, 둘 다 PAID 응답', async () => {
    const order = await makeOrder();

    const [a, b] = await Promise.all([
      confirmPayment({
        userId: order.userId,
        orderUid: order.orderUid,
        paymentKey: 'mock_ok_concurrent_a',
        amount: order.totalAmount,
      }),
      confirmPayment({
        userId: order.userId,
        orderUid: order.orderUid,
        paymentKey: 'mock_ok_concurrent_b',
        amount: order.totalAmount,
      }),
    ]);

    expect([a.alreadyPaid, b.alreadyPaid].sort()).toEqual([false, true]);
    expect(a.payment.id).toBe(b.payment.id);

    const payments = await Payment.findAll({ where: { orderId: order.id } });
    expect(payments).toHaveLength(1);
  });

  it('없는 orderUid는 404', async () => {
    await expect(
      confirmPayment({
        userId: seedData.users.alice.id,
        orderUid: 'ord_does_not_exist',
        paymentKey: 'mock_ok_x',
        amount: 1000,
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
