import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { requireAuth } from '../../middleware/auth.js';
import { createOrder, getOrder } from './order.service.js';

const router = Router();

const createSchema = z.object({
  items: z
    .array(
      z.object({
        productId: z.number().int().positive(),
        quantity: z.number().int().positive().max(100),
      }),
    )
    .min(1)
    .max(20),
});

router.post(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid input', parsed.error.flatten());
    }
    const order = await createOrder({
      userId: req.user!.id,
      items: parsed.data.items,
    });
    res.status(201).json({
      success: true,
      data: {
        id: order.id,
        orderUid: order.orderUid,
        status: order.status,
        totalAmount: order.totalAmount,
      },
    });
  }),
);

router.get(
  '/:id',
  requireAuth,
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Invalid id');
    }
    const order = await getOrder(id, req.user!.id);
    res.json({ success: true, data: order });
  }),
);

export { router as orderRouter };
