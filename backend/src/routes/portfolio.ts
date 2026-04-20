import { Router, Request, Response } from 'express';
import { authenticateToken } from '../middleware/auth';
import { requireCredits } from '../middleware/creditGuard';
import { getSupabaseAdmin } from '../services/supabaseService';
import { fmpClient, getDividendHistory } from '../services/fmpService';
import { FMPDividendHistorical } from '../types/index';
import logger from '../utils/logger';

// ==========================================
// 배당 캘린더 헬퍼 타입
// ==========================================
interface DividendAlert {
  symbol: string;
  company_name: string;
  alert_type: 'cut' | 'suspension' | 'increase';
  current_dividend: number;
  previous_dividend: number;
  change_pct: number;
  latest_ex_date: string;
  frequency: string;
}

interface DividendPaymentEvent {
  symbol: string;
  company_name: string;
  shares: number;
  ex_dividend_date: string;
  payment_date: string;       // 실제 or 추정
  payment_date_estimated: boolean;
  dividend_per_share: number;
  total_dividend: number;     // shares * dividend_per_share
}

interface DividendFrequency {
  type: 'monthly' | 'quarterly' | 'semi-annual' | 'annual' | 'unknown';
  intervalDays: number;
}

/** 배당 지급 주기 추정 */
function inferFrequency(history: FMPDividendHistorical[]): DividendFrequency {
  const sorted = [...history]
    .filter(d => (d.adjDividend ?? 0) > 0 || (d.dividend ?? 0) > 0)   // adjDividend=0이어도 dividend>0이면 포함
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  if (sorted.length < 2) return { type: 'unknown', intervalDays: 90 };

  const intervals: number[] = [];
  for (let i = 0; i < Math.min(sorted.length - 1, 6); i++) {
    const diff = (new Date(sorted[i].date).getTime() - new Date(sorted[i + 1].date).getTime()) / (1000 * 60 * 60 * 24);
    if (diff > 5) intervals.push(diff);
  }
  if (!intervals.length) return { type: 'unknown', intervalDays: 90 };

  const avg = intervals.reduce((s, v) => s + v, 0) / intervals.length;
  if (avg < 40)      return { type: 'monthly',     intervalDays: Math.round(avg) };
  if (avg < 120)     return { type: 'quarterly',   intervalDays: Math.round(avg) };
  if (avg < 240)     return { type: 'semi-annual', intervalDays: Math.round(avg) };
  return               { type: 'annual',           intervalDays: Math.round(avg) };
}

