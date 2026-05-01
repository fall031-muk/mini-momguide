import type {
  PgClient,
  PgConfirmInput,
  PgConfirmResult,
} from './pg-client.js';
import { PgError } from './pg-client.js';

/**
 * paymentKey 규칙:
 *  - 'mock_ok_*'     → 승인 성공
 *  - 'mock_fail_*'   → PG가 거절 (PgError)
 *  - 'mock_amount_*' → 응답 금액이 요청 금액과 다르게 옴 (검증 실패 케이스)
 */
export class MockPgClient implements PgClient {
  readonly provider = 'mock';

  async confirm(input: PgConfirmInput): Promise<PgConfirmResult> {
    if (input.paymentKey.startsWith('mock_fail_')) {
      throw new PgError('PAYMENT_DECLINED', 'Mock PG declined the payment');
    }

    const responseAmount = input.paymentKey.startsWith('mock_amount_')
      ? input.amount + 1
      : input.amount;

    return {
      paymentKey: input.paymentKey,
      orderUid: input.orderUid,
      amount: responseAmount,
      approvedAt: new Date().toISOString(),
      method: 'CARD',
      raw: {
        paymentKey: input.paymentKey,
        orderId: input.orderUid,
        totalAmount: responseAmount,
        method: 'CARD',
        approvedAt: new Date().toISOString(),
      },
    };
  }
}

export const mockPgClient = new MockPgClient();
