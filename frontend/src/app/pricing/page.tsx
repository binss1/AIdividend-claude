'use client';

import { useState, Fragment } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';

// ==========================================
// Data
// ==========================================

const PLANS = [
  {
    id: 'free',
    name: 'Free',
    nameKr: '무료 체험',
    price: 0,
    priceLabel: '무료',
    credits: 30,
    screeningEst: '배당주 ~10종목 또는 ETF ~30종목',
    popular: false,
    features: [
      { text: '배당주/ETF 스크리닝', included: true },
      { text: '결과 상위 5개만 표시', included: true, note: '제한' },
      { text: '종목 상세 조회', included: false },
      { text: '포트폴리오 추천 (균형형 1개)', included: true },
      { text: '포트폴리오 시뮬레이터', included: false },
      { text: '배당 캘린더', included: false },
      { text: '이력 보관 3일', included: true },
      { text: '엑셀 내보내기', included: false },
    ],
  },
  {
    id: 'starter',
    name: 'Starter',
    nameKr: '입문자',
    price: 9900,
    priceLabel: '₩9,900',
    credits: 500,
    screeningEst: '배당주 ~166종목 또는 ETF ~500종목',
    popular: false,
    features: [
      { text: '배당주/ETF 스크리닝', included: true },
      { text: '결과 전체 표시', included: true },
      { text: '종목 상세 조회', included: true },
      { text: '포트폴리오 추천 (3개 비교)', included: true },
      { text: '포트폴리오 시뮬레이터', included: true },
      { text: '배당 캘린더', included: true },
      { text: '이력 보관 30일', included: true },
      { text: '엑셀 내보내기', included: true },
    ],
  },
  {
    id: 'pro',
    name: 'Pro',
    nameKr: '개인 투자자',
    price: 29900,
    priceLabel: '₩29,900',
    credits: 2000,
    screeningEst: '배당주 ~666종목 또는 ETF ~2,000종목',
    popular: true,
    features: [
      { text: '배당주/ETF 스크리닝', included: true },
      { text: '결과 전체 표시', included: true },
      { text: '종목 상세 조회', included: true },
      { text: '포트폴리오 추천 (3개 비교)', included: true },
      { text: '포트폴리오 시뮬레이터', included: true },
      { text: '배당 캘린더', included: true },
      { text: '이력 보관 90일', included: true },
      { text: '엑셀 내보내기', included: true },
      { text: '내부자 거래 분석', included: true },
      { text: '기관투자자 보유 현황', included: true },
    ],
  },
  {
    id: 'premium',
    name: 'Premium',
    nameKr: '적극적 투자자',
    price: 59900,
    priceLabel: '₩59,900',
    credits: 5000,
    screeningEst: '배당주 ~1,666종목 또는 ETF ~5,000종목',
    popular: false,
    features: [
      { text: '배당주/ETF 스크리닝', included: true },
      { text: '결과 전체 표시', included: true },
      { text: '종목 상세 조회', included: true },
      { text: '포트폴리오 추천 (3개 비교)', included: true },
      { text: '포트폴리오 시뮬레이터', included: true },
      { text: '배당 캘린더', included: true },
      { text: '이력 보관 무제한', included: true },
      { text: '엑셀 내보내기', included: true },
      { text: '내부자 거래 분석', included: true },
      { text: '기관투자자 보유 현황', included: true },
      { text: '소셜 감성 분석', included: true },
      { text: '실시간 알림 (이메일/텔레그램)', included: true },
    ],
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    nameKr: '전문 투자자/기관',
    price: 99900,
    priceLabel: '₩99,900',
    credits: -1, // unlimited
    screeningEst: '무제한',
    popular: false,
    features: [
      { text: 'Premium 전체 기능 포함', included: true },
      { text: '크레딧 무제한', included: true },
      { text: 'API 직접 접근', included: true },
      { text: '전담 지원', included: true },
    ],
  },
];

