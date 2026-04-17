import { Request, Response, NextFunction } from 'express';
import { canUseCredits, deductCredits } from '../services/creditService';
import logger from '../utils/logger';

// ==========================================
// Credit Guard Middleware
// 인증된 사용자의 크레딧을 확인하고 차감
// ==========================================

/**
 * 크레딧 차감 미들웨어 팩토리
 * 요청 처리 전에 크레딧 잔액 확인, 처리 후 차감
 *
 * @param feature - 기능명 (FEATURE_COSTS 키)
 * @param options.deductAfter - true면 응답 후 차감 (기본: false, 요청 전 차감)
 */
export function requireCredits(feature: string, options?: { deductAfter?: boolean }) {
  return async (req: Request, res: Response, next: NextFunction): Promise<void> => {
    // 인증되지 않은 사용자는 통과 (게스트 모드 - optionalAuth와 호환)
    if (!req.user?.id || req.user.id === 'dev-user-001') {
      next();
      return;
    }

    const userId = req.user.id;

    try {
      // 크레딧 확인
      const check = await canUseCredits(userId, feature);

      if (!check.allowed) {
        res.status(402).json({
          error: 'INSUFFICIENT_CREDITS',
          message: check.reason || '크레딧이 부족합니다.',
          balance: check.balance,
          cost: check.cost,
        });
        return;
      }

      // 요청 전 차감 모드 (기본)
      if (!options?.deductAfter) {
        const result = await deductCredits(userId, feature);
        if (!result.success) {
          res.status(402).json({
            error: 'CREDIT_DEDUCTION_FAILED',
            message: result.error || '크레딧 차감에 실패했습니다.',
            balance: result.balance,
          });
          return;
        }

        // 응답 헤더에 잔액 정보 포함
        res.setHeader('X-Credit-Balance', result.balance.toString());
        res.setHeader('X-Credit-Cost', result.cost.toString());
      }

      // deductAfter 모드: 응답 완료 후 차감
      if (options?.deductAfter) {
        const originalJson = res.json.bind(res);
        res.json = function (body: unknown) {
          // 성공 응답일 때만 차감
          if (res.statusCode >= 200 && res.statusCode < 300) {
            deductCredits(userId, feature).then(result => {
              if (result.success) {
                logger.debug(`[CreditGuard] 후차감 완료: user=${userId}, feature=${feature}`);
              }
            }).catch(err => {
              logger.error(`[CreditGuard] 후차감 실패: ${(err as Error).message}`);
            });
          }
          return originalJson(body);
        } as typeof res.json;
      }

      next();
    } catch (err) {
      logger.error(`[CreditGuard] 오류: ${(err as Error).message}`);
      // 크레딧 체크 실패 시에도 요청은 허용 (서비스 중단 방지)
      next();
    }
  };
}
