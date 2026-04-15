import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { listProducts, getProductDetail, createProduct } from './product.service.js';
import { reviewRouter } from '../reviews/review.route.js';

const router = Router();

router.use('/:productId/reviews', reviewRouter);

const listSchema = z.object({
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  grade: z.enum(['A', 'B', 'C', 'D', 'X']).optional(),
  keyword: z.string().trim().min(1).optional(),
  sort: z.enum(['latest', 'popular', 'score']).default('latest'),
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
});

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = listSchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid query', parsed.error.flatten());
    }
    const result = await listProducts(parsed.data);
    res.json({ success: true, data: result });
  }),
);

router.get(
  '/:id',
  asyncHandler(async (req, res) => {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      throw new HttpError(400, 'Invalid id');
    }
    const data = await getProductDetail(id);
    res.json({ success: true, data });
  }),
);

const createSchema = z.object({
  name: z.string().min(1).max(300),
  brandId: z.number().int().positive(),
  categoryId: z.number().int().positive(),
  imgUrl: z.string().url().optional(),
  price: z.number().int().nonnegative().optional(),
  priceUnit: z.string().max(100).optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid input', parsed.error.flatten());
    }
    const product = await createProduct(parsed.data);
    res.status(201).json({ success: true, data: product });
  }),
);

export { router as productRouter };
