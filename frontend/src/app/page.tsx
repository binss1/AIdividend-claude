import Link from 'next/link';
import Image from 'next/image';

/* ────────────────────────────────────────
   Static Data
   ──────────────────────────────────────── */

const stats = [
  { value: '500+', label: '분석 가능 종목', icon: '📊' },
  { value: '5축', label: '다차원 평가', icon: '🎯' },
  { value: '실시간', label: '시장 데이터', icon: '⚡' },
  { value: 'A+ ~ F', label: '등급 시스템', icon: '🏆' },
];

const whyDividend = [
  {
    icon: '💰',
    title: '매달 들어오는 현금흐름',
    desc: '배당주는 주가 상승과 별개로 정기적인 현금 수입을 제공합니다. 월세처럼 매 분기 계좌에 입금되는 배당금은 진정한 패시브 인컴입니다.',
  },
  {
    icon: '📈',
    title: '복리의 마법',
    desc: '받은 배당금을 재투자하면 보유 주식 수가 늘어나고, 더 많은 배당금을 받게 됩니다. 10년, 20년 후 눈덩이처럼 불어나는 자산을 경험하세요.',
  },
  {
    icon: '🛡️',
    title: '하락장에서의 안전판',
    desc: '배당을 꾸준히 지급하는 기업은 재무가 탄탄합니다. 시장이 흔들릴 때에도 배당 수입이 손실을 완충하며, 역사적으로 배당주는 비배당주 대비 변동성이 30% 낮습니다.',
  },
  {
    icon: '🏦',
    title: '은행 이자의 3~5배',
    desc: '미국 우량 배당주의 평균 수익률은 3~7%. 한국 예금 금리의 2~4배에 달하며, 배당 성장까지 고려하면 실질 수익률은 더욱 높습니다.',
  },
];

const stockSteps = [
  {
    step: '01',
    title: '유니버스 구성',
    desc: 'S&P 500 + NASDAQ 상장 종목에서 배당 지급 기업만 추출하고 중복을 제거합니다.',
    detail: '최소 배당수익률, 시가총액, 배당성향 조건으로 1차 필터링',
    icon: '🔍',
    color: 'emerald',
  },
  {
    step: '02',
    title: '5축 정밀 분석',
    desc: '통과한 종목을 안정성·수익성·성장성·가치·배당 5가지 축으로 점수를 산정합니다.',
    detail: '안정성 30% | 수익성 20% | 성장성 15% | 가치 15% | 배당 20%',
    icon: '📐',
    color: 'teal',
  },
  {
    step: '03',
    title: 'REIT 특별 평가',
    desc: 'REIT 종목은 일반 기업과 다른 AFFO 기반 배당성향으로 재평가합니다.',
    detail: '50+ REIT 티커 자동 인식, 섹터/산업 기반 이중 검증',
    icon: '🏢',
    color: 'cyan',
  },
  {
    step: '04',
    title: '등급 부여 & 정렬',
    desc: '종합 점수에 따라 A+~F 등급을 부여하고, 점수순으로 최종 결과를 제공합니다.',
    detail: '동점 시 배당수익률 높은 종목 우선, Excel 내보내기 지원',
    icon: '🏅',
    color: 'emerald',
  },
];

const etfSteps = [
  {
    letter: 'Q',
    title: 'Quality',
    desc: '운용사 신뢰도, 운용 기간, 추적 오차',
    bg: 'rgba(16,185,129,0.15)',
    ring: 'rgba(16,185,129,0.3)',
    text: '#34d399',
    barColor: '#10b981',
    pct: 25,
  },
  {
    letter: 'L',
    title: 'Liquidity',
    desc: 'AUM 규모, 일평균 거래량, 유동성',
    bg: 'rgba(20,184,166,0.15)',
    ring: 'rgba(20,184,166,0.3)',
    text: '#2dd4bf',
    barColor: '#14b8a6',
    pct: 25,
  },
  {
    letter: 'E',
    title: 'Exposure',
    desc: '보유 종목 분산도, 섹터 집중도, Beta',
    bg: 'rgba(6,182,212,0.15)',
    ring: 'rgba(6,182,212,0.3)',
    text: '#22d3ee',
    barColor: '#06b6d4',
    pct: 25,
  },
  {
    letter: 'D',
    title: 'Dividend',
    desc: '배당수익률, 분배 성장률, 운용보수',
    bg: 'rgba(245,158,11,0.15)',
    ring: 'rgba(245,158,11,0.3)',
    text: '#fbbf24',
    barColor: '#f59e0b',
    pct: 25,
  },
];

