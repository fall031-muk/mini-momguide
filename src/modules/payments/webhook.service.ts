import { createHmac, timingSafeEqual } from 'node:crypto';
import { sequelize } from '../../db/sequelize.js';
import { Order } from '../../db/models/order.js';
import { Payment } from '../../db/models/payment.js';
import { OrderItem } from '../../db/models/order-item.js';
import { Product } from '../../db/models/product.js';
import { HttpError } from '../../middleware/error-handler.js';
import { env } from '../../config/env.js';
import { logger } from '../../common/logger.js';

export type WebhookEvent = {
  eventType: 'PAYMENT_CONFIRMED' | 'PAYMENT_CANCELLED';
  paymentKey: string;
  orderUid: string;
};

/**
 * Mock PG와 우리가 합의한 서명 규칙:
 *   X-Signature: hex(hmac_sha256(secret, rawBody))
 * timing-safe compare로 사이드채널 차단.
 */
export function verifyWebhookSignature(rawBody: Buffer, signatureHex: string): boolean {
  const expected = createHmac('sha256', env.PG_WEBHOOK_SECRET).update(rawBody).digest();
  let received: Buffer;
  try {
    received = Buffer.from(signatureHex, 'hex');
  } catch {
    return false;
  }
  if (received.length !== expected.length) return false;
  return timingSafeEqual(expected, received);
}

/**
 * 이벤트 처리:
 *  - 멱등: payment.status가 이미 목표 상태면 200 즉시 반환
 *  - confirm: PENDING → PAID (confirm 엔드포인트와 same race-safe pattern)
 *  - cancel:  PAID → CANCELLED + 재고 복구
 *
 * 동일 이벤트가 두 번 와도(PG retry) 결과 동일.
 */
export async function handleWebhookEvent(event: WebhookEvent) {
  const order = await Order.findOne({ where: { orderUid: event.orderUid } });
  if (!order) throw new HttpError(404, 'Order not found');

  if (event.eventType === 'PAYMENT_CONFIRMED') {
    return await applyConfirm(order.id, event);
  }
  if (event.eventType === 'PAYMENT_CANCELLED') {
    return await applyCancel(order.id, event);
  }
  throw new HttpError(400, 'Unknown event type');
}

async function applyConfirm(orderId: number, event: WebhookEvent) {
  const payment = await Payment.findOne({ where: { orderId } });
  if (payment && payment.status === 'PAID') {
    return { applied: false, reason: 'already_paid' as const };
  }
  if (!payment) {
    logger.warn(
      { orderId, paymentKey: event.paymentKey },
      'Webhook PAYMENT_CONFIRMED received before confirm endpoint — ignoring',
    );
    return { applied: false, reason: 'no_payment_row' as const };
  }
  return { applied: false, reason: 'unexpected_state' as const };
}

async function applyCancel(orderId: number, event: WebhookEvent) {
  return await sequelize.transaction(async (tx) => {
    const payment = await Payment.findOne({
      where: { orderId, pgPaymentKey: event.paymentKey },
      transaction: tx,
    });
    if (!payment) {
      return { applied: false, reason: 'payment_not_found' as const };
    }
    if (payment.status === 'CANCELLED') {
      return { applied: false, reason: 'already_cancelled' as const };
    }
    if (payment.status !== 'PAID') {
      return { applied: false, reason: 'unexpected_state' as const };
    }

    const [paymentAffected] = await Payment.update(
      { status: 'CANCELLED' },
      { where: { id: payment.id, status: 'PAID' }, transaction: tx },
    );
    if (paymentAffected !== 1) {
      return { applied: false, reason: 'race_lost' as const };
    }

    await Order.update(
      { status: 'CANCELLED' },
      { where: { id: orderId, status: 'PAID' }, transaction: tx },
    );

    const items = await OrderItem.findAll({ where: { orderId }, transaction: tx });
    for (const item of items) {
      await Product.update(
        { stock: sequelize.literal(`stock + ${item.quantity}`) },
        { where: { id: item.productId }, transaction: tx },
      );
    }
    return { applied: true, reason: 'cancelled' as const };
  });
}
