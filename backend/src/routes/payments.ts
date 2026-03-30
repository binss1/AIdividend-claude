import { Router, Request, Response } from 'express';
import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';

const router = Router();

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

/**
 * POST /confirm
 * 결제 승인 요청 (프론트엔드 success 페이지에서 호출)
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { paymentKey, orderId, amount } = req.body;

    if (!paymentKey || !orderId || !amount) {
      res.status(400).json({ error: 'paymentKey, orderId, amount are required' });
      return;
    }

    if (!env.TOSS_SECRET_KEY) {
      res.status(500).json({ error: 'Toss Payments secret key not configured' });
      return;
    }

    // Basic Auth: secretKey + ':'를 Base64 인코딩
    const authHeader = 'Basic ' + Buffer.from(env.TOSS_SECRET_KEY + ':').toString('base64');

    const response = await axios.post(
      `${TOSS_API_URL}/payments/confirm`,
      { paymentKey, orderId, amount: Number(amount) },
      {
        headers: {
          Authorization: authHeader,
          'Content-Type': 'application/json',
        },
      }
    );

    logger.info(`[Payment] 결제 승인 성공: orderId=${orderId}, amount=${amount}, status=${response.data.status}`);

    res.json({
      success: true,
      payment: response.data,
    });
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { code?: string; message?: string } } };
    const errData = axiosErr.response?.data;
    logger.error(`[Payment] 결제 승인 실패: ${errData?.code || 'UNKNOWN'} - ${errData?.message || (err as Error).message}`);

    res.status(400).json({
      success: false,
      error: errData?.message || '결제 승인에 실패했습니다.',
      code: errData?.code || 'UNKNOWN_ERROR',
    });
  }
});

/**
 * GET /orders/:orderId
 * 주문 조회 (결제 상태 확인)
 */
router.get('/orders/:orderId', async (req: Request, res: Response) => {
  try {
    const { orderId } = req.params;
    const authHeader = 'Basic ' + Buffer.from(env.TOSS_SECRET_KEY + ':').toString('base64');

    const response = await axios.get(
      `${TOSS_API_URL}/payments/orders/${orderId}`,
      {
        headers: { Authorization: authHeader },
      }
    );

    res.json(response.data);
  } catch (err: unknown) {
    const axiosErr = err as { response?: { data?: { message?: string } } };
    res.status(400).json({ error: axiosErr.response?.data?.message || 'Order not found' });
  }
});

export default router;
