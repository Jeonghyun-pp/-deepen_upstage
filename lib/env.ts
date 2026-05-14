/**
 * 환경 변수 zod 검증.
 * Spec: docs/build-spec/01-tech-stack.md "환경 변수 (lock)".
 *
 * 부팅 시 1회 parse. 누락되면 명확한 에러로 즉시 차단.
 *
 * 정책:
 *   - Supabase·DB·Anthropic 은 hard-required (없으면 핵심 기능 X).
 *   - OpenAI·Admin·기타는 optional (없으면 일부 기능만 막힘).
 *   - 프론트(NEXT_PUBLIC_*) 키는 런타임에 별도 검증 (이 파일은 서버용).
 *
 * 사용:
 *   import { env } from "@/lib/env"
 *   const url = env.SUPABASE_URL
 */

import { z } from "zod"

const required = (name: string) =>
  z.string().min(1, { message: `${name} is required` })

const schema = z.object({
  // Supabase (필수)
  NEXT_PUBLIC_SUPABASE_URL: required("NEXT_PUBLIC_SUPABASE_URL"),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: required("NEXT_PUBLIC_SUPABASE_ANON_KEY"),
  SUPABASE_SERVICE_ROLE_KEY: required("SUPABASE_SERVICE_ROLE_KEY"),

  // DB (필수)
  DATABASE_URL: required("DATABASE_URL"),

  // LLM 키
  // Q1: Anthropic = AI 코치/리캡카드/8가지 분류 워커. 없으면 코치 패널만 막힘.
  // OpenAI = 기존 PDF 파이프라인 GPT-4o-mini.
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  CLAUDE_MODEL: z.string().default("claude-opus-4-7"),
  OPENAI_API_KEY: z.string().min(1).optional(),
  OPENAI_MODEL: z.string().default("gpt-4o-mini"),

  // Upstage — 해커톤 데모용. Solar Pro chat + Information Extract (Vision).
  // 미설정 시 데모 진단/IE Vision 호출이 막힘. /demo 외 경로는 영향 없음.
  UPSTAGE_API_KEY: z.string().min(1).optional(),
  UPSTAGE_SOLAR_MODEL: z.string().default("solar-pro2"),

  // Admin (시드 작업)
  ADMIN_EMAILS: z.string().default(""),

  // App URL (선택, 메일/cron 콜백용)
  NEXT_PUBLIC_APP_URL: z.string().url().optional(),

  // Cron 인증 — 프로덕션 cron 호출 시 Authorization: Bearer ${CRON_SECRET} 검증 (M3.3+).
  CRON_SECRET: z.string().min(1).optional(),

  // Toss Payments — M3.1 결제. 미설정 시 checkout/webhook 라우트가 dryRun 분기.
  TOSS_CLIENT_KEY: z.string().min(1).optional(),
  TOSS_SECRET_KEY: z.string().min(1).optional(),
  /** Toss webhook signature 검증용 secret. 일반적으로 TOSS_SECRET_KEY 와 동일. */
  TOSS_WEBHOOK_SECRET: z.string().min(1).optional(),

  // OpenAlex (옛 PDF 메타데이터 보강 — 옵션). 검증 없이 통과 (구 product 잔재).
  OPENALEX_EMAIL: z.string().optional(),

  // 로그인 프로세스 제거 — 모든 server/route handler 가 이 user 로 작동.
  // .env.local 에 본인 user_id + email 을 세팅. ADMIN_EMAILS 매칭 시 admin 통과.
  DEV_AUTH_BYPASS_USER_ID: z.string().uuid(),
  DEV_AUTH_BYPASS_EMAIL: z.string().email(),
})

export type Env = z.infer<typeof schema>

function loadEnv(): Env {
  const result = schema.safeParse(process.env)
  if (!result.success) {
    const flatten = result.error.flatten().fieldErrors
    const lines = Object.entries(flatten).map(
      ([k, v]) => `  - ${k}: ${(v ?? []).join(", ")}`,
    )
    throw new Error(
      `Invalid environment variables:\n${lines.join("\n")}\n` +
        `Set them in .env.local. See docs/build-spec/01-tech-stack.md.`,
    )
  }
  return result.data
}

/**
 * 검증된 env 객체. import 시점에 검증되므로 Next.js 부팅 직후 1회 실행.
 */
export const env = loadEnv()

/**
 * 기능별 가용성 헬퍼.
 * UI/API 가 "이 기능 쓸 수 있는지" 판단할 때 사용.
 */
export const features = {
  aiCoach: !!env.ANTHROPIC_API_KEY,
  pdfExtraction: !!env.OPENAI_API_KEY,
  adminConfigured: env.ADMIN_EMAILS.split(",").map((s) => s.trim()).filter(Boolean).length > 0,
  tossLive: !!(env.TOSS_CLIENT_KEY && env.TOSS_SECRET_KEY),
  upstage: !!env.UPSTAGE_API_KEY,
} as const
