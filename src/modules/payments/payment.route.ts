import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { confirmPayment } from './payment.service.js';

const router = Router();

const confirmSchema = z.object({
  orderUid: z.string().min(1),
  paymentKey: z.string().min(1),
  amount: z.number().int().positive(),
});

router.post(
  '/confirm',
  requireAuth,
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

export { router as paymentRouter };
