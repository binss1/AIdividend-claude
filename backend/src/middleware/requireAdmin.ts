import { Request, Response, NextFunction } from 'express';

/**
 * Admin 전용 미들웨어
 * authenticateToken 이후에 사용 - req.user.role === 'admin' 확인
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction): void {
  if (!req.user?.id) {
    res.status(401).json({ error: '인증이 필요합니다.' });
    return;
  }
  if (req.user.role !== 'admin') {
    res.status(403).json({ error: '관리자 권한이 필요합니다.' });
    return;
  }
  next();
}