const CREDIT_TABLE = [
  { feature: '배당주 스크리닝', credits: '3 크레딧 / 종목', apiCalls: 'API 9회 (프로필, 시세, 배당, 재무제표 5종, 성장지표, 핵심지표)', example: '100종목 = 300 크레딧' },
  { feature: 'ETF 스크리닝', credits: '1 크레딧 / 종목', apiCalls: 'API 3회 (프로필, ETF정보, 보유종목)', example: '200종목 = 200 크레딧' },
  { feature: '배당주 상세 조회', credits: '5 크레딧 / 종목', apiCalls: 'API 15회 (기본7 + DCF, 투자등급, 목표가, 유사종목, 내부자, 기관, 감성, 추정치)', example: '10종목 = 50 크레딧' },
  { feature: 'ETF 상세 조회', credits: '1 크레딧 / 종목', apiCalls: 'API 3회 (프로필, ETF정보, 보유종목)', example: '10종목 = 10 크레딧' },
  { feature: '포트폴리오 시뮬레이션', credits: '1 크레딧 / 보유종목', apiCalls: 'API 1+N회 (배치시세 + 종목별 배당이력)', example: '5종목 = 5 크레딧' },
  { feature: '포트폴리오 추천', credits: '0 (무료)', apiCalls: '서버 내부 계산만 (API 호출 없음)', example: '-' },
  { feature: '이력 조회', credits: '0 (무료)', apiCalls: '데이터베이스 조회만 (API 호출 없음)', example: '-' },
  { feature: '대시보드', credits: '2 크레딧 / 로드', apiCalls: 'API 7회 (시장지수4, 섹터1, 캘린더1, 뉴스1)', example: '일 1회 = 월 60 크레딧' },
  { feature: '배당 캘린더', credits: '3 크레딧 / 조회', apiCalls: 'API ~11회 (캘린더1 + 시세 배치~10)', example: '주 1회 = 월 12 크레딧' },
];

const ADDON_CREDITS = [
  { amount: 100, price: 2900, perCredit: 29, discount: null },
  { amount: 500, price: 12900, perCredit: 25.8, discount: '₩1,400 할인' },
  { amount: 1000, price: 23900, perCredit: 23.9, discount: '₩5,100 할인' },
];

const COMPARE_FEATURES = [
  { category: '스크리닝', features: [
    { name: '배당주 스크리닝', free: '✅', starter: '✅', pro: '✅', premium: '✅', enterprise: '✅' },
    { name: 'ETF 스크리닝', free: '✅', starter: '✅', pro: '✅', premium: '✅', enterprise: '✅' },
    { name: '결과 표시', free: '상위 5개', starter: '전체', pro: '전체', premium: '전체', enterprise: '전체' },
  ]},
  { category: '분석', features: [
    { name: '종목 상세 조회', free: '—', starter: '✅', pro: '✅', premium: '✅', enterprise: '✅' },
    { name: '내부자 거래', free: '—', starter: '—', pro: '✅', premium: '✅', enterprise: '✅' },
    { name: '기관투자자 보유', free: '—', starter: '—', pro: '✅', premium: '✅', enterprise: '✅' },
    { name: '소셜 감성 분석', free: '—', starter: '—', pro: '—', premium: '✅', enterprise: '✅' },
    { name: '애널리스트 추정치', free: '—', starter: '—', pro: '✅', premium: '✅', enterprise: '✅' },
  ]},
  { category: '도구', features: [
    { name: '포트폴리오 추천', free: '1개', starter: '3개', pro: '3개', premium: '3개', enterprise: '3개' },
    { name: '포트폴리오 시뮬레이터', free: '—', starter: '✅', pro: '✅', premium: '✅', enterprise: '✅' },
    { name: '배당 캘린더', free: '—', starter: '✅', pro: '✅', premium: '✅', enterprise: '✅' },
    { name: '엑셀 내보내기', free: '—', starter: '✅', pro: '✅', premium: '✅', enterprise: '✅' },
  ]},
  { category: '기타', features: [
    { name: '이력 보관', free: '3일', starter: '30일', pro: '90일', premium: '무제한', enterprise: '무제한' },
    { name: '실시간 알림', free: '—', starter: '—', pro: '—', premium: '✅', enterprise: '✅' },
    { name: 'API 접근', free: '—', starter: '—', pro: '—', premium: '—', enterprise: '✅' },
    { name: '전담 지원', free: '—', starter: '—', pro: '—', premium: '—', enterprise: '✅' },
  ]},
];