const comparisonData = [
  { metric: '연 수익률 (10년 평균)', savings: '2~3%', dividend: '6~10%+', winner: 'dividend' },
  { metric: '인플레이션 방어', savings: '❌ 실질 손실', dividend: '✅ 배당 성장', winner: 'dividend' },
  { metric: '유동성', savings: '만기 제약', dividend: '언제든 매도', winner: 'dividend' },
  { metric: '복리 효과', savings: '제한적', dividend: '배당 재투자', winner: 'dividend' },
  { metric: '세금 혜택', savings: '이자소득세 15.4%', dividend: '배당소득세 15%', winner: 'tie' },
];

/* ────────────────────────────────────────
   Page Component
   ──────────────────────────────────────── */

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background ambient effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-[100px]" />
        <div className="absolute bottom-1/4 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-cyan-500/3 blur-[120px]" />
        {/* warm amber glow for dividend section */}
        <div className="absolute top-[1200px] right-1/4 h-[500px] w-[500px] rounded-full bg-amber-500/3 blur-[140px]" />
      </div>

      {/* ═══════════════════════════════════════
          HERO SECTION
          ═══════════════════════════════════════ */}
      <section className="relative px-4 pt-24 pb-16 sm:pt-32 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="grid items-center gap-12 lg:grid-cols-2">
            {/* Left: Text */}
            <div>
              {/* Badge */}
              <div className="animate-fade-in mb-6 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
                </span>
                AI 기반 배당 투자 플랫폼
              </div>

              {/* Title */}
              <h1 className="animate-fade-in stagger-1 text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
                <span className="text-white">당신의 월급 외</span>
                <br />
                <span className="text-gradient">두 번째 수입</span>
                <span className="text-white">을</span>
                <br />
                <span className="text-white">만들어 드립니다</span>
              </h1>

              {/* Subtitle */}
              <p className="animate-fade-in stagger-2 mt-6 max-w-lg text-lg leading-relaxed text-gray-400">
                500개 이상의 미국 배당주와 ETF를 AI가 <strong className="text-gray-300">5축 정밀 분석</strong>합니다.
                매월, 매 분기 배당금이 꾸준히 계좌에 들어오는 경험, 데이터로 시작하세요.
              </p>

              {/* Mini yield indicator */}
              <div className="animate-fade-in stagger-3 mt-6 inline-flex items-center gap-3 rounded-xl yield-highlight px-4 py-2.5">
                <span className="text-2xl">💵</span>
                <div>
                  <div className="text-sm text-gray-400">미국 배당주 평균 수익률</div>
                  <div className="text-xl font-bold text-emerald-400">3.5% ~ 7.0%</div>
                </div>
                <div className="ml-3 h-8 w-px bg-gray-700" />
                <div>
                  <div className="text-sm text-gray-400">한국 정기예금</div>
                  <div className="text-xl font-bold text-gray-500">2.5% ~ 3.5%</div>
                </div>
              </div>

              {/* CTA Buttons */}
              <div className="animate-fade-in stagger-4 mt-8 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/screening"
                  className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  배당주 스크리닝 시작
                  <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
                <Link
                  href="/etf-screening"
                  className="group relative inline-flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
                >
                  ETF 스크리닝 시작
                  <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </Link>
              </div>
            </div>

            {/* Right: Hero Image */}
            <div className="animate-fade-in stagger-3 hidden lg:block">
              <div className="relative rounded-2xl overflow-hidden animate-warm-glow shadow-2xl shadow-emerald-500/10">
                <Image
                  src="/images/hero-dividend.png"
                  alt="배당 투자 - HIGH DIVIDEND YIELD 7.1%"
                  width={640}
                  height={360}
                  className="w-full h-auto rounded-2xl"
                  priority
                />
                {/* Overlay gradient for seamless blend with dark theme */}
                <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
                <div className="absolute bottom-0 left-0 right-0 h-20 bg-gradient-to-t from-gray-950/80 to-transparent" />
                {/* Caption */}
                <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
                  <span className="text-xs text-gray-300/80">매 분기 계좌에 쌓이는 배당금</span>
                  <span className="rounded-full bg-emerald-500/20 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 backdrop-blur-sm">
                    DIVIDEND INCOME
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Mobile-only hero image */}
          <div className="mt-10 lg:hidden animate-fade-in stagger-4">
            <div className="relative rounded-2xl overflow-hidden shadow-xl shadow-emerald-500/10">
              <Image
                src="/images/hero-dividend.png"
                alt="배당 투자 - HIGH DIVIDEND YIELD 7.1%"
                width={640}
                height={360}
                className="w-full h-auto rounded-2xl"
              />
              <div className="absolute inset-0 rounded-2xl ring-1 ring-white/10" />
              <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-gray-950/80 to-transparent" />
              <div className="absolute bottom-2 left-3 right-3 flex items-center justify-between">
                <span className="text-xs text-gray-300/80">매 분기 계좌에 쌓이는 배당금</span>
                <span className="rounded-full bg-emerald-500/20 px-2 py-0.5 text-xs font-semibold text-emerald-400 backdrop-blur-sm">
                  DIVIDEND INCOME
                </span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STATS SECTION
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-12">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`animate-fade-in stagger-${i + 1} glass-card rounded-2xl p-5 text-center transition-all duration-300 hover:border-emerald-500/30 hover:scale-[1.02]`}
              >
                <div className="mb-1 text-2xl">{stat.icon}</div>
                <div className="text-2xl font-bold text-emerald-400 sm:text-3xl">{stat.value}</div>
                <div className="mt-1 text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          WHO NEEDS THIS - 이런 분께 꼭 필요합니다
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-20 border-t border-zinc-800/50">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
              🎯 이런 분께 꼭 필요합니다
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              당신의 <span className="text-gradient">재정 목표</span>에 맞는 배당 전략
            </h2>
            <p className="mt-3 text-zinc-400 text-sm max-w-2xl mx-auto">
              단순히 주식을 사고 파는 것이 아닙니다. 매달 통장에 들어오는 현금흐름을 설계합니다.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {[
              {
                emoji: '🏖️',
                title: '안정적인 월 생활비가 필요한 은퇴자',
                desc: '연금만으로 부족한 생활비를 매달 배당금으로 보충합니다. 원금을 건드리지 않고 현금흐름만으로 생활하는 구조를 만들어 드립니다.',
                highlight: '월 100만원 배당 = 약 3억 투자 (수익률 4% 기준)',
                color: 'emerald',
              },
              {
                emoji: '👨‍💼',
                title: '월급 외 제2의 수입을 원하는 직장인',
                desc: '매달 자동으로 들어오는 배당금으로 점심값, 통신비, 보험료를 충당합니다. 급여일 외에도 돈이 들어오는 경험을 시작하세요.',
                highlight: '월 50만원 배당 시작 → 재투자로 10년 후 월 150만원',
                color: 'blue',
              },
              {
                emoji: '👶',
                title: '자녀 학자금을 미리 준비하는 부모',
                desc: '10~15년 후 필요한 학자금을 배당 재투자로 복리 성장시킵니다. 시장 등락에 흔들리지 않는 안정적인 자산 증식 전략입니다.',
                highlight: '월 30만원 × 15년 재투자 = 약 1.2억 (배당성장 포함)',
                color: 'purple',
              },
              {
                emoji: '🏦',
                title: '예금 금리에 실망한 저축가',
                desc: '연 2~3% 예금 이자 vs 연 5~8% 배당수익률. 같은 돈을 넣어도 2~3배 더 많은 현금이 들어옵니다. 원금 손실 위험? AI가 안정적인 종목만 선별합니다.',
                highlight: '1억 예금 이자 250만원 vs 배당 500~800만원/년',
                color: 'amber',
              },
              {
                emoji: '📈',
                title: '투자는 하고 싶지만 주식이 어려운 초보',
                desc: '어떤 종목을 사야 할지 모르겠다면, AI가 5축 분석으로 A+~D등급을 매겨드립니다. 점수 높은 종목에 분산투자하면 됩니다.',
                highlight: '517개 종목 중 상위 A등급 10~20개만 자동 선별',
                color: 'teal',
              },
              {
                emoji: '🌍',
                title: '달러 자산으로 환율 리스크를 분산하려는 투자자',
                desc: '미국 배당주는 달러로 배당금을 지급합니다. 원화 가치 하락 시 오히려 배당금 가치가 올라가는 자연 헤지 효과를 얻습니다.',
                highlight: '환율 1,300원 → 1,500원 시 배당금 자동 15% 증가',
                color: 'cyan',
              },
            ].map((item, i) => {
              const colors: Record<string, string> = {
                emerald: 'border-emerald-500/20 hover:border-emerald-500/40',
                blue: 'border-blue-500/20 hover:border-blue-500/40',
                purple: 'border-purple-500/20 hover:border-purple-500/40',
                amber: 'border-amber-500/20 hover:border-amber-500/40',
                teal: 'border-teal-500/20 hover:border-teal-500/40',
                cyan: 'border-cyan-500/20 hover:border-cyan-500/40',
              };
              const highlightColors: Record<string, string> = {
                emerald: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
                blue: 'bg-blue-500/10 text-blue-400 border-blue-500/20',
                purple: 'bg-purple-500/10 text-purple-400 border-purple-500/20',
                amber: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
                teal: 'bg-teal-500/10 text-teal-400 border-teal-500/20',
                cyan: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20',
              };
              return (
                <div key={i} className={`rounded-2xl border bg-zinc-900/60 p-6 transition-all duration-300 hover:bg-zinc-900/80 ${colors[item.color]}`}>
                  <div className="text-3xl mb-3">{item.emoji}</div>
                  <h3 className="text-base font-bold text-white mb-2">{item.title}</h3>
                  <p className="text-sm text-zinc-400 leading-relaxed mb-4">{item.desc}</p>
                  <div className={`rounded-lg border px-3 py-2 text-xs ${highlightColors[item.color]}`}>
                    💰 {item.highlight}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          WHY US DIVIDENDS - 왜 미국 배당주인가?
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-20 border-t border-zinc-800/50">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-blue-500/20 bg-blue-500/10 px-4 py-1.5 text-sm text-blue-400">
              🇺🇸 왜 미국 배당주인가?
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              세계 최대 시장,{' '}
              <span className="text-gradient">가장 검증된 배당 역사</span>
            </h2>
            <p className="mt-3 text-zinc-400 text-sm max-w-2xl mx-auto">
              한국 주식시장과 비교할 수 없는 구조적 장점이 있습니다.
            </p>
          </div>

          {/* Comparison Table */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/60 overflow-hidden mb-10">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-zinc-800/80 bg-zinc-900/90">
                  <th className="px-5 py-3 text-left text-xs text-zinc-500">비교 항목</th>
                  <th className="px-5 py-3 text-center text-xs text-blue-400">🇺🇸 미국</th>
                  <th className="px-5 py-3 text-center text-xs text-zinc-500">🇰🇷 한국</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/40">
                {[
                  { item: '배당 문화', us: '주주환원 최우선 (50년+ 연속 증가 기업 다수)', kr: '배당 인색, 경영권 방어 우선' },
                  { item: '배당 빈도', us: '분기배당 기본, 월배당 ETF 풍부', kr: '연 1회 배당이 대부분' },
                  { item: '배당 성장', us: '매년 배당금 인상 (배당왕/귀족)', kr: '배당 삭감·중단 빈번' },
                  { item: '시장 규모', us: 'GDP 대비 시총 150%+, 글로벌 1위', kr: 'GDP 대비 시총 80%, 유동성 제한' },
                  { item: '통화 가치', us: '기축통화 달러, 인플레이션 헤지', kr: '원화 약세 추세, 구매력 하락' },
                  { item: '배당 과세', us: '15% 원천징수 (조세조약)', kr: '15.4% (종합소득세 합산 가능)' },
                  { item: '종목 수', us: '5,000+ 배당주, 500+ 배당 ETF', kr: '배당주 200개 미만' },
                ].map((row, i) => (
                  <tr key={i} className="hover:bg-zinc-800/20">
                    <td className="px-5 py-3 text-white font-medium">{row.item}</td>
                    <td className="px-5 py-3 text-center text-emerald-400 text-xs">{row.us}</td>
                    <td className="px-5 py-3 text-center text-zinc-500 text-xs">{row.kr}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Key Stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { value: '65+년', label: '최장 연속 배당 증가', sub: 'American States Water (AWR)', color: 'text-emerald-400' },
              { value: '500+개', label: '배당 귀족 후보 종목', sub: 'S&P500 중 25년+ 연속 증가', color: 'text-blue-400' },
              { value: '$1.7조', label: '2025 미국 배당금 총액', sub: '전 세계 배당금의 40% 차지', color: 'text-amber-400' },
              { value: '9.8%', label: '배당 재투자 연평균 수익률', sub: 'S&P500 배당 재투자 50년 기준', color: 'text-purple-400' },
            ].map((stat, i) => (
              <div key={i} className="rounded-xl border border-zinc-800/60 bg-zinc-900/40 p-5 text-center">
                <p className={`text-2xl font-bold ${stat.color}`}>{stat.value}</p>
                <p className="text-xs text-white font-medium mt-1">{stat.label}</p>
                <p className="text-[10px] text-zinc-500 mt-1">{stat.sub}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          WHY DIVIDEND INVESTING - 배당 투자의 이유
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-500/20 bg-amber-500/10 px-4 py-1.5 text-sm text-amber-400">
              💡 왜 배당 투자인가?
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              일하지 않아도 들어오는 돈,{' '}
              <span className="text-gradient">배당이 답입니다</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              월급은 시간을 팔아 버는 돈이지만, 배당금은 자산이 만들어내는 돈입니다.
              미국 우량 기업들은 수십 년째 배당금을 올려왔습니다.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            {whyDividend.map((item, i) => (
              <div
                key={item.title}
                className={`animate-fade-in stagger-${i + 1} glass-card-warm rounded-2xl p-6 transition-all duration-300 hover:border-amber-500/30 hover:scale-[1.01]`}
              >
                <div className="mb-3 flex items-center gap-3">
                  <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-500/10 text-2xl ring-1 ring-amber-500/20">
                    {item.icon}
                  </span>
                  <h3 className="text-lg font-semibold text-white">{item.title}</h3>
                </div>
                <p className="text-sm leading-relaxed text-gray-400">{item.desc}</p>
              </div>
            ))}
          </div>

          {/* Comparison Table: 예금 vs 배당투자 */}
          <div className="mt-12 glass-card rounded-2xl p-6 sm:p-8">
            <h3 className="mb-6 text-center text-xl font-bold text-white">
              🏦 정기예금 vs 💰 배당 투자 비교
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-700/50">
                    <th className="py-3 pr-4 text-left text-gray-400 font-medium">비교 항목</th>
                    <th className="py-3 px-4 text-center text-gray-400 font-medium">정기예금</th>
                    <th className="py-3 pl-4 text-center text-emerald-400 font-medium">배당 투자</th>
                  </tr>
                </thead>
                <tbody>
                  {comparisonData.map((row) => (
                    <tr key={row.metric} className="comparison-row border-b border-gray-800/50">
                      <td className="py-3 pr-4 text-gray-300">{row.metric}</td>
                      <td className="py-3 px-4 text-center text-gray-500">{row.savings}</td>
                      <td className={`py-3 pl-4 text-center font-medium ${row.winner === 'dividend' ? 'text-emerald-400' : 'text-gray-400'}`}>
                        {row.dividend}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          STOCK SCREENING - 배당주 선정 원리
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
              📊 배당주 스크리닝
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              좋은 배당주, <span className="text-gradient">이렇게 골라냅니다</span>
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              감에 의존하지 않습니다. 재무 데이터를 기반으로 4단계 정밀 프로세스를 거쳐
              안정적이고 성장하는 배당주만 선별합니다.
            </p>
          </div>

          {/* 4-Step Process */}
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            {stockSteps.map((s, i) => (
              <div
                key={s.step}
                className={`animate-fade-in stagger-${i + 1} group glass-card rounded-2xl p-6 transition-all duration-300 hover:border-emerald-500/30 relative`}
              >
                {/* Step number */}
                <div className="mb-4 flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/15 text-xl ring-1 ring-emerald-500/25">
                    {s.icon}
                  </div>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-500/60">Step {s.step}</span>
                </div>

                <h3 className="mb-2 text-lg font-semibold text-white group-hover:text-emerald-400 transition-colors">{s.title}</h3>
                <p className="mb-3 text-sm leading-relaxed text-gray-400">{s.desc}</p>
                <div className="rounded-lg bg-gray-800/50 px-3 py-2 text-xs text-gray-500">{s.detail}</div>

                {/* Arrow connector for larger screens */}
                {i < 3 && (
                  <div className="hidden lg:block absolute top-1/2 -right-3 text-emerald-500/30">
                    <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                    </svg>
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* 5-Axis Score Visualization */}
          <div className="mt-10 glass-card rounded-2xl p-6 sm:p-8">
            <h3 className="mb-6 text-center text-lg font-bold text-white">🎯 5축 종합 점수 체계</h3>
            <div className="grid gap-4 sm:grid-cols-5">
              {[
                { name: '안정성', weight: 30, bg: 'rgba(16,185,129,0.1)', ring: 'rgba(16,185,129,0.3)', text: '#34d399', desc: '배당 연속 지급, 일관성' },
                { name: '수익성', weight: 20, bg: 'rgba(20,184,166,0.1)', ring: 'rgba(20,184,166,0.3)', text: '#2dd4bf', desc: 'ROE, 영업이익률, FCF' },
                { name: '성장성', weight: 15, bg: 'rgba(6,182,212,0.1)', ring: 'rgba(6,182,212,0.3)', text: '#22d3ee', desc: '매출·이익·배당 성장률' },
                { name: '가치', weight: 15, bg: 'rgba(59,130,246,0.1)', ring: 'rgba(59,130,246,0.3)', text: '#60a5fa', desc: 'P/E, P/B, FCF 배당성향' },
                { name: '배당', weight: 20, bg: 'rgba(245,158,11,0.1)', ring: 'rgba(245,158,11,0.3)', text: '#fbbf24', desc: '수익률, 성장률, 지급주기' },
              ].map((axis) => (
                <div key={axis.name} className="text-center">
                  <div
                    className="mx-auto flex h-16 w-16 items-center justify-center rounded-full"
                    style={{ background: axis.bg, boxShadow: `0 0 0 2px ${axis.ring}` }}
                  >
                    <span className="text-xl font-bold" style={{ color: axis.text }}>{axis.weight}%</span>
                  </div>
                  <div className="mt-2 text-sm font-semibold text-white">{axis.name}</div>
                  <div className="mt-1 text-xs text-gray-500">{axis.desc}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          ETF SCREENING - Q-LEAD 원리
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-teal-500/20 bg-teal-500/10 px-4 py-1.5 text-sm text-teal-400">
              🧩 ETF 스크리닝
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              <span className="text-gradient">Q-LEAD</span> 모델로 ETF를 평가합니다
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-gray-400">
              Quality · Liquidity · Exposure · Dividend — 4개 축으로
              배당 ETF의 품질을 정량적으로 평가합니다. 개별 종목보다 분산 투자를 선호하는 분께 추천합니다.
            </p>
          </div>

          {/* Q-L-E-D Cards */}
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {etfSteps.map((s, i) => (
              <div
                key={s.letter}
                className={`animate-fade-in stagger-${i + 1} glass-card rounded-2xl p-6 text-center transition-all duration-300 hover:scale-[1.02]`}
                style={{ ['--hover-border' as string]: s.ring }}
              >
                {/* Letter circle */}
                <div
                  className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full"
                  style={{ background: s.bg, boxShadow: `0 0 0 2px ${s.ring}` }}
                >
                  <span className="text-2xl font-black" style={{ color: s.text }}>{s.letter}</span>
                </div>
                <h3 className="text-lg font-bold text-white">{s.title}</h3>
                <p className="mt-2 text-sm text-gray-400">{s.desc}</p>
                <div className="mt-3">
                  <div className="mx-auto h-1.5 w-20 overflow-hidden rounded-full bg-gray-800">
                    <div
                      className="h-full rounded-full"
                      style={{ width: `${s.pct}%`, background: s.barColor }}
                    />
                  </div>
                  <span className="mt-1 text-xs text-gray-500">배점 {s.pct}%</span>
                </div>
              </div>
            ))}
          </div>

          {/* Q-LEAD Formula */}
          <div className="mt-8 glass-card rounded-2xl px-6 py-5 text-center">
            <div className="flex flex-wrap items-center justify-center gap-2 text-sm sm:text-base">
              <span className="rounded-lg bg-emerald-500/15 px-3 py-1 font-bold text-emerald-400">Q</span>
              <span className="text-gray-600">+</span>
              <span className="rounded-lg bg-teal-500/15 px-3 py-1 font-bold text-teal-400">L</span>
              <span className="text-gray-600">+</span>
              <span className="rounded-lg bg-cyan-500/15 px-3 py-1 font-bold text-cyan-400">E</span>
              <span className="text-gray-600">+</span>
              <span className="rounded-lg bg-amber-500/15 px-3 py-1 font-bold text-amber-400">D</span>
              <span className="text-gray-600">=</span>
              <span className="rounded-lg bg-gradient-to-r from-emerald-500/20 to-teal-500/20 px-4 py-1 font-bold text-white ring-1 ring-emerald-500/30">
                Q-LEAD Score
              </span>
              <span className="ml-1 text-gray-500">(100점 만점)</span>
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          WHY REGULAR SCREENING - 정기 스크리닝이 수익을 만듭니다
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-20 border-t border-zinc-800/50">
        <div className="mx-auto max-w-6xl">
          <div className="mb-14 text-center">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-red-500/20 bg-red-500/10 px-4 py-1.5 text-sm text-red-400">
              ⚠️ 한 번 사고 끝? 배당주도 관리가 필요합니다
            </div>
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              정기 스크리닝이{' '}
              <span className="text-gradient">수익을 지킵니다</span>
            </h2>
            <p className="mt-3 text-zinc-400 text-sm max-w-2xl mx-auto">
              배당주는 &quot;사고 잊어버리는&quot; 투자가 아닙니다. 시장은 매일 변하고, 어제의 우량주가 내일의 배당 삭감 종목이 될 수 있습니다.
            </p>
          </div>

          {/* Timeline: What changes and why */}
          <div className="grid gap-6 lg:grid-cols-2 mb-10">
            {/* Left: 변화하는 것들 */}
            <div className="rounded-2xl border border-red-500/15 bg-zinc-900/60 p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-red-500/15 flex items-center justify-center text-sm">📉</span>
                방치하면 일어나는 일
              </h3>
              <div className="space-y-3">
                {[
                  { period: '매 분기', event: '실적 발표 후 배당 삭감/중단 가능', example: '2024년 인텔(INTC) 배당 66% 삭감' },
                  { period: '매 반기', event: '재무 건전성 변화 (부채 증가, 이익 감소)', example: 'AT&T(T) 2022년 배당 47% 삭감' },
                  { period: '매년', event: '섹터 로테이션으로 유망 섹터 변경', example: '금리 인상기: 리츠 약세 → 금융주 강세' },
                  { period: '수시', event: '경영진 변경, M&A, 규제 변화', example: '3M(MMM) 소송 이슈로 배당 성장 둔화' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 rounded-lg bg-zinc-800/30 p-3">
                    <span className="shrink-0 px-2 py-0.5 rounded bg-red-500/10 text-red-400 text-[10px] font-bold h-fit">{item.period}</span>
                    <div>
                      <p className="text-sm text-white">{item.event}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">사례: {item.example}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Right: 정기 스크리닝 효과 */}
            <div className="rounded-2xl border border-emerald-500/15 bg-zinc-900/60 p-6">
              <h3 className="text-base font-bold text-white mb-4 flex items-center gap-2">
                <span className="w-7 h-7 rounded-lg bg-emerald-500/15 flex items-center justify-center text-sm">📈</span>
                정기 스크리닝으로 지키는 수익
              </h3>
              <div className="space-y-3">
                {[
                  { action: '분기 1회 스크리닝', result: '배당 삭감 징후 사전 감지 → 손실 회피', benefit: '배당성향 85%↑ 종목 자동 경고' },
                  { action: '점수 변동 모니터링', result: '등급 하락 종목 교체 → 포트폴리오 품질 유지', benefit: 'A등급 → B등급 하락 시 대체 종목 추천' },
                  { action: '신규 고배당주 발굴', result: '새로운 기회 포착 → 수익률 개선', benefit: '매 분기 새로운 A+등급 종목 진입' },
                  { action: '섹터 리밸런싱', result: '시장 환경 변화에 적응 → 안정적 수익', benefit: '금리/경기 사이클에 맞는 섹터 비중 조절' },
                ].map((item, i) => (
                  <div key={i} className="flex gap-3 rounded-lg bg-zinc-800/30 p-3">
                    <span className="shrink-0 px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400 text-[10px] font-bold h-fit">{item.action}</span>
                    <div>
                      <p className="text-sm text-white">{item.result}</p>
                      <p className="text-[11px] text-zinc-500 mt-0.5">{item.benefit}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Bottom: 권장 스크리닝 주기 */}
          <div className="rounded-2xl border border-zinc-800/80 bg-zinc-900/40 p-6">
            <h3 className="text-sm font-bold text-white mb-4 text-center">권장 스크리닝 주기</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {[
                { freq: '매주', target: '보유 종목 시세/뉴스 체크', icon: '📋', color: 'text-zinc-400' },
                { freq: '매월', target: '배당 캘린더 확인 + 배당락일 관리', icon: '📅', color: 'text-blue-400' },
                { freq: '매 분기', target: '전체 스크리닝 + 포트폴리오 리밸런싱', icon: '🔄', color: 'text-emerald-400' },
                { freq: '매 반기', target: '투자 전략 재검토 + 신규 ETF 탐색', icon: '🎯', color: 'text-amber-400' },
              ].map((item, i) => (
                <div key={i} className="rounded-xl bg-zinc-800/40 p-4 text-center">
                  <div className="text-2xl mb-2">{item.icon}</div>
                  <p className={`text-sm font-bold ${item.color}`}>{item.freq}</p>
                  <p className="text-[11px] text-zinc-500 mt-1">{item.target}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          FEATURES SECTION
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">핵심 기능</h2>
            <p className="mt-3 text-gray-400">데이터 기반 배당 투자의 모든 것을 한 곳에서</p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                title: '배당주 스크리닝',
                description: 'S&P500 + NASDAQ 전체 배당주를 5축 모델로 분석하고, A+~F 등급을 부여하여 최적의 종목을 선별합니다.',
                href: '/demo/screening',
                icon: '📊',
              },
              {
                title: 'ETF 스크리닝',
                description: 'Q-LEAD 모델로 배당 ETF를 품질·유동성·노출도·배당 4개 축으로 정밀 평가합니다.',
                href: '/demo/etf-screening',
                icon: '🧩',
              },
              {
                title: '종목 상세 분석',
                description: 'DCF 적정가, 애널리스트 목표가, 내부자 거래, 기관 보유현황, 소셜 감성까지 한 페이지에서 확인합니다.',
                href: '/stock/TROW',
                icon: '🔍',
              },
              {
                title: '포트폴리오 대시보드',
                description: '환율, 시장 지수, 스크리닝 결과 요약을 한눈에 파악하고, Top 종목을 즉시 확인합니다.',
                href: '/demo/dashboard',
                icon: '📈',
              },
            ].map((feature, i) => (
              <Link
                key={feature.title}
                href={feature.href}
                className={`animate-slide-up stagger-${i + 1} group glass-card rounded-2xl p-6 transition-all duration-300 hover:border-emerald-500/30 hover:bg-gray-800/30`}
              >
                <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-3 text-2xl ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:ring-emerald-500/40 group-hover:shadow-lg group-hover:shadow-emerald-500/10">
                  {feature.icon}
                </div>
                <h3 className="text-lg font-semibold text-white transition-colors duration-300 group-hover:text-emerald-400">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">{feature.description}</p>
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-400 opacity-0 transition-all duration-300 group-hover:opacity-100">
                  결과 미리보기
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* ═══════════════════════════════════════
          BOTTOM CTA
          ═══════════════════════════════════════ */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="glass-card animate-pulse-glow rounded-3xl p-10">
            <div className="mb-4 text-4xl">🚀</div>
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              스마트한 배당 투자를 시작하세요
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-gray-400">
              AI가 분석한 최적의 배당주와 ETF를 확인하고,
              매 분기 배당금이 들어오는 포트폴리오를 구성하세요.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/screening"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                배당주 분석 시작
                <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
              <Link
                href="/etf-screening"
                className="group inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
              >
                ETF 분석 시작
                <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Footer spacer */}
      <div className="h-16" />
    </div>
  );
}