/** paymentDate가 없을 때 ex-date로부터 추정 (보통 ex-date + 약 30일) */
function estimatePaymentDate(exDateStr: string, freq: DividendFrequency): string {
  const d = new Date(exDateStr);
  const offsetDays = freq.type === 'monthly' ? 14 : 30;
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

/**
 * 보유 종목의 배당 이력 + 주기를 분석해
 * targetYear/targetMonth에 해당하는 예상 배당 지급 이벤트 목록 반환
 */
function buildDividendEvents(
  symbol: string,
  companyName: string,
  shares: number,
  history: FMPDividendHistorical[],
  targetYear: number,
  targetMonth: number,
): DividendPaymentEvent[] {
  const events: DividendPaymentEvent[] = [];
  const freq = inferFrequency(history);

  const sorted = [...history]
    .filter(d => (d.adjDividend ?? 0) > 0 || (d.dividend ?? 0) > 0)   // inferFrequency와 동일 기준
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  if (!sorted.length) return events;

  const targetStart = new Date(`${targetYear}-${String(targetMonth).padStart(2, '0')}-01T00:00:00`);
  const targetEnd   = new Date(targetStart);
  targetEnd.setMonth(targetEnd.getMonth() + 1);

  // 1) 실제 데이터 중 해당 월 항목 (paymentDate 우선, 없으면 exDate 추정)
  for (const div of sorted) {
    const payDate = div.paymentDate
      ? div.paymentDate
      : estimatePaymentDate(div.date, freq);
    const payDateEstimated = !div.paymentDate;

    const payDateObj = new Date(payDate + 'T00:00:00');
    if (payDateObj >= targetStart && payDateObj < targetEnd) {
      events.push({
        symbol,
        company_name: companyName,
        shares,
        ex_dividend_date: div.date,
        payment_date: payDate,
        payment_date_estimated: payDateEstimated,
        dividend_per_share: (div.adjDividend > 0 ? div.adjDividend : div.dividend) ?? 0,
        total_dividend: ((div.adjDividend > 0 ? div.adjDividend : div.dividend) ?? 0) * shares,
      });
    }
  }

  // 2) 미래 예측: 최신 실제 데이터 이후 날짜면 주기 기반 프로젝션
  if (freq.type !== 'unknown' && freq.intervalDays > 0) {
    const latestActual = sorted[0];
    let nextExDate = new Date(latestActual.date + 'T00:00:00');
    nextExDate.setDate(nextExDate.getDate() + freq.intervalDays);

    // 타겟 월까지 도달하는 데 필요한 주기 수를 동적으로 계산 (최소 3, 최대 14)
    const latestDate = new Date(latestActual.date + 'T00:00:00');
    const cyclesNeeded = Math.ceil(
      (targetEnd.getTime() - latestDate.getTime()) / (freq.intervalDays * 24 * 60 * 60 * 1000)
    );
    const maxSteps = Math.min(Math.max(cyclesNeeded + 1, 3), 14);

    for (let step = 0; step < maxSteps; step++) {
      const nextPayDate = new Date(nextExDate);
      const offsetDays = freq.type === 'monthly' ? 14 : 30;
      nextPayDate.setDate(nextPayDate.getDate() + offsetDays);

      if (nextPayDate >= targetStart && nextPayDate < targetEnd) {
        // 중복 제거 (실제 데이터로 이미 추가된 경우)
        const already = events.some(e =>
          e.ex_dividend_date === nextExDate.toISOString().slice(0, 10)
        );
        if (!already) {
          events.push({
            symbol,
            company_name: companyName,
            shares,
            ex_dividend_date: nextExDate.toISOString().slice(0, 10),
            payment_date: nextPayDate.toISOString().slice(0, 10),
            payment_date_estimated: true,
            dividend_per_share: latestActual.adjDividend || latestActual.dividend,
            total_dividend: (latestActual.adjDividend || latestActual.dividend) * shares,
          });
        }
      }

      // 다음 주기
      nextExDate = new Date(nextExDate);
      nextExDate.setDate(nextExDate.getDate() + freq.intervalDays);

      // 너무 먼 미래면 중단
      if (nextExDate.getTime() > targetEnd.getTime() + 90 * 24 * 60 * 60 * 1000) break;
    }
  }

  return events;
}

const router = Router();
router.use(authenticateToken);

// ==========================================
// 헬퍼 함수
// ==========================================

/** 최근 1년 배당 이력에서 연간 배당 합계 계산 */
function calcAnnualDividend(history: FMPDividendHistorical[]): number {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  return history
    .filter(d => d.adjDividend > 0 && new Date(d.date) >= oneYearAgo)
    .reduce((sum, d) => sum + d.adjDividend, 0);
}

/** 최근 1년 배당 이력에서 지급 월 목록 추출 */
function calcDividendMonths(history: FMPDividendHistorical[]): number[] {
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const months = history
    .filter(d => d.adjDividend > 0 && new Date(d.date) >= oneYearAgo)
    .map(d => new Date(d.date).getMonth() + 1);
  return [...new Set(months)].sort((a, b) => a - b);
}

/** 다음 배당 예상일 (최근 지급 월 + 1주기) */
function calcNextExDate(history: FMPDividendHistorical[]): string | null {
  if (!history.length) return null;
  const sorted = [...history].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  const last = sorted[0];
  if (!last) return null;
  const lastDate = new Date(last.date);
  // 주기 추정: 최근 2개 사이 간격
  if (sorted.length >= 2) {
    const prev = new Date(sorted[1].date);
    const interval = lastDate.getTime() - prev.getTime();
    const next = new Date(lastDate.getTime() + interval);
    return next.toISOString().slice(0, 10);
  }
  return null;
}

// ==========================================
// GET /api/portfolio/dividend-calendar
// 내 포트폴리오 배당 수령 캘린더 (무료)
// Query: year, month (기본: 현재 월)
// ==========================================
router.get('/dividend-calendar', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const now = new Date();
    const year  = parseInt(String(req.query.year))  || now.getFullYear();
    const month = parseInt(String(req.query.month)) || (now.getMonth() + 1); // 1~12

    if (month < 1 || month > 12) {
      res.status(400).json({ error: 'month는 1~12 사이여야 합니다.' });
      return;
    }

    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: 'Supabase 미설정' }); return; }

    const { data: holdings, error } = await sb
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    if (!holdings || holdings.length === 0) {
      res.json({ year, month, total_events: 0, total_amount: 0, events: [], by_date: {} });
      return;
    }

    // 각 종목별 배당 이력 조회 + 이벤트 생성
    const allEvents: DividendPaymentEvent[] = [];
    for (const h of holdings) {
      const sym  = h.symbol as string;
      const name = (h.company_name as string) || sym;
      const sh   = Number(h.shares);
      try {
        const history = await getDividendHistory(sym);
        const evts = buildDividendEvents(sym, name, sh, history, year, month);
        allEvents.push(...evts);
      } catch {
        logger.warn(`[Portfolio/DivCal] 배당 이력 조회 실패: ${sym}`);
      }
    }

    // 날짜별 그룹화
    const byDate: Record<string, DividendPaymentEvent[]> = {};
    for (const ev of allEvents) {
      if (!byDate[ev.payment_date]) byDate[ev.payment_date] = [];
      byDate[ev.payment_date].push(ev);
    }

    const totalAmount = allEvents.reduce((s, e) => s + e.total_dividend, 0);

    res.json({
      year,
      month,
      total_events: allEvents.length,
      total_amount: totalAmount,
      events: allEvents.sort((a, b) => a.payment_date.localeCompare(b.payment_date)),
      by_date: byDate,
    });
  } catch (err) {
    logger.error(`[Portfolio] 배당 캘린더 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '배당 캘린더 조회 실패' });
  }
});

// ==========================================
// GET /api/portfolio/dividend-alerts
// 보유 종목 배당 삭감 · 중단 · 증가 감지 (무료)
// ==========================================
router.get('/dividend-alerts', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: 'Supabase 미설정' }); return; }

    const { data: holdings, error } = await sb
      .from('portfolio_holdings')
      .select('symbol, company_name')
      .eq('user_id', userId);

    if (error) throw new Error(error.message);
    if (!holdings || holdings.length === 0) {
      res.json({ alerts: [] });
      return;
    }

    const alerts: DividendAlert[] = [];

    for (const h of holdings) {
      const sym  = h.symbol as string;
      const name = (h.company_name as string) || sym;
      try {
        const history = await getDividendHistory(sym);
        const freq    = inferFrequency(history);

        const sorted = [...history]
          .filter(d => (d.adjDividend ?? 0) > 0 || (d.dividend ?? 0) > 0)
          .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

        if (sorted.length < 2) continue;

        const latest   = sorted[0];
        const previous = sorted[1];

        const latestDiv   = latest.adjDividend   || latest.dividend   || 0;
        const previousDiv = previous.adjDividend || previous.dividend || 0;

        if (previousDiv <= 0) continue;

        const changePct = ((latestDiv - previousDiv) / previousDiv) * 100;

        // 삭감: 15% 이상 감소
        if (changePct <= -15) {
          alerts.push({
            symbol: sym, company_name: name,
            alert_type: 'cut',
            current_dividend: latestDiv, previous_dividend: previousDiv,
            change_pct: changePct, latest_ex_date: latest.date,
            frequency: freq.type,
          });
          continue;
        }

        // 중단 의심: 마지막 ex-date 이후 주기의 1.8배 경과 + 새 배당 없음
        if (freq.type !== 'unknown') {
          const suspectDate = new Date(latest.date + 'T00:00:00');
          suspectDate.setDate(suspectDate.getDate() + Math.round(freq.intervalDays * 1.8));
          if (new Date() > suspectDate) {
            alerts.push({
              symbol: sym, company_name: name,
              alert_type: 'suspension',
              current_dividend: 0, previous_dividend: latestDiv,
              change_pct: -100, latest_ex_date: latest.date,
              frequency: freq.type,
            });
            continue;
          }
        }

        // 증가: 10% 이상 증가
        if (changePct >= 10) {
          alerts.push({
            symbol: sym, company_name: name,
            alert_type: 'increase',
            current_dividend: latestDiv, previous_dividend: previousDiv,
            change_pct: changePct, latest_ex_date: latest.date,
            frequency: freq.type,
          });
        }
      } catch {
        logger.warn(`[Portfolio/DivAlerts] 이력 조회 실패: ${sym}`);
      }
    }

    // 심각도 순 정렬: suspension → cut → increase
    const order = { suspension: 0, cut: 1, increase: 2 };
    alerts.sort((a, b) => order[a.alert_type] - order[b.alert_type]);

    res.json({ alerts: alerts.slice(0, 15) });
  } catch (err) {
    logger.error(`[Portfolio/DivAlerts] ${(err as Error).message}`);
    res.status(500).json({ error: '배당 알림 조회 실패' });
  }
});

// ==========================================
// GET /api/portfolio
// 보유 종목 목록 (DB 데이터만, 무료)
// ==========================================
router.get('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: 'Supabase 미설정' }); return; }

    const { data, error } = await sb
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);

    res.json({ holdings: data || [] });
  } catch (err) {
    logger.error(`[Portfolio] 목록 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '포트폴리오 조회 실패' });
  }
});