const FAQS = [
  { q: '크레딧이란 무엇인가요?', a: '크레딧은 AI Dividend의 모든 유료 기능을 사용할 때 차감되는 포인트입니다. 실제 금융 데이터 API 호출 비용을 기반으로 산정되었으며, 기능별로 차감량이 다릅니다.' },
  { q: '크레딧이 부족하면 어떻게 되나요?', a: '크레딧이 부족하면 해당 기능 실행 전에 안내 메시지가 표시됩니다. 추가 크레딧을 구매하거나 상위 플랜으로 업그레이드할 수 있습니다. 무료 기능(포트폴리오 추천, 이력 조회)은 크레딧 없이도 사용 가능합니다.' },
  { q: '미사용 크레딧은 이월되나요?', a: '미사용 크레딧은 다음 달로 이월되지 않습니다. 매월 결제일에 새로운 크레딧이 부여됩니다. 단, 별도 구매한 추가 크레딧은 6개월간 유효합니다.' },
  { q: '플랜을 변경할 수 있나요?', a: '언제든지 상위 또는 하위 플랜으로 변경할 수 있습니다. 상위 플랜으로 변경 시 차액이 즉시 청구되고, 하위 플랜은 다음 결제일부터 적용됩니다.' },
  { q: '환불이 가능한가요?', a: '결제 후 7일 이내, 크레딧 사용량이 10% 미만인 경우 전액 환불이 가능합니다. 그 이후에는 미사용 크레딧에 대해 비례 환불됩니다.' },
  { q: '스크리닝 1회에 얼마나 크레딧이 드나요?', a: '배당주 스크리닝은 종목당 3크레딧, ETF는 종목당 1크레딧입니다. 예를 들어 배당주 100종목 스크리닝 = 300크레딧, ETF 200종목 = 200크레딧입니다. 스크리닝 시작 전 예상 소모 크레딧이 표시됩니다.' },
  { q: 'Enterprise 플랜은 어떻게 신청하나요?', a: '별도 문의를 통해 맞춤 계약을 진행합니다. API 직접 접근, 대량 데이터 처리, 전담 기술 지원이 포함됩니다.' },
];

// ==========================================
// Page Component
// ==========================================

