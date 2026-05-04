import { Router, raw } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../middleware/async-handler.js';
import { HttpError } from '../../middleware/error-handler.js';
import { handleWebhookEvent, verifyWebhookSignature } from './webhook.service.js';

const router = Router();

const eventSchema = z.object({
  eventType: z.enum(['PAYMENT_CONFIRMED', 'PAYMENT_CANCELLED']),
  paymentKey: z.string().min(1),
  orderUid: z.string().min(1),
});

router.post(
  '/',
  raw({ type: '*/*', limit: '256kb' }),
  asyncHandler(async (req, res) => {
    const signature = req.header('x-signature');
    if (!signature) throw new HttpError(401, 'Missing X-Signature');

    const rawBody = req.body as Buffer;
    if (!Buffer.isBuffer(rawBody)) {
      throw new HttpError(400, 'Raw body required');
    }
    if (!verifyWebhookSignature(rawBody, signature)) {
      throw new HttpError(401, 'Invalid signature');
    }

    let parsedBody: unknown;
    try {
      parsedBody = JSON.parse(rawBody.toString('utf8'));
    } catch {
      throw new HttpError(400, 'Invalid JSON body');
    }

    const event = eventSchema.safeParse(parsedBody);
    if (!event.success) {
      throw new HttpError(400, 'Invalid event', event.error.flatten());
    }

    const result = await handleWebhookEvent(event.data);
    res.json({ success: true, data: result });
  }),
);

export { router as webhookRouter };