// ==========================================
// GET /api/portfolio/live
// 보유 종목 + 실시간 FMP 데이터 (2크레딧)
// ==========================================
router.get('/live', requireCredits('portfolio_refresh'), async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: 'Supabase 미설정' }); return; }

    const { data: holdings, error } = await sb
      .from('portfolio_holdings')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });

    if (error) throw new Error(error.message);
    if (!holdings || holdings.length === 0) {
      res.json({ holdings: [], summary: buildEmptySummary() });
      return;
    }

    const symbols: string[] = holdings.map((h: Record<string, unknown>) => h.symbol as string);

    // 1. 배치 Quote 조회 (50개 단위)
    const quotes: Record<string, Record<string, unknown>> = {};
    const BATCH = 50;
    for (let i = 0; i < symbols.length; i += BATCH) {
      const batch = symbols.slice(i, i + BATCH);
      try {
        const { data: qData } = await fmpClient.get(`/v3/quote/${batch.join(',')}`);
        if (Array.isArray(qData)) {
          qData.forEach((q: Record<string, unknown>) => {
            if (q.symbol) quotes[q.symbol as string] = q;
          });
        }
      } catch (e) {
        logger.warn(`[Portfolio] FMP Quote 조회 실패: ${(e as Error).message}`);
      }
    }

    // 2. 배당 이력 조회 (순차 처리 - FMP 레이트 제한 대응)
    const divMap: Record<string, { annualDiv: number; months: number[]; nextExDate: string | null }> = {};
    for (const sym of symbols) {
      try {
        const history = await getDividendHistory(sym);
        divMap[sym] = {
          annualDiv: calcAnnualDividend(history),
          months: calcDividendMonths(history),
          nextExDate: calcNextExDate(history),
        };
      } catch {
        divMap[sym] = { annualDiv: 0, months: [], nextExDate: null };
      }
    }

    // 3. 데이터 병합
    const enriched = holdings.map((h: Record<string, unknown>) => {
      const sym = h.symbol as string;
      const q = quotes[sym];
      const d = divMap[sym] || { annualDiv: 0, months: [], nextExDate: null };

      const shares = Number(h.shares);
      const avgCost = Number(h.avg_cost);
      const currentPrice: number | null = q?.price != null ? Number(q.price) : null;
      const currentValue = currentPrice != null ? shares * currentPrice : null;
      const costBasis = shares * avgCost;
      const gainLoss = currentValue != null ? currentValue - costBasis : null;
      const gainLossPct = costBasis > 0 && gainLoss != null ? (gainLoss / costBasis) * 100 : null;
      const annualDivTotal = shares * d.annualDiv;
      const yieldOnCost = avgCost > 0 ? (d.annualDiv / avgCost) * 100 : 0;
      const currentYield = currentPrice && currentPrice > 0 ? (d.annualDiv / currentPrice) * 100 : 0;

      return {
        ...h,
        company_name: h.company_name || (q?.name as string) || sym,
        current_price: currentPrice,
        current_value: currentValue,
        cost_basis: costBasis,
        gain_loss: gainLoss,
        gain_loss_pct: gainLossPct,
        annual_dividend_per_share: d.annualDiv,
        annual_dividend_total: annualDivTotal,
        monthly_dividend_estimate: annualDivTotal / 12,
        dividend_months: d.months,
        next_ex_date: d.nextExDate,
        yield_on_cost: yieldOnCost,
        current_yield: currentYield,
        change_pct: q?.changesPercentage != null ? Number(q.changesPercentage) : null,
      };
    });

    // 4. 포트폴리오 요약
    const totalCostBasis = enriched.reduce((s, h) => s + h.cost_basis, 0);
    const totalCurrentValue = enriched.reduce((s, h) => s + (h.current_value ?? h.cost_basis), 0);
    const totalAnnualDividend = enriched.reduce((s, h) => s + h.annual_dividend_total, 0);
    const totalGainLoss = totalCurrentValue - totalCostBasis;

    // 월별 배당 현금 흐름 (1~12월)
    const monthlyBreakdown: Record<number, number> = {};
    for (let m = 1; m <= 12; m++) monthlyBreakdown[m] = 0;
    for (const h of enriched) {
      if (h.dividend_months.length > 0) {
        const perPayment = h.annual_dividend_total / h.dividend_months.length;
        h.dividend_months.forEach((m: number) => {
          monthlyBreakdown[m] = (monthlyBreakdown[m] || 0) + perPayment;
        });
      }
    }

    res.json({
      holdings: enriched,
      summary: {
        total_cost_basis: totalCostBasis,
        total_current_value: totalCurrentValue,
        total_gain_loss: totalGainLoss,
        total_gain_loss_pct: totalCostBasis > 0 ? (totalGainLoss / totalCostBasis) * 100 : 0,
        total_annual_dividend: totalAnnualDividend,
        estimated_monthly_dividend: totalAnnualDividend / 12,
        monthly_breakdown: monthlyBreakdown,
        holdings_count: enriched.length,
      },
    });
  } catch (err) {
    logger.error(`[Portfolio] 실시간 조회 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '포트폴리오 실시간 조회 실패' });
  }
});

// ==========================================
// POST /api/portfolio
// 보유 종목 추가 (무료, upsert)
// ==========================================
router.post('/', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const { symbol, shares, avg_cost, currency = 'USD', asset_type = 'stock', memo, company_name } = req.body as {
      symbol: string;
      shares: number;
      avg_cost: number;
      currency?: string;
      asset_type?: string;
      memo?: string;
      company_name?: string;
    };

    if (!symbol || shares == null || avg_cost == null) {
      res.status(400).json({ error: 'symbol, shares, avg_cost는 필수입니다.' });
      return;
    }

    const sb = getSupabaseAdmin()!;

    // company_name이 없으면 FMP에서 자동 조회
    let finalName = company_name || null;
    if (!finalName) {
      try {
        const { data: qd } = await fmpClient.get(`/v3/quote/${symbol.toUpperCase()}`);
        if (Array.isArray(qd) && qd[0]?.name) finalName = qd[0].name as string;
      } catch { /* 실패 시 무시 */ }
    }

    const { data, error } = await sb
      .from('portfolio_holdings')
      .upsert({
        user_id: userId,
        symbol: symbol.toUpperCase(),
        company_name: finalName,
        shares: Number(shares),
        avg_cost: Number(avg_cost),
        currency,
        asset_type,
        memo: memo || null,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,symbol' })
      .select()
      .single();

    if (error) throw new Error(error.message);

    logger.info(`[Portfolio] 종목 추가: user=${userId}, symbol=${symbol.toUpperCase()}`);
    res.status(201).json({ holding: data });
  } catch (err) {
    logger.error(`[Portfolio] 종목 추가 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '종목 추가 실패' });
  }
});

