import type { Request, Response, NextFunction } from 'express';
import { UniqueConstraintError } from 'sequelize';
import { IdempotencyKey } from '../db/models/idempotency-key.js';
import { HttpError } from './error-handler.js';

/**
 * Idempotency-Key 미들웨어.
 *
 * 동작:
 *   1. 헤더 없으면 그냥 통과 (선택적)
 *   2. (userId, key, path) row INSERT 시도
 *      - 성공: status=IN_FLIGHT, res.json을 가로채서 완료 후 row에 응답 박제
 *      - UniqueConstraintError: 기존 row가 있다는 뜻
 *           - status=COMPLETED → 캐시된 응답 즉시 반환
 *           - status=IN_FLIGHT → 409 (동시 재시도 차단)
 *
 * requireAuth 뒤에 와야 함 (req.user 필요).
 */
export async function idempotency(req: Request, res: Response, next: NextFunction) {
  const key = req.header('idempotency-key');
  if (!key) return next();
  if (!req.user) throw new HttpError(401, 'Auth required for idempotency');
  if (key.length > 100) throw new HttpError(400, 'Idempotency-Key too long');

  const userId = req.user.id;
  const path = req.baseUrl + req.path;

  try {
    const row = await IdempotencyKey.create({
      userId,
      key,
      requestPath: path,
      status: 'IN_FLIGHT',
    });
    interceptResponse(res, row.id);
    return next();
  } catch (err) {
    if (!(err instanceof UniqueConstraintError)) throw err;

    const existing = await IdempotencyKey.findOne({
      where: { userId, key, requestPath: path },
    });
    if (!existing) throw err;

    if (existing.status === 'IN_FLIGHT') {
      throw new HttpError(409, 'Request with same Idempotency-Key is in flight');
    }

    res
      .status(existing.responseStatus ?? 200)
      .json(existing.responseBody ?? {});
  }
}

function interceptResponse(res: Response, idempotencyRowId: number) {
  const originalJson = res.json.bind(res);
  res.json = ((body: unknown) => {
    void IdempotencyKey.update(
      {
        status: 'COMPLETED',
        responseStatus: res.statusCode,
        responseBody: body as object,
      },
      { where: { id: idempotencyRowId } },
    ).catch(() => {});
    return originalJson(body);
  }) as Response['json'];
}
