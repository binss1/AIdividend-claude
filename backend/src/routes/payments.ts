import { Router, Request, Response } from 'express';
import axios from 'axios';
import { env } from '../config/env';
import logger from '../utils/logger';
import {
  createPayment,
  createSubscription,
  getPlan,
  updateUserProfile,
} from '../services/supabaseService';
import { chargeCredits } from '../services/creditService';

const router = Router();

const TOSS_API_URL = 'https://api.tosspayments.com/v1';

// 추가 크레딧 상품 정의
const CREDIT_PRODUCTS: Record<string, { credits: number; price: number }> = {
  'credit-100': { credits: 100, price: 2900 },
  'credit-500': { credits: 500, price: 12900 },
  'credit-1000': { credits: 1000, price: 23900 },
};

/**
 * POST /confirm
 * 결제 승인 요청 + 크레딧 충전/구독 생성
 */
router.post('/confirm', async (req: Request, res: Response) => {
  try {
    const { paymentKey, orderId, amount, userId, planId } = req.body;

    if (!paymentKey || !orderId || !amount) {
      res.status(400).json({ error: 'paymentKey, orderId, amount are required' });
      return;
    }

    if (!env.TOSS_SECRET_KEY) {
      res.status(500).json({ error: 'Toss Payments secret key not configured' });
      return;
    }

    // 1. 토스 결제 승인
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

    const tossData = response.data;
    logger.info(`[Payment] 결제 승인 성공: orderId=${orderId}, amount=${amount}, status=${tossData.status}`);

    // 2. 결제 정보 DB 저장 + 크레딧/구독 처리
    if (userId && planId) {
      const isCreditProduct = planId.startsWith('credit-');
      const billingPeriod = detectBillingPeriod(Number(amount), planId);

      // 결제 기록 저장
      await createPayment({
        user_id: userId,
        order_id: orderId,
        amount: Number(amount),
        plan_id: isCreditProduct ? null : planId,
        credit_amount: isCreditProduct ? (CREDIT_PRODUCTS[planId]?.credits || 0) : undefined,
        billing_period: billingPeriod,
        toss_payment_key: paymentKey,
        method: tossData.method || tossData.easyPay?.provider || null,
        status: 'done',
        toss_response: tossData,
      });

      if (isCreditProduct) {
        // 추가 크레딧 구매
        const product = CREDIT_PRODUCTS[planId];
        if (product) {
          await chargeCredits({
            userId,
            amount: product.credits,
            type: 'addon',
            description: `추가 크레딧 ${product.credits} 구매`,
            referenceId: orderId,
          });
          logger.info(`[Payment] 추가 크레딧 충전: user=${userId}, credits=${product.credits}`);
        }
      } else {
        // 구독 플랜 결제
        const plan = await getPlan(planId);
        if (plan) {
          // 구독 생성
          await createSubscription({
            user_id: userId,
            plan_id: planId,
            billing_period: billingPeriod as 'monthly' | 'annual',
          });

          // 플랜 업데이트 + 크레딧 충전
          await updateUserProfile(userId, { plan_id: planId });

          if (plan.monthly_credits > 0) {
            await chargeCredits({
              userId,
              amount: plan.monthly_credits,
              type: 'charge',
              description: `${plan.name} 플랜 구독 크레딧 (${plan.monthly_credits})`,
              referenceId: orderId,
            });
          }

          logger.info(`[Payment] 구독 생성 완료: user=${userId}, plan=${planId}, credits=${plan.monthly_credits}`);
        }
      }
    }

    res.json({
      success: true,
      payment: tossData,
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
 * 결제금액으로 billing_period 감지
 */
function detectBillingPeriod(amount: number, planId: string): string {
  const annualPrices: Record<string, number> = {
    starter: 95040,
    pro: 287040,
    premium: 575040,
    enterprise: 959040,
  };
  return annualPrices[planId] === amount ? 'annual' : 'monthly';
}

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
