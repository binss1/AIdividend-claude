'use client';

import { useState, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';

type OAuthProvider = 'google' | 'kakao';

function LoginContent() {
  const searchParams = useSearchParams();
  const redirect = searchParams.get('redirect') || '/';
  const [loading, setLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleOAuthLogin = async (provider: OAuthProvider) => {
    setLoading(provider);
    setError(null);

    const supabase = createClient();

    const { error: authError } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(null);
    }
  };

  // 네이버는 Supabase 커스텀 OIDC Provider로 처리
  const handleNaverLogin = async () => {
    setLoading('naver');
    setError(null);

    const supabase = createClient();

    // Supabase에서 네이버를 커스텀 OIDC provider로 설정한 경우
    // Provider 이름은 Supabase Dashboard에서 설정한 이름과 동일해야 합니다
    const { error: authError } = await supabase.auth.signInWithOAuth({
      // @ts-expect-error: 네이버는 Supabase 커스텀 OIDC provider
      provider: 'naver',
      options: {
        redirectTo: `${location.origin}/auth/callback?next=${encodeURIComponent(redirect)}`,
      },
    });

    if (authError) {
      setError(authError.message);
      setLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        {/* Logo / Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-emerald-500 to-teal-600 mb-4">
            <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3v11.25A2.25 2.25 0 006 16.5h2.25M3.75 3h-1.5m1.5 0h16.5m0 0h1.5m-1.5 0v11.25A2.25 2.25 0 0118 16.5h-2.25m-7.5 0h7.5m-7.5 0l-1 3m8.5-3l1 3m0 0l.5 1.5m-.5-1.5h-9.5m0 0l-.5 1.5M9 11.25v1.5M12 9v3.75m3-6v6" />
            </svg>
          </div>
          <h1 className="text-2xl font-bold text-white">AI Dividend</h1>
          <p className="text-sm text-gray-400 mt-1">AI 기반 미국 배당주 스크리닝 플랫폼</p>
        </div>

        {/* Login Card */}
        <div className="rounded-2xl border border-gray-800/60 bg-gray-900/70 backdrop-blur-sm p-8">
          <h2 className="text-lg font-semibold text-white text-center mb-6">로그인</h2>

          {/* Error */}
          {error && (
            <div className="mb-4 rounded-xl bg-red-500/10 border border-red-500/30 px-4 py-3 text-sm text-red-400">
              {error}
            </div>
          )}

          {/* Social Login Buttons */}
          <div className="space-y-3">
            {/* Google */}
            <button
              onClick={() => handleOAuthLogin('google')}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-gray-700/50 bg-white hover:bg-gray-50 text-gray-800 font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'google' ? (
                <Spinner />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/>
                  <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                  <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                  <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                </svg>
              )}
              Google로 계속하기
            </button>

            {/* Kakao */}
            <button
              onClick={() => handleOAuthLogin('kakao')}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-yellow-500/30 bg-[#FEE500] hover:bg-[#FDD835] text-[#191919] font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'kakao' ? (
                <Spinner dark />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="#191919">
                  <path d="M12 3C6.48 3 2 6.36 2 10.44c0 2.62 1.75 4.93 4.37 6.24-.19.72-.7 2.6-.8 3.01-.13.5.18.5.38.36.16-.1 2.5-1.7 3.51-2.39.84.12 1.7.18 2.54.18 5.52 0 10-3.36 10-7.44C22 6.36 17.52 3 12 3z"/>
                </svg>
              )}
              카카오로 계속하기
            </button>

            {/* Naver */}
            <button
              onClick={handleNaverLogin}
              disabled={loading !== null}
              className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-xl border border-green-600/30 bg-[#03C75A] hover:bg-[#02b351] text-white font-medium text-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading === 'naver' ? (
                <Spinner />
              ) : (
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="white">
                  <path d="M16.27 3H20l-5.73 8.55L20 21h-3.73l-4.17-6.23L7.73 21H4l5.93-8.85L4 3h3.73l4.17 6.32L16.27 3z"/>
                </svg>
              )}
              네이버로 계속하기
            </button>
          </div>

          {/* Divider */}
          <div className="flex items-center gap-3 my-6">
            <div className="flex-1 h-px bg-gray-700/50" />
            <span className="text-xs text-gray-500">또는</span>
            <div className="flex-1 h-px bg-gray-700/50" />
          </div>

          {/* Guest access */}
          <a
            href="/"
            className="block w-full text-center px-4 py-3 rounded-xl border border-gray-700/50 bg-gray-800/40 text-gray-400 hover:text-white hover:bg-gray-800/60 text-sm transition-all"
          >
            로그인 없이 둘러보기
          </a>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-gray-600 mt-6">
          로그인하면 <span className="text-gray-400 underline">이용약관</span> 및{' '}
          <span className="text-gray-400 underline">개인정보처리방침</span>에 동의하게 됩니다.
        </p>
      </div>
    </div>
  );
}

function Spinner({ dark }: { dark?: boolean }) {
  return (
    <svg className={`w-5 h-5 animate-spin ${dark ? 'text-gray-800' : 'text-white'}`} fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <p className="text-gray-400">로딩 중...</p>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
