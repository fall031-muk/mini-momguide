import { describe, it, expect, vi } from 'vitest';

vi.mock('../queue/order-ttl.queue.js', () => ({
  enqueueOrderTtl: vi.fn().mockResolvedValue(undefined),
  orderTtlQueue: { add: vi.fn() },
  ORDER_PENDING_TTL_MS: 1000,
}));

import { seedData } from './setup.js';
import { createOrder } from '../modules/orders/order.service.js';
import { confirmPayment, refundPayment } from '../modules/payments/payment.service.js';
import { Order } from '../db/models/order.js';
import { Payment } from '../db/models/payment.js';
import { Product } from '../db/models/product.js';

async function paidOrder(userId = seedData.users.alice.id) {
  const order = await createOrder({
    userId,
    items: [{ productId: seedData.products.soap1.id, quantity: 2 }],
  });
  const { payment } = await confirmPayment({
    userId,
    orderUid: order.orderUid,
    paymentKey: `mock_ok_${Date.now()}_${Math.random()}`,
    amount: order.totalAmount,
  });
  return { order, payment };
}

describe('refundPayment', () => {
  it('PAID → CANCELLED + 재고 복구', async () => {
    const initial = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    const { payment, order } = await paidOrder();
    expect((await Product.findByPk(seedData.products.soap1.id))!.stock).toBe(initial - 2);

    const result = await refundPayment({
      userId: order.userId,
      paymentId: payment.id,
      reason: '단순 변심',
    });

    expect(result.alreadyCancelled).toBe(false);
    expect(result.payment.status).toBe('CANCELLED');
    expect(result.order.status).toBe('CANCELLED');

    const restored = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    expect(restored).toBe(initial);
  });

  it('이미 환불된 payment 다시 환불 — 멱등', async () => {
    const { payment, order } = await paidOrder();
    await refundPayment({ userId: order.userId, paymentId: payment.id, reason: 'x' });

    const second = await refundPayment({
      userId: order.userId,
      paymentId: payment.id,
      reason: 'x',
    });
    expect(second.alreadyCancelled).toBe(true);
    expect(second.payment.status).toBe('CANCELLED');
  });

  it('다른 사용자의 payment는 403', async () => {
    const { payment, order } = await paidOrder(seedData.users.alice.id);
    await expect(
      refundPayment({
        userId: seedData.users.bob.id,
        paymentId: payment.id,
        reason: 'x',
      }),
    ).rejects.toMatchObject({ status: 403 });

    const fresh = await Payment.findByPk(payment.id);
    expect(fresh!.status).toBe('PAID');
    const orderFresh = await Order.findByPk(order.id);
    expect(orderFresh!.status).toBe('PAID');
  });

  it('PG cancel 실패 시 502, payment는 PAID 유지', async () => {
    const order = await createOrder({
      userId: seedData.users.alice.id,
      items: [{ productId: seedData.products.soap1.id, quantity: 1 }],
    });
    const { payment } = await confirmPayment({
      userId: order.userId,
      orderUid: order.orderUid,
      paymentKey: 'mock_cancel_fail_xyz',
      amount: order.totalAmount,
    });

    await expect(
      refundPayment({ userId: order.userId, paymentId: payment.id, reason: 'x' }),
    ).rejects.toMatchObject({ status: 502 });

    const fresh = await Payment.findByPk(payment.id);
    expect(fresh!.status).toBe('PAID');
  });

  it('동시에 같은 payment 환불 두 번 — 정확히 하나만 실제 처리', async () => {
    const initial = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    const { payment, order } = await paidOrder();

    const [a, b] = await Promise.all([
      refundPayment({ userId: order.userId, paymentId: payment.id, reason: 'x' }),
      refundPayment({ userId: order.userId, paymentId: payment.id, reason: 'y' }),
    ]);

    expect([a.alreadyCancelled, b.alreadyCancelled].sort()).toEqual([false, true]);
    const stock = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    expect(stock).toBe(initial);
  });
});
