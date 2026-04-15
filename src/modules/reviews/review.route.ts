import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { createReview, listReviews } from './review.service.js';

const router = Router({ mergeParams: true });

const productIdParam = z.object({
  productId: z.coerce.number().int().positive(),
});

const listQuery = z.object({
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const params = productIdParam.safeParse(req.params);
    const query = listQuery.safeParse(req.query);
    if (!params.success || !query.success) {
      throw new HttpError(400, 'Invalid input');
    }
    const result = await listReviews({
      productId: params.data.productId,
      page: query.data.page,
      size: query.data.size,
    });
    res.json({ success: true, data: result });
  }),
);

const createSchema = z.object({
  userId: z.number().int().positive(),
  score: z.number().int().min(1).max(5),
  content: z.string().max(2000).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const params = productIdParam.safeParse(req.params);
    const body = createSchema.safeParse(req.body);
    if (!params.success || !body.success) {
      throw new HttpError(400, 'Invalid input', body.success ? undefined : body.error.flatten());
    }
    const review = await createReview({
      userId: body.data.userId,
      productId: params.data.productId,
      score: body.data.score,
      content: body.data.content,
    });
    res.status(201).json({ success: true, data: review });
  }),
);

export { router as reviewRouter };
