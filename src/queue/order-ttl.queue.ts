import { Queue } from 'bullmq';
import { queueConnection } from './connection.js';

export const ORDER_TTL_QUEUE = 'order-ttl';

export type OrderTtlJob = { orderId: number };

/**
 * 주문 TTL 큐.
 *  - 주문 생성 시 delay=ORDER_PENDING_TTL_MS 로 잡 등록
 *  - 워커가 시간 지나서 fire되면, 여전히 PENDING이면 자동 CANCELLED + 재고 복구
 *  - 사용자가 그 사이 결제 완료하면 status=PAID로 바뀌어 워커가 no-op (idempotent)
 */
export const ORDER_PENDING_TTL_MS = 30 * 60 * 1000;

export const orderTtlQueue = new Queue<OrderTtlJob>(ORDER_TTL_QUEUE, {
  connection: queueConnection,
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: 'exponential', delay: 5000 },
    removeOnComplete: { count: 1000 },
    removeOnFail: { count: 5000 },
  },
});

export async function enqueueOrderTtl(orderId: number, delayMs = ORDER_PENDING_TTL_MS) {
  await orderTtlQueue.add(
    'expire',
    { orderId },
    { jobId: `ttl-${orderId}`, delay: delayMs },
  );
}
