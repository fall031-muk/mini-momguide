import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { listBrands, createBrand } from './brand.service.js';

const router = Router();

router.get(
  '/',
  asyncHandler(async (_req, res) => {
    const brands = await listBrands();
    res.json({ success: true, data: brands });
  }),
);

const createSchema = z.object({
  name: z.string().min(1).max(200),
  imgUrl: z.string().url().optional(),
});

router.post(
  '/',
  asyncHandler(async (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new HttpError(400, 'Invalid input', parsed.error.flatten());
    }
    const brand = await createBrand(parsed.data);
    res.status(201).json({ success: true, data: brand });
  }),
);

export { router as brandRouter };
