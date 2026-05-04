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

export type PgCancelInput = {
  paymentKey: string;
  reason: string;
};

export type PgCancelResult = {
  paymentKey: string;
  cancelledAt: string;
  raw: Record<string, unknown>;
};

export interface PgClient {
  readonly provider: string;
  confirm(input: PgConfirmInput): Promise<PgConfirmResult>;
  cancel(input: PgCancelInput): Promise<PgCancelResult>;
}
