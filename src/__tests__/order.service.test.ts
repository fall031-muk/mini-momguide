import { describe, it, expect, beforeEach } from 'vitest';
import { seedData } from './setup.js';
import { createOrder } from '../modules/orders/order.service.js';
import { Product } from '../db/models/product.js';
import { Order } from '../db/models/order.js';
import { OrderItem } from '../db/models/order-item.js';

describe('order.service', () => {
  describe('createOrder', () => {
    it('주문 생성 시 재고가 차감되고 totalAmount/items 가 계산된다', async () => {
      const order = await createOrder({
        userId: seedData.users.alice.id,
        items: [
          { productId: seedData.products.soap1.id, quantity: 2 },
          { productId: seedData.products.cleaner.id, quantity: 1 },
        ],
      });

      expect(order.status).toBe('PENDING');
      expect(order.orderUid).toMatch(/^ord_/);
      // 7430 * 2 + 12000 = 26860
      expect(order.totalAmount).toBe(26860);

      const soap1 = await Product.findByPk(seedData.products.soap1.id);
      expect(soap1!.stock).toBe(98);

      const items = await OrderItem.findAll({ where: { orderId: order.id } });
      expect(items).toHaveLength(2);
      expect(items[0].productNameSnapshot).toBe('디아 세탁비누');
      expect(items[0].unitPrice).toBe(7430);
    });

    it('재고 부족 시 409 + 모든 차감 롤백', async () => {
      await Product.update({ stock: 1 }, { where: { id: seedData.products.soap1.id } });

      await expect(
        createOrder({
          userId: seedData.users.alice.id,
          items: [{ productId: seedData.products.soap1.id, quantity: 5 }],
        }),
      ).rejects.toMatchObject({ status: 409 });

      const soap1 = await Product.findByPk(seedData.products.soap1.id);
      expect(soap1!.stock).toBe(1);
      const orders = await Order.findAll({ where: { userId: seedData.users.alice.id } });
      expect(orders).toHaveLength(0);
    });

    it('동시에 같은 마지막 재고를 노린 두 주문 — 정확히 하나만 성공', async () => {
      await Product.update({ stock: 1 }, { where: { id: seedData.products.soap2.id } });

      const results = await Promise.allSettled([
        createOrder({
          userId: seedData.users.alice.id,
          items: [{ productId: seedData.products.soap2.id, quantity: 1 }],
        }),
        createOrder({
          userId: seedData.users.bob.id,
          items: [{ productId: seedData.products.soap2.id, quantity: 1 }],
        }),
      ]);

      const fulfilled = results.filter((r) => r.status === 'fulfilled');
      const rejected = results.filter((r) => r.status === 'rejected');
      expect(fulfilled).toHaveLength(1);
      expect(rejected).toHaveLength(1);
      expect((rejected[0] as PromiseRejectedResult).reason.status).toBe(409);

      const soap2 = await Product.findByPk(seedData.products.soap2.id);
      expect(soap2!.stock).toBe(0);
    });

    it('존재하지 않는 productId 는 404', async () => {
      await expect(
        createOrder({
          userId: seedData.users.alice.id,
          items: [{ productId: 999999, quantity: 1 }],
        }),
      ).rejects.toMatchObject({ status: 404 });
    });

    it('빈 items는 400', async () => {
      await expect(
        createOrder({ userId: seedData.users.alice.id, items: [] }),
      ).rejects.toMatchObject({ status: 400 });
    });
  });
});
