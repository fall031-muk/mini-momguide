import { describe, it, expect, vi } from 'vitest';

vi.mock('../queue/order-ttl.queue.js', () => ({
  enqueueOrderTtl: vi.fn().mockResolvedValue(undefined),
  orderTtlQueue: { add: vi.fn() },
  ORDER_PENDING_TTL_MS: 1000,
}));

import { seedData } from './setup.js';
import { createOrder, expirePendingOrder } from '../modules/orders/order.service.js';
import { confirmPayment } from '../modules/payments/payment.service.js';
import { Order } from '../db/models/order.js';
import { Product } from '../db/models/product.js';

describe('expirePendingOrder', () => {
  it('PENDING 주문을 CANCELLED로 전이 + 재고 복구', async () => {
    const initial = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    const order = await createOrder({
      userId: seedData.users.alice.id,
      items: [{ productId: seedData.products.soap1.id, quantity: 3 }],
    });
    expect((await Product.findByPk(seedData.products.soap1.id))!.stock).toBe(initial - 3);

    const result = await expirePendingOrder(order.id);
    expect(result.expired).toBe(true);

    const fresh = await Order.findByPk(order.id);
    expect(fresh!.status).toBe('CANCELLED');
    expect((await Product.findByPk(seedData.products.soap1.id))!.stock).toBe(initial);
  });

  it('이미 결제된(PAID) 주문에 TTL 잡 fire — no-op', async () => {
    const order = await createOrder({
      userId: seedData.users.alice.id,
      items: [{ productId: seedData.products.soap1.id, quantity: 1 }],
    });
    const stockAfterOrder = (await Product.findByPk(seedData.products.soap1.id))!.stock;

    await confirmPayment({
      userId: order.userId,
      orderUid: order.orderUid,
      paymentKey: 'mock_ok_ttl_paid',
      amount: order.totalAmount,
    });

    const result = await expirePendingOrder(order.id);
    expect(result.expired).toBe(false);

    const fresh = await Order.findByPk(order.id);
    expect(fresh!.status).toBe('PAID');
    // 재고는 결제 후 그대로
    expect((await Product.findByPk(seedData.products.soap1.id))!.stock).toBe(stockAfterOrder);
  });

  it('같은 주문에 expire 두 번 — 두 번째는 no-op (멱등)', async () => {
    const initial = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    const order = await createOrder({
      userId: seedData.users.alice.id,
      items: [{ productId: seedData.products.soap1.id, quantity: 2 }],
    });

    const a = await expirePendingOrder(order.id);
    const b = await expirePendingOrder(order.id);

    expect(a.expired).toBe(true);
    expect(b.expired).toBe(false);
    expect((await Product.findByPk(seedData.products.soap1.id))!.stock).toBe(initial);
  });
});