// ==========================================
// PUT /api/portfolio/:id
// 보유 종목 수정 (무료)
// ==========================================
router.put('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(String(req.params.id));
    const { shares, avg_cost, memo, company_name } = req.body as {
      shares?: number;
      avg_cost?: number;
      memo?: string;
      company_name?: string;
    };

    const sb = getSupabaseAdmin()!;
    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (shares !== undefined) updates.shares = Number(shares);
    if (avg_cost !== undefined) updates.avg_cost = Number(avg_cost);
    if (memo !== undefined) updates.memo = memo;
    if (company_name !== undefined) updates.company_name = company_name;

    const { data, error } = await sb
      .from('portfolio_holdings')
      .update(updates)
      .eq('id', id)
      .eq('user_id', userId)
      .select()
      .single();

    if (error) throw new Error(error.message);

    logger.info(`[Portfolio] 종목 수정: user=${userId}, id=${id}`);
    res.json({ holding: data });
  } catch (err) {
    logger.error(`[Portfolio] 종목 수정 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '종목 수정 실패' });
  }
});

// ==========================================
// DELETE /api/portfolio/:id
// 보유 종목 삭제 (무료)
// ==========================================
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const id = parseInt(String(req.params.id));

    const sb = getSupabaseAdmin()!;
    const { error } = await sb
      .from('portfolio_holdings')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);

    if (error) throw new Error(error.message);

    logger.info(`[Portfolio] 종목 삭제: user=${userId}, id=${id}`);
    res.json({ success: true });
  } catch (err) {
    logger.error(`[Portfolio] 종목 삭제 실패: ${(err as Error).message}`);
    res.status(500).json({ error: '종목 삭제 실패' });
  }
});

// ==========================================
// GET /api/portfolio/esg-score
// 보유 종목 ESG 종합점수 (무료, 캐싱 없음)
// ==========================================
router.get('/esg-score', async (req: Request, res: Response) => {
  try {
    const userId = req.user!.id;
    const sb = getSupabaseAdmin();
    if (!sb) { res.status(503).json({ error: 'Supabase 미설정' }); return; }

    const { data: holdings, error } = await sb
      .from('portfolio_holdings')
      .select('symbol, company_name, shares, current_price')
      .eq('user_id', userId);

    if (error || !holdings || holdings.length === 0) {
      res.json({ compositeScore: null, breakdown: [], coverage: 0, message: '보유 종목 없음' });
      return;
    }

    // ESG 데이터 병렬 조회
    const esgResults = await Promise.allSettled(
      holdings.map(async (h: { symbol: string; company_name: string; shares: number; current_price: number }) => {
        try {
          const { data } = await fmpClient.get<Array<{
            symbol: string;
            environmentalScore: number;
            socialScore: number;
            governanceScore: number;
            ESGScore: number;
            companyName: string;
          }>>(`/esg-environmental-social-governance-data?symbol=${h.symbol}`);
          if (!data || data.length === 0) return null;
          const latest = data[0];
          return {
            symbol: h.symbol,
            name: h.company_name,
            shares: h.shares,
            currentPrice: h.current_price,
            environmental: latest.environmentalScore ?? null,
            social: latest.socialScore ?? null,
            governance: latest.governanceScore ?? null,
            total: latest.ESGScore ?? null,
          };
        } catch {
          return null;
        }
      })
    );

    const breakdown: Array<{
      symbol: string;
      name: string;
      environmental: number | null;
      social: number | null;
      governance: number | null;
      total: number | null;
      weight: number;
    }> = [];

    // 시가총액(보유금액) 기준 가중평균
    const totalValue = holdings.reduce(
      (sum: number, h: { shares: number; current_price: number }) => sum + (h.shares * (h.current_price ?? 0)), 0
    );

    let weightedScore = 0;
    // 각 차원별 가중합 + 해당 차원 데이터가 있는 종목의 weight 합산 (정규화용)
    let weightedE = 0, coveredWeightE = 0;
    let weightedS = 0, coveredWeightS = 0;
    let weightedG = 0, coveredWeightG = 0;
    let coveredValue = 0;

    esgResults.forEach((result) => {
      if (result.status === 'fulfilled' && result.value) {
        const item = result.value;
        const itemValue = item.shares * (item.currentPrice ?? 0);
        const weight = totalValue > 0 ? itemValue / totalValue : 1 / holdings.length;

        breakdown.push({
          symbol: item.symbol,
          name: item.name,
          environmental: item.environmental,
          social: item.social,
          governance: item.governance,
          total: item.total,
          weight: Math.round(weight * 1000) / 10, // %
        });

        if (item.total != null) {
          weightedScore += item.total * weight;
          coveredValue += itemValue;
        }
        // 각 차원별로 데이터 있는 종목만 가중합 + 해당 weight 누적 (정규화 분모)
        if (item.environmental != null) { weightedE += item.environmental * weight; coveredWeightE += weight; }
        if (item.social != null)        { weightedS += item.social * weight;        coveredWeightS += weight; }
        if (item.governance != null)    { weightedG += item.governance * weight;    coveredWeightG += weight; }
      }
    });

    const coverage = totalValue > 0 ? Math.round((coveredValue / totalValue) * 100) : 0;

    // ESG 등급 산출 (0~100 기준)
    const deriveRating = (score: number): string => {
      if (score >= 85) return 'AAA';
      if (score >= 75) return 'AA';
      if (score >= 65) return 'A';
      if (score >= 55) return 'BBB';
      if (score >= 45) return 'BB';
      if (score >= 35) return 'B';
      return 'CCC';
    };

    // 종합 점수: 커버된 value 기준으로 정규화
    const coveredWeight = totalValue > 0 ? coveredValue / totalValue : 0;
    const compositeScore = coveredWeight > 0
      ? Math.round((weightedScore / coveredWeight) * 10) / 10
      : null;

    // E/S/G 개별 점수: 각 차원별 데이터 있는 종목의 weight 합으로 정규화
    const normalizedE = coveredWeightE > 0 ? Math.round((weightedE / coveredWeightE) * 10) / 10 : 0;
    const normalizedS = coveredWeightS > 0 ? Math.round((weightedS / coveredWeightS) * 10) / 10 : 0;
    const normalizedG = coveredWeightG > 0 ? Math.round((weightedG / coveredWeightG) * 10) / 10 : 0;

    res.json({
      compositeScore,
      compositeRating: compositeScore != null ? deriveRating(compositeScore) : null,
      environmental: normalizedE,
      social: normalizedS,
      governance: normalizedG,
      coverage,
      breakdown: breakdown.sort((a, b) => (b.total ?? 0) - (a.total ?? 0)),
      totalHoldings: holdings.length,
    });
  } catch (err) {
    logger.error('ESG score error', err);
    res.status(500).json({ error: 'ESG 점수 조회 실패' });
  }
});

function buildEmptySummary() {
  return {
    total_cost_basis: 0,
    total_current_value: 0,
    total_gain_loss: 0,
    total_gain_loss_pct: 0,
    total_annual_dividend: 0,
    estimated_monthly_dividend: 0,
    monthly_breakdown: Object.fromEntries(Array.from({ length: 12 }, (_, i) => [i + 1, 0])),
    holdings_count: 0,
  };
}

export default router;
