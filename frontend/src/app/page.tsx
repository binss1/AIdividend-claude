import Link from 'next/link';

const features = [
  {
    title: '배당주 스크리닝',
    description:
      'Q-LEAD 모델 기반으로 500개 이상의 미국 배당주를 분석하고, 배당 성장률, 안정성, 재무 건전성을 종합 평가합니다.',
    href: '/screening',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
      </svg>
    ),
  },
  {
    title: 'ETF 스크리닝',
    description:
      '미국 배당 ETF를 비용 비율, 배당 수익률, 운용 자산, 분배 성장률 등 다양한 지표로 스크리닝합니다.',
    href: '/etf-screening',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
      </svg>
    ),
  },
  {
    title: '포트폴리오 분석',
    description:
      '선별된 배당주와 ETF의 종합 대시보드를 통해 배당 일정, 수익률 분포, 섹터 배분을 한눈에 파악합니다.',
    href: '/dashboard',
    icon: (
      <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 6a7.5 7.5 0 107.5 7.5h-7.5V6z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 10.5H21A7.5 7.5 0 0013.5 3v7.5z" />
      </svg>
    ),
  },
];

const stats = [
  { value: '500+', label: '종목 분석' },
  { value: 'Q-LEAD', label: '평가 모델' },
  { value: '실시간', label: '데이터 업데이트' },
  { value: 'A+ ~ F', label: '등급 시스템' },
];

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden">
      {/* Background effects */}
      <div className="pointer-events-none absolute inset-0">
        <div className="absolute top-0 left-1/4 h-[600px] w-[600px] rounded-full bg-emerald-500/5 blur-[120px]" />
        <div className="absolute top-1/3 right-1/4 h-[500px] w-[500px] rounded-full bg-teal-500/5 blur-[100px]" />
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 h-[400px] w-[800px] rounded-full bg-cyan-500/3 blur-[120px]" />
      </div>

      {/* Hero Section */}
      <section className="relative px-4 pt-24 pb-20 sm:pt-32 sm:pb-28">
        <div className="mx-auto max-w-5xl text-center">
          {/* Badge */}
          <div className="animate-fade-in mb-8 inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-4 py-1.5 text-sm text-emerald-400">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-500" />
            </span>
            AI 기반 배당 투자 플랫폼
          </div>

          {/* Title */}
          <h1 className="animate-fade-in text-4xl font-bold tracking-tight sm:text-5xl lg:text-6xl">
            <span className="text-white">지능형</span>{' '}
            <span className="text-gradient">미국 배당주</span>
            <br />
            <span className="text-white">분석 플랫폼</span>
          </h1>

          {/* Subtitle */}
          <p className="animate-fade-in stagger-2 mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-400 sm:text-xl">
            Q-LEAD 스코어링 모델을 활용하여 배당 수익률, 성장성, 안정성, 재무
            건전성을 종합 분석합니다. 데이터 기반의 스마트한 배당 투자를
            시작하세요.
          </p>

          {/* CTA Buttons */}
          <div className="animate-fade-in stagger-3 mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <Link
              href="/screening"
              className="group relative inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              배당주 스크리닝 시작
              <svg className="h-5 w-5 transition-transform duration-300 group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
            <Link
              href="/etf-screening"
              className="inline-flex items-center gap-2 rounded-xl border border-gray-700 bg-gray-900/50 px-8 py-3.5 text-base font-semibold text-gray-300 transition-all duration-300 hover:border-gray-600 hover:bg-gray-800/50 hover:text-white"
            >
              ETF 스크리닝
            </Link>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="relative px-4 py-16">
        <div className="mx-auto max-w-5xl">
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 sm:gap-6">
            {stats.map((stat, i) => (
              <div
                key={stat.label}
                className={`animate-fade-in stagger-${i + 1} glass-card rounded-2xl p-6 text-center transition-all duration-300 hover:border-emerald-500/30`}
              >
                <div className="text-2xl font-bold text-emerald-400 sm:text-3xl">
                  {stat.value}
                </div>
                <div className="mt-1 text-sm text-gray-400">{stat.label}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-5xl">
          <div className="mb-12 text-center">
            <h2 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
              핵심 기능
            </h2>
            <p className="mt-3 text-gray-400">
              데이터 기반 배당 투자의 모든 것을 한 곳에서
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((feature, i) => (
              <Link
                key={feature.title}
                href={feature.href}
                className={`animate-slide-up stagger-${i + 1} group glass-card rounded-2xl p-6 transition-all duration-300 hover:border-emerald-500/30 hover:bg-gray-800/30`}
              >
                {/* Icon */}
                <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-gradient-to-br from-emerald-500/20 to-teal-500/20 p-3 text-emerald-400 ring-1 ring-emerald-500/20 transition-all duration-300 group-hover:ring-emerald-500/40 group-hover:shadow-lg group-hover:shadow-emerald-500/10">
                  {feature.icon}
                </div>

                {/* Content */}
                <h3 className="text-lg font-semibold text-white transition-colors duration-300 group-hover:text-emerald-400">
                  {feature.title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-gray-400">
                  {feature.description}
                </p>

                {/* Arrow */}
                <div className="mt-4 flex items-center gap-1 text-sm font-medium text-emerald-400 opacity-0 transition-all duration-300 group-hover:opacity-100">
                  자세히 보기
                  <svg className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                  </svg>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </section>

      {/* Bottom CTA */}
      <section className="relative px-4 py-20">
        <div className="mx-auto max-w-3xl text-center">
          <div className="glass-card animate-pulse-glow rounded-3xl p-10">
            <h2 className="text-2xl font-bold text-white sm:text-3xl">
              스마트한 배당 투자를 시작하세요
            </h2>
            <p className="mx-auto mt-3 max-w-lg text-gray-400">
              AI가 분석한 최적의 배당주와 ETF를 확인하고, 안정적인 수익
              포트폴리오를 구성하세요.
            </p>
            <Link
              href="/screening"
              className="mt-8 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-teal-500 px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-emerald-500/25 transition-all duration-300 hover:shadow-emerald-500/40 hover:scale-[1.02] active:scale-[0.98]"
            >
              지금 시작하기
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer spacer */}
      <div className="h-16" />
    </div>
  );
}
