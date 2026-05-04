import { describe, it, expect, vi } from 'vitest';
import { createHmac } from 'node:crypto';

vi.mock('../queue/order-ttl.queue.js', () => ({
  enqueueOrderTtl: vi.fn().mockResolvedValue(undefined),
  orderTtlQueue: { add: vi.fn() },
  ORDER_PENDING_TTL_MS: 1000,
}));

import { seedData } from './setup.js';
import {
  verifyWebhookSignature,
  handleWebhookEvent,
} from '../modules/payments/webhook.service.js';
import { createOrder } from '../modules/orders/order.service.js';
import { confirmPayment } from '../modules/payments/payment.service.js';
import { env } from '../config/env.js';
import { Order } from '../db/models/order.js';
import { Payment } from '../db/models/payment.js';
import { Product } from '../db/models/product.js';

function sign(body: object) {
  const raw = Buffer.from(JSON.stringify(body));
  const sig = createHmac('sha256', env.PG_WEBHOOK_SECRET)
    .update(raw)
    .digest('hex');
  return { raw, sig };
}

describe('verifyWebhookSignature', () => {
  it('올바른 서명은 통과', () => {
    const { raw, sig } = sign({ a: 1 });
    expect(verifyWebhookSignature(raw, sig)).toBe(true);
  });

  it('잘못된 서명은 거부', () => {
    const { raw } = sign({ a: 1 });
    expect(verifyWebhookSignature(raw, 'deadbeef')).toBe(false);
  });

  it('body가 한 글자라도 다르면 서명 불일치', () => {
    const { sig } = sign({ a: 1 });
    expect(verifyWebhookSignature(Buffer.from(JSON.stringify({ a: 2 })), sig)).toBe(false);
  });

  it('hex가 아닌 문자열은 false', () => {
    const { raw } = sign({ a: 1 });
    expect(verifyWebhookSignature(raw, 'not-hex-zzz')).toBe(false);
  });
});

describe('handleWebhookEvent', () => {
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

  it('PAYMENT_CANCELLED 이벤트 — PAID 결제를 CANCELLED로 + 재고 복구', async () => {
    const initial = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    const { order, payment } = await paidOrder();
    expect((await Product.findByPk(seedData.products.soap1.id))!.stock).toBe(initial - 1);

    const result = await handleWebhookEvent({
      eventType: 'PAYMENT_CANCELLED',
      paymentKey: payment.pgPaymentKey,
      orderUid: order.orderUid,
    });

    expect(result.applied).toBe(true);
    const fresh = await Payment.findByPk(payment.id);
    expect(fresh!.status).toBe('CANCELLED');
    const orderFresh = await Order.findByPk(order.id);
    expect(orderFresh!.status).toBe('CANCELLED');
    expect((await Product.findByPk(seedData.products.soap1.id))!.stock).toBe(initial);
  });

  it('같은 CANCELLED 이벤트 두 번 — 멱등 (재고 한 번만 복구)', async () => {
    const initial = (await Product.findByPk(seedData.products.soap1.id))!.stock;
    const { order, payment } = await paidOrder();

    const first = await handleWebhookEvent({
      eventType: 'PAYMENT_CANCELLED',
      paymentKey: payment.pgPaymentKey,
      orderUid: order.orderUid,
    });
    const second = await handleWebhookEvent({
      eventType: 'PAYMENT_CANCELLED',
      paymentKey: payment.pgPaymentKey,
      orderUid: order.orderUid,
    });

    expect(first.applied).toBe(true);
    expect(second.applied).toBe(false);
    expect((await Product.findByPk(seedData.products.soap1.id))!.stock).toBe(initial);
  });

  it('없는 orderUid는 404', async () => {
    await expect(
      handleWebhookEvent({
        eventType: 'PAYMENT_CANCELLED',
        paymentKey: 'pk_x',
        orderUid: 'ord_doesnt_exist',
      }),
    ).rejects.toMatchObject({ status: 404 });
  });
});