export default function PricingPage() {
  const router = useRouter();
  const [billingPeriod, setBillingPeriod] = useState<'monthly' | 'annual'>('monthly');
  const [openFaq, setOpenFaq] = useState<number | null>(null);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-100">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 space-y-16">

        {/* Hero */}
        <div className="text-center space-y-4">
          <h1 className="text-3xl sm:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-teal-300 bg-clip-text text-transparent">
            투자의 시작, 합리적인 가격으로
          </h1>
          <p className="text-zinc-400 max-w-2xl mx-auto">
            실제 금융 데이터 API 비용을 기반으로 설계된 투명한 크레딧 시스템.
            필요한 만큼만 사용하고, 언제든 업그레이드하세요.
          </p>
          <div className="flex items-center justify-center gap-3 mt-6">
            <button onClick={() => setBillingPeriod('monthly')}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${billingPeriod === 'monthly' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-zinc-400 border border-zinc-700'}`}>
              월간 결제
            </button>
            <button onClick={() => setBillingPeriod('annual')}
              className={`px-4 py-2 text-sm rounded-lg transition-all ${billingPeriod === 'annual' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40' : 'text-zinc-400 border border-zinc-700'}`}>
              연간 결제 <span className="text-emerald-400 text-xs ml-1">20% 할인</span>
            </button>
          </div>
        </div>

        {/* Pricing Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {PLANS.map(plan => {
            const displayPrice = billingPeriod === 'annual' && plan.price > 0
              ? Math.round(plan.price * 0.8)
              : plan.price;
            const displayPriceLabel = plan.price === 0
              ? '무료'
              : `₩${displayPrice.toLocaleString()}`;

            return (
              <div key={plan.id}
                className={`relative rounded-2xl border p-5 flex flex-col transition-all hover:scale-[1.02] hover:shadow-xl ${
                  plan.popular
                    ? 'border-emerald-500/50 bg-emerald-500/5 shadow-lg shadow-emerald-500/10'
                    : 'border-zinc-800/80 bg-zinc-900/60'
                }`}>
                {plan.popular && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 px-3 py-1 rounded-full text-xs font-bold bg-emerald-500 text-white">
                    추천
                  </div>
                )}
                <div className="mb-4">
                  <h3 className="text-lg font-bold text-white">{plan.name}</h3>
                  <p className="text-xs text-zinc-500">{plan.nameKr}</p>
                </div>
                <div className="mb-4">
                  <span className="text-2xl font-bold text-white">{displayPriceLabel}</span>
                  {plan.price > 0 && <span className="text-xs text-zinc-500"> /월</span>}
                </div>
                <div className="mb-4 p-2.5 rounded-lg bg-zinc-800/50">
                  <p className="text-xs text-zinc-400">월 크레딧</p>
                  <p className="text-lg font-bold text-emerald-400">
                    {plan.credits === -1 ? '무제한' : `${plan.credits.toLocaleString()}`}
                  </p>
                  <p className="text-[10px] text-zinc-500 mt-0.5">{plan.screeningEst}</p>
                </div>
                <ul className="space-y-2 flex-1 mb-4">
                  {plan.features.map((f, i) => (
                    <li key={i} className="flex items-start gap-2 text-xs">
                      {f.included ? (
                        <svg className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4 text-zinc-600 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      )}
                      <span className={f.included ? 'text-zinc-300' : 'text-zinc-600'}>{f.text}</span>
                    </li>
                  ))}
                </ul>
                <button
                  onClick={() => plan.price === 0 ? router.push('/screening') : router.push(`/checkout?plan=${plan.id}`)}
                  className={`w-full py-2.5 rounded-xl text-sm font-semibold transition-all ${
                  plan.popular
                    ? 'bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20'
                    : plan.price === 0
                      ? 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'
                      : 'bg-zinc-800 text-white hover:bg-zinc-700 border border-zinc-700'
                }`}>
                  {plan.price === 0 ? '무료로 시작' : '구매하기'}
                </button>
              </div>
            );
          })}
        </div>

        {/* Credit Deduction Table */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">크레딧 차감 체계</h2>
            <p className="text-sm text-zinc-400 mt-2">각 기능별 크레딧 소모량과 실제 API 호출 근거</p>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-900/90">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">기능</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">크레딧 차감</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">API 호출 근거</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500">사용 예시</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/40">
                  {CREDIT_TABLE.map((row, i) => (
                    <tr key={i} className="hover:bg-zinc-800/20">
                      <td className="px-4 py-3 text-white font-medium">{row.feature}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-bold ${
                          row.credits === '0 (무료)' ? 'bg-emerald-500/15 text-emerald-400' : 'bg-amber-500/15 text-amber-400'
                        }`}>
                          {row.credits}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-zinc-400 text-xs max-w-[300px]">{row.apiCalls}</td>
                      <td className="px-4 py-3 text-zinc-500 text-xs">{row.example}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* Add-on Credits */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">추가 크레딧 구매</h2>
            <p className="text-sm text-zinc-400 mt-2">월 크레딧이 부족할 때 필요한 만큼 추가 구매 (6개월 유효)</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {ADDON_CREDITS.map((pkg, i) => (
              <div key={i} className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 p-5 text-center hover:border-zinc-700 transition-all">
                <p className="text-2xl font-bold text-white">{pkg.amount.toLocaleString()}</p>
                <p className="text-xs text-zinc-500">크레딧</p>
                <p className="text-lg font-bold text-emerald-400 mt-3">₩{pkg.price.toLocaleString()}</p>
                <p className="text-[10px] text-zinc-500 mt-1">크레딧당 ₩{pkg.perCredit.toFixed(1)}</p>
                {pkg.discount && (
                  <p className="text-[10px] text-amber-400 mt-1">{pkg.discount}</p>
                )}
                <button
                  onClick={() => router.push(`/checkout?plan=credit-${pkg.amount}`)}
                  className="w-full mt-3 py-2 rounded-lg text-xs font-medium bg-zinc-800 text-zinc-300 hover:bg-zinc-700 transition-colors">
                  구매하기
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Full Comparison Table */}
        <section className="space-y-6">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">플랜 비교</h2>
            <p className="text-sm text-zinc-400 mt-2">전체 기능 비교표</p>
          </div>
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-zinc-800/80 bg-zinc-900/90">
                    <th className="px-4 py-3 text-left text-xs font-medium text-zinc-500 w-40">기능</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-zinc-500">Free</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-zinc-500">Starter</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-emerald-400 font-bold">Pro</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-zinc-500">Premium</th>
                    <th className="px-3 py-3 text-center text-xs font-medium text-zinc-500">Enterprise</th>
                  </tr>
                </thead>
                <tbody>
                  {COMPARE_FEATURES.map((cat) => (
                    <Fragment key={cat.category}>
                      <tr className="bg-zinc-800/20">
                        <td colSpan={6} className="px-4 py-2 text-xs font-bold text-zinc-400 uppercase tracking-wider">{cat.category}</td>
                      </tr>
                      {cat.features.map((f, i) => (
                        <tr key={`${cat.category}-${i}`} className="border-t border-zinc-800/30 hover:bg-zinc-800/10">
                          <td className="px-4 py-2.5 text-zinc-300 text-xs">{f.name}</td>
                          <td className="px-3 py-2.5 text-center text-xs">{renderCell(f.free)}</td>
                          <td className="px-3 py-2.5 text-center text-xs">{renderCell(f.starter)}</td>
                          <td className="px-3 py-2.5 text-center text-xs bg-emerald-500/[0.02]">{renderCell(f.pro)}</td>
                          <td className="px-3 py-2.5 text-center text-xs">{renderCell(f.premium)}</td>
                          <td className="px-3 py-2.5 text-center text-xs">{renderCell(f.enterprise)}</td>
                        </tr>
                      ))}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* FAQ */}
        <section className="space-y-6 max-w-3xl mx-auto">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">자주 묻는 질문</h2>
          </div>
          <div className="space-y-2">
            {FAQS.map((faq, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden">
                <button
                  onClick={() => setOpenFaq(openFaq === i ? null : i)}
                  className="w-full flex items-center justify-between px-5 py-4 hover:bg-zinc-800/30 transition-colors"
                >
                  <span className="text-sm text-white text-left">{faq.q}</span>
                  <svg className={`w-4 h-4 text-zinc-400 transition-transform shrink-0 ml-3 ${openFaq === i ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {openFaq === i && (
                  <div className="px-5 pb-4 text-sm text-zinc-400 leading-relaxed">
                    {faq.a}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>

        {/* Bottom CTA */}
        <section className="text-center py-8">
          <h2 className="text-xl font-bold text-white mb-3">지금 무료로 시작하세요</h2>
          <p className="text-sm text-zinc-400 mb-6">신용카드 없이 30 크레딧으로 AI 배당 분석을 체험해 보세요</p>
          <div className="flex items-center justify-center gap-3">
            <Link href="/screening"
              className="px-6 py-3 rounded-xl font-semibold text-sm bg-gradient-to-r from-emerald-500 to-teal-500 text-white hover:from-emerald-400 hover:to-teal-400 shadow-lg shadow-emerald-500/20 transition-all">
              배당주 스크리닝 시작
            </Link>
            <Link href="/etf-screening"
              className="px-6 py-3 rounded-xl font-semibold text-sm border border-zinc-700 text-zinc-300 hover:bg-zinc-800 transition-all">
              ETF 스크리닝 시작
            </Link>
          </div>
        </section>
      </div>
    </div>
  );
}

function renderCell(value: string) {
  if (value === '✅') return <span className="text-emerald-400">✓</span>;
  if (value === '—') return <span className="text-zinc-600">—</span>;
  return <span className="text-zinc-400">{value}</span>;
}
