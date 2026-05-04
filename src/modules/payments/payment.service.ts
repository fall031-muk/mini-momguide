import { UniqueConstraintError } from 'sequelize';
import { sequelize } from '../../db/sequelize.js';
import { Order } from '../../db/models/order.js';
import { Payment } from '../../db/models/payment.js';
import { Product } from '../../db/models/product.js';
import { OrderItem } from '../../db/models/order-item.js';
import { HttpError } from '../../middleware/error-handler.js';
import { getPgClient, PgError } from './pg/index.js';
import { logger } from '../../common/logger.js';

export type ConfirmPaymentInput = {
  userId: number;
  orderUid: string;
  paymentKey: string;
  amount: number;
};

/**
 * 결제 승인 플로우 (위변조/중복/race 방어 모두):
 *  1. 주문 조회 (소유자 검증)
 *  2. 금액 검증: 클라이언트 amount === DB의 order.totalAmount  (위변조 차단)
 *  3. 상태 검증: PENDING이어야 함
 *  4. PG confirm 호출 (외부 호출 — 트랜잭션 밖)
 *  5. 응답 금액 재검증
 *  6. 트랜잭션 시작:
 *     a. payments INSERT (orderId/pgPaymentKey UNIQUE) — 중복이면 catch → 기존 결제 반환 (멱등)
 *     b. orders 조건부 UPDATE: WHERE id=? AND status='PENDING' → status='PAID'
 *        affected=0 이면 다른 요청이 이미 처리한 것 → 기존 결제 조회해 반환
 */
export async function confirmPayment(input: ConfirmPaymentInput) {
  const order = await Order.findOne({ where: { orderUid: input.orderUid } });
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.userId !== input.userId) {
    throw new HttpError(403, 'You do not own this order');
  }

  if (order.status === 'PAID') {
    const existing = await Payment.findOne({ where: { orderId: order.id } });
    if (existing) return { order, payment: existing, alreadyPaid: true };
  }
  if (order.status !== 'PENDING') {
    throw new HttpError(409, `Cannot pay an order in status ${order.status}`);
  }

  if (input.amount !== order.totalAmount) {
    throw new HttpError(400, 'Amount mismatch');
  }

  let pgResult;
  try {
    pgResult = await getPgClient().confirm({
      paymentKey: input.paymentKey,
      orderUid: input.orderUid,
      amount: input.amount,
    });
  } catch (err) {
    if (err instanceof PgError) {
      await markOrderFailedAndRestock(order.id).catch((e) =>
        logger.error({ err: e, orderId: order.id }, 'Failed to mark order failed'),
      );
      throw new HttpError(402, `Payment declined: ${err.message}`);
    }
    throw err;
  }

  if (pgResult.amount !== order.totalAmount) {
    throw new HttpError(500, 'PG returned mismatched amount');
  }

  try {
    return await sequelize.transaction(async (tx) => {
      const payment = await Payment.create(
        {
          orderId: order.id,
          pgProvider: getPgClient().provider,
          pgPaymentKey: pgResult.paymentKey,
          amount: pgResult.amount,
          status: 'PAID',
          paidAt: new Date(pgResult.approvedAt),
          rawResponse: pgResult.raw,
        },
        { transaction: tx },
      );

      const [affected] = await Order.update(
        { status: 'PAID' },
        {
          where: { id: order.id, status: 'PENDING' },
          transaction: tx,
        },
      );
      if (affected !== 1) {
        throw new HttpError(409, 'Order is no longer payable');
      }

      await order.reload({ transaction: tx });
      return { order, payment, alreadyPaid: false };
    });
  } catch (err) {
    if (err instanceof UniqueConstraintError) {
      const existing = await Payment.findOne({ where: { orderId: order.id } });
      if (existing) {
        await order.reload();
        return { order, payment: existing, alreadyPaid: true };
      }
    }
    throw err;
  }
}

async function markOrderFailedAndRestock(orderId: number) {
  await sequelize.transaction(async (tx) => {
    const [affected] = await Order.update(
      { status: 'FAILED' },
      { where: { id: orderId, status: 'PENDING' }, transaction: tx },
    );
    if (affected !== 1) return;
    await restockOrderItems(orderId, tx);
  });
}

async function restockOrderItems(orderId: number, tx: import('sequelize').Transaction) {
  const items = await OrderItem.findAll({ where: { orderId }, transaction: tx });
  for (const item of items) {
    await Product.update(
      { stock: sequelize.literal(`stock + ${item.quantity}`) },
      { where: { id: item.productId }, transaction: tx },
    );
  }
}

/**
 * 환불 (전액 취소).
 *  1. 주문 소유자 + status=PAID 검증
 *  2. PG cancel 호출 (외부 호출 트랜잭션 밖)
 *  3. 트랜잭션:
 *     a. payments 조건부 UPDATE: status='PAID' → 'CANCELLED' (compare-and-swap)
 *     b. orders 조건부 UPDATE: status='PAID' → 'CANCELLED'
 *     c. 재고 복구
 *  affected=0 이면 다른 요청이 이미 환불 처리한 것 → 멱등하게 현재 상태 반환.
 */
export async function refundPayment(input: {
  userId: number;
  paymentId: number;
  reason: string;
}) {
  const payment = await Payment.findByPk(input.paymentId, { include: [Order] });
  if (!payment) throw new HttpError(404, 'Payment not found');

  const order = await Order.findByPk(payment.orderId);
  if (!order) throw new HttpError(404, 'Order not found');
  if (order.userId !== input.userId) {
    throw new HttpError(403, 'You do not own this payment');
  }

  if (payment.status === 'CANCELLED') {
    return { payment, order, alreadyCancelled: true };
  }
  if (payment.status !== 'PAID') {
    throw new HttpError(409, `Cannot refund a payment in status ${payment.status}`);
  }

  try {
    await getPgClient().cancel({
      paymentKey: payment.pgPaymentKey,
      reason: input.reason,
    });
  } catch (err) {
    if (err instanceof PgError) {
      throw new HttpError(502, `PG cancel failed: ${err.message}`);
    }
    throw err;
  }

  const wonRace = await sequelize.transaction(async (tx) => {
    const [paymentAffected] = await Payment.update(
      { status: 'CANCELLED' },
      { where: { id: payment.id, status: 'PAID' }, transaction: tx },
    );
    if (paymentAffected !== 1) {
      logger.warn({ paymentId: payment.id }, 'Refund race: payment already cancelled');
      return false;
    }
    await Order.update(
      { status: 'CANCELLED' },
      { where: { id: order.id, status: 'PAID' }, transaction: tx },
    );
    await restockOrderItems(order.id, tx);
    return true;
  });

  await Promise.all([payment.reload(), order.reload()]);
  return { payment, order, alreadyCancelled: !wonRace };
}
