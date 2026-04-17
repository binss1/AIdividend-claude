-- ============================================
-- AI Dividend - Supabase PostgreSQL Schema
-- Phase 1-3: 사용자, 구독, 크레딧, 결제 테이블
-- ============================================

-- 1. 플랜 정의 테이블
CREATE TABLE IF NOT EXISTS plans (
  id TEXT PRIMARY KEY,                    -- 'free', 'starter', 'pro', 'premium', 'enterprise'
  name TEXT NOT NULL,
  monthly_price INTEGER NOT NULL DEFAULT 0,  -- 원화 (월간)
  annual_price INTEGER NOT NULL DEFAULT 0,   -- 원화 (연간)
  monthly_credits INTEGER NOT NULL DEFAULT 0, -- 월 제공 크레딧 (-1 = 무제한)
  max_screening_results INTEGER NOT NULL DEFAULT 5, -- 표시 가능 결과 수 (-1 = 무제한)
  max_scenarios INTEGER NOT NULL DEFAULT 1,  -- 리밸런싱 시나리오 수
  history_retention_days INTEGER NOT NULL DEFAULT 7, -- 이력 보관 일수 (-1 = 무제한)
  excel_export BOOLEAN NOT NULL DEFAULT FALSE,
  realtime_alerts BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 플랜 기본 데이터 삽입
INSERT INTO plans (id, name, monthly_price, annual_price, monthly_credits, max_screening_results, max_scenarios, history_retention_days, excel_export, realtime_alerts)
VALUES
  ('free',       'Free',       0,      0,      50,    5,  1, 7,   FALSE, FALSE),
  ('starter',    'Starter',    9900,   95040,  500,   -1, 3, 30,  TRUE,  FALSE),
  ('pro',        'Pro',        29900,  287040, 2000,  -1, 3, -1,  TRUE,  TRUE),
  ('premium',    'Premium',    59900,  575040, 5000,  -1, 3, -1,  TRUE,  TRUE),
  ('enterprise', 'Enterprise', 99900,  959040, -1,    -1, 3, -1,  TRUE,  TRUE)
ON CONFLICT (id) DO NOTHING;

-- 2. 사용자 프로필 테이블 (auth.users 확장)
CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT,
  display_name TEXT,
  avatar_url TEXT,
  plan_id TEXT NOT NULL DEFAULT 'free' REFERENCES plans(id),
  credit_balance INTEGER NOT NULL DEFAULT 50,  -- 현재 크레딧 잔액
  total_credits_used INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 3. 구독 테이블
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id TEXT NOT NULL REFERENCES plans(id),
  billing_period TEXT NOT NULL DEFAULT 'monthly' CHECK (billing_period IN ('monthly', 'annual')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'cancelled', 'expired', 'past_due')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ,
  cancelled_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 4. 크레딧 트랜잭션 테이블
CREATE TABLE IF NOT EXISTS credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('use', 'charge', 'refund', 'monthly_reset', 'bonus', 'addon')),
  amount INTEGER NOT NULL,            -- 양수: 충전, 음수: 사용
  balance_after INTEGER NOT NULL,     -- 트랜잭션 후 잔액
  feature TEXT,                       -- 사용 기능: 'stock_screening', 'etf_screening', 'simulation' 등
  description TEXT,                   -- 설명
  reference_id TEXT,                  -- 관련 주문번호 등
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. 결제 테이블
CREATE TABLE IF NOT EXISTS payments (
  id SERIAL PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  toss_payment_key TEXT UNIQUE,       -- 토스 paymentKey
  order_id TEXT UNIQUE NOT NULL,      -- 주문번호 (AID-yyyymmdd-xxxx)
  amount INTEGER NOT NULL,            -- 결제 금액 (원)
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'done', 'cancelled', 'failed')),
  plan_id TEXT REFERENCES plans(id),  -- 구독 결제인 경우
  credit_amount INTEGER,              -- 추가 크레딧 구매인 경우
  method TEXT,                        -- 결제수단
  billing_period TEXT,                -- 'monthly' | 'annual'
  toss_response JSONB,                -- 토스 응답 전체 저장
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  confirmed_at TIMESTAMPTZ
);

-- ============================================
-- 인덱스
-- ============================================
CREATE INDEX IF NOT EXISTS idx_user_profiles_plan ON user_profiles(plan_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_status ON subscriptions(status);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created ON credit_transactions(created_at);
CREATE INDEX IF NOT EXISTS idx_payments_user ON payments(user_id);
CREATE INDEX IF NOT EXISTS idx_payments_order ON payments(order_id);
CREATE INDEX IF NOT EXISTS idx_payments_status ON payments(status);

-- ============================================
-- RLS (Row Level Security)
-- ============================================
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE credit_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE payments ENABLE ROW LEVEL SECURITY;

-- user_profiles: 본인만 읽기/수정 가능
CREATE POLICY "Users can view own profile"
  ON user_profiles FOR SELECT
  USING (auth.uid() = id);

CREATE POLICY "Users can update own profile"
  ON user_profiles FOR UPDATE
  USING (auth.uid() = id);

-- subscriptions: 본인만 조회 가능
CREATE POLICY "Users can view own subscriptions"
  ON subscriptions FOR SELECT
  USING (auth.uid() = user_id);

-- credit_transactions: 본인만 조회 가능
CREATE POLICY "Users can view own credit transactions"
  ON credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

-- payments: 본인만 조회 가능
CREATE POLICY "Users can view own payments"
  ON payments FOR SELECT
  USING (auth.uid() = user_id);

-- plans: 모든 사용자 조회 가능
ALTER TABLE plans ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Plans are publicly readable"
  ON plans FOR SELECT
  USING (true);

-- ============================================
-- 트리거: 신규 유저 가입 시 자동 프로필 생성
-- ============================================
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO user_profiles (id, email, display_name, avatar_url, plan_id, credit_balance)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.raw_user_meta_data->>'full_name', split_part(NEW.email, '@', 1)),
    NEW.raw_user_meta_data->>'avatar_url',
    'free',
    50  -- Free 플랜 기본 크레딧
  );

  -- 초기 크레딧 충전 트랜잭션 기록
  INSERT INTO credit_transactions (user_id, type, amount, balance_after, description)
  VALUES (NEW.id, 'charge', 50, 50, '회원가입 기본 크레딧');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- auth.users에 INSERT 트리거 연결
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ============================================
-- 서비스 역할 전용 정책 (백엔드 서버에서 사용)
-- ============================================
-- service_role은 RLS를 우회하므로 별도 정책 불필요
-- 백엔드에서 SUPABASE_SERVICE_ROLE_KEY로 접근 시 모든 테이블 CRUD 가능
