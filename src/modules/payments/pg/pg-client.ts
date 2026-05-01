export type PgConfirmInput = {
  paymentKey: string;
  orderUid: string;
  amount: number;
};

export type PgConfirmResult = {
  paymentKey: string;
  orderUid: string;
  amount: number;
  approvedAt: string;
  method: string;
  raw: Record<string, unknown>;
};

export class PgError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
  }
}

export interface PgClient {
  readonly provider: string;
  confirm(input: PgConfirmInput): Promise<PgConfirmResult>;
}
