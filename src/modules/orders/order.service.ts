import { randomUUID } from 'node:crypto';
import { Op, type Transaction } from 'sequelize';
import { sequelize } from '../../db/sequelize.js';
import { Order } from '../../db/models/order.js';
import { OrderItem } from '../../db/models/order-item.js';
import { Product } from '../../db/models/product.js';
import { HttpError } from '../../middleware/error-handler.js';
import { enqueueOrderTtl } from '../../queue/order-ttl.queue.js';
import { logger } from '../../common/logger.js';

export type CreateOrderInput = {
  userId: number;
  items: { productId: number; quantity: number }[];
};

/**
 * 동시성 패턴: SELECT 후 UPDATE가 아니라 조건부 atomic UPDATE 한 방으로 차감.
 *   UPDATE products SET stock = stock - q WHERE id = ? AND stock >= q
 * affectedRows=1 이면 성공, 0 이면 다른 트랜잭션이 선점해 재고 부족해진 상태.
 * 단일 row 갱신은 InnoDB row lock으로 직렬화되므로 SELECT FOR UPDATE 불필요.
 */
export async function createOrder(input: CreateOrderInput) {
  if (input.items.length === 0) {
    throw new HttpError(400, 'Order must contain at least one item');
  }

  return sequelize.transaction(async (tx) => {
    const products = await Product.findAll({
      where: { id: input.items.map((i) => i.productId) },
      transaction: tx,
    });
    const productMap = new Map(products.map((p) => [p.id, p]));

    let totalAmount = 0;
    const itemRows: {
      productId: number;
      productNameSnapshot: string;
      unitPrice: number;
      quantity: number;
    }[] = [];

    for (const item of input.items) {
      const product = productMap.get(item.productId);
      if (!product) {
        throw new HttpError(404, `Product ${item.productId} not found`);
      }
      if (product.price == null) {
        throw new HttpError(400, `Product ${product.id} has no price`);
      }
      if (product.isDiscontinued) {
        throw new HttpError(400, `Product ${product.id} is discontinued`);
      }
      if (item.quantity <= 0) {
        throw new HttpError(400, 'Quantity must be positive');
      }

      const ok = await decrementStock(product.id, item.quantity, tx);
      if (!ok) {
        throw new HttpError(409, `Insufficient stock for product ${product.id}`);
      }

      totalAmount += product.price * item.quantity;
      itemRows.push({
        productId: product.id,
        productNameSnapshot: product.name,
        unitPrice: product.price,
        quantity: item.quantity,
      });
    }

    const order = await Order.create(
      {
        orderUid: `ord_${randomUUID()}`,
        userId: input.userId,
        status: 'PENDING',
        totalAmount,
      },
      { transaction: tx },
    );

    await OrderItem.bulkCreate(
      itemRows.map((r) => ({ ...r, orderId: order.id })),
      { transaction: tx },
    );

    return order;
  }).then(async (order) => {
    // TTL 잡 등록은 트랜잭션 밖. 큐 발행 실패해도 API 가용성 우선.
    await enqueueOrderTtl(order.id).catch((err) =>
      logger.error({ err, orderId: order.id }, 'Failed to enqueue order TTL'),
    );
    return order;
  });
}

/**
 * TTL 워커가 호출. 주문이 여전히 PENDING이면 CANCELLED로 전이 + 재고 복구.
 *  - 조건부 UPDATE: status='PENDING' → 'CANCELLED' 만 허용 (이미 PAID면 no-op)
 *  - affected=0 이면 사용자가 그 사이 결제했거나 이미 취소됐다는 뜻
 *
 * 워커는 BullMQ retry로 안전하게 재시도되므로 멱등성 필수.
 */
export async function expirePendingOrder(orderId: number) {
  return sequelize.transaction(async (tx) => {
    const [affected] = await Order.update(
      { status: 'CANCELLED' },
      { where: { id: orderId, status: 'PENDING' }, transaction: tx },
    );
    if (affected !== 1) {
      return { expired: false, reason: 'not_pending' as const };
    }
    const items = await OrderItem.findAll({ where: { orderId }, transaction: tx });
    for (const item of items) {
      await Product.update(
        { stock: sequelize.literal(`stock + ${item.quantity}`) },
        { where: { id: item.productId }, transaction: tx },
      );
    }
    return { expired: true, restored: items.length };
  });
}

async function decrementStock(
  productId: number,
  quantity: number,
  tx: Transaction,
): Promise<boolean> {
  const [affected] = await Product.update(
    { stock: sequelize.literal(`stock - ${quantity}`) },
    {
      where: { id: productId, stock: { [Op.gte]: quantity } },
      transaction: tx,
    },
  );
  return affected === 1;
}

export async function getOrder(orderId: number, userId: number) {
  const order = await Order.findOne({
    where: { id: orderId, userId },
    include: [{ model: OrderItem, as: 'items' }],
  });
  if (!order) throw new HttpError(404, 'Order not found');
  return order;
}

export async function getOrderByUid(orderUid: string) {
  return Order.findOne({ where: { orderUid } });
}
