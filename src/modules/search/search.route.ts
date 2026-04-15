import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { searchProducts } from './search.service.js';

const router = Router();

const csvNumbers = z
  .string()
  .optional()
  .transform((v) =>
    v
      ? v
          .split(',')
          .map((s) => Number(s.trim()))
          .filter((n) => Number.isInteger(n) && n > 0)
      : undefined,
  );

const querySchema = z.object({
  keyword: z.string().trim().min(1).optional(),
  categoryId: z.coerce.number().int().positive().optional(),
  brandId: z.coerce.number().int().positive().optional(),
  grade: z.enum(['A', 'B', 'C', 'D', 'X']).optional(),
  includeIngredientIds: csvNumbers,
  excludeIngredientIds: csvNumbers,
  sort: z.enum(['relevance', 'popular', 'score', 'latest']).default('relevance'),
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(20),
});

router.get(
  '/products',
  asyncHandler(async (req, res) => {
    const parsed = querySchema.safeParse(req.query);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid query', parsed.error.flatten());
    }
    const result = await searchProducts(parsed.data);
    res.json({ success: true, data: result });
  }),
);

export { router as searchRouter };
