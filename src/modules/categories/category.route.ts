import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { getCategoryTree, createCategory } from './category.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const tree = await getCategoryTree();
    res.json({ success: true, data: tree });
  }),
);

const createSchema = z.object({
  name: z.string().min(1).max(100),
  parentId: z.number().int().positive().optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid input', parsed.error.flatten());
    }
    const category = await createCategory(parsed.data);
    res.status(201).json({ success: true, data: category });
  }),
);

export { router as categoryRouter };
