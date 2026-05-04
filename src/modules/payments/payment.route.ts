import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { idempotency } from '../../middleware/idempotency.js';
import { confirmPayment, refundPayment } from './payment.service.js';

const router = Router();

const confirmSchema = z.object({
  orderUid: z.string().min(1),
  paymentKey: z.string().min(1),
  amount: z.number().int().positive(),
});

router.post(
  '/confirm',
  requireAuth,
  asyncHandler(idempotency),
  asyncHandler(async (req, res) => {
    const parsed = confirmSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid input', parsed.error.flatten());
    }
    const { order, payment, alreadyPaid } = await confirmPayment({
      userId: req.user!.id,
      ...parsed.data,
    });
    res.json({
      success: true,
      data: {
        order: {
          id: order.id,
          orderUid: order.orderUid,
          status: order.status,
          totalAmount: order.totalAmount,
        },
        payment: {
          id: payment.id,
          pgProvider: payment.pgProvider,
          amount: payment.amount,
          status: payment.status,
          paidAt: payment.paidAt,
        },
        alreadyPaid,
      },
    });
  }),
);

const refundSchema = z.object({
  reason: z.string().min(1).max(200),
});

router.post(
  '/:id/refund',
  requireAuth,
  asyncHandler(idempotency),
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Invalid id');
    }
    const parsed = refundSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid input', parsed.error.flatten());
    }
    const { payment, order, alreadyCancelled } = await refundPayment({
      userId: req.user!.id,
      paymentId: id,
      reason: parsed.data.reason,
    });
    res.json({
      success: true,
      data: {
        payment: {
          id: payment.id,
          status: payment.status,
          amount: payment.amount,
        },
        order: {
          id: order.id,
          orderUid: order.orderUid,
          status: order.status,
        },
        alreadyCancelled,
      },
    });
  }),
);

export { router as paymentRouter };
