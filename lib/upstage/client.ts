/**
 * Upstage Solar Pro client — OpenAI 호환 chat completions.
 *
 * 해커톤 데모용. 주요 호출처:
 *   - lib/recap/diagnose.ts (④ 결손 역추적 LLM scoring + justification)
 *   - 필요 시 추가 워커
 *
 * Solar Pro 2 (31B) 기본. UPSTAGE_SOLAR_MODEL env 로 'solar-pro3' 전환 가능.
 *
 * 가드:
 *   - UPSTAGE_API_KEY 미설정 시 isAvailable() = false. 호출 측이 fallback 결정.
 *   - 429 → 지수 backoff 최대 3회.
 *   - JSON 응답이 깨지면 RetryError throw, 호출 측이 fallback 으로.
 */

import OpenAI from "openai"
import { env, features } from "@/lib/env"
import {
  buildMessages as buildDiagnoseMessages,
  DiagnoseOutput,
  type DiagnoseInputT,
} from "./prompts/diagnose"
import {
  buildDiagnosisMessages,
  SolutionDiagnosisOutput,
  type SolutionDiagnosisInput,
  type SolutionDiagnosisOutputT,
} from "./prompts/solution-diagnosis"

const BASE_URL = "https://api.upstage.ai/v1"

let _client: OpenAI | null = null

function getClient(): OpenAI | null {
  if (!features.upstage) return null
  if (!_client) {
    _client = new OpenAI({
      apiKey: env.UPSTAGE_API_KEY!,
      baseURL: BASE_URL,
    })
  }
  return _client
}

export function isAvailable(): boolean {
  return features.upstage
}

/** 시그니처 호환 alias — prompts/diagnose.ts 가 single source of truth. */
export type ScoringRequest = DiagnoseInputT

export interface ScoringResult {
  score: number
  justification: string | null
  justificationChunkId: string | null
  rationale: string
}

export async function scorePrereqMatch(
  req: ScoringRequest,
  opts: { signal?: AbortSignal } = {},
): Promise<ScoringResult> {
  const client = getClient()
  if (!client) {
    throw new Error("Upstage client unavailable — UPSTAGE_API_KEY missing")
  }

  const messages = buildDiagnoseMessages(req)

  let lastErr: unknown = null
  let backoffMs = 1000
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await client.chat.completions.create(
        {
          model: env.UPSTAGE_SOLAR_MODEL,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.1,
        },
        { signal: opts.signal },
      )
      const raw = resp.choices[0]?.message?.content ?? ""
      const parsed = DiagnoseOutput.parse(JSON.parse(raw))
      return {
        score: Math.max(0, Math.min(1, parsed.score)),
        justification: parsed.justification,
        justificationChunkId: parsed.justificationChunkId,
        rationale: parsed.rationale,
      }
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      // 429 만 backoff. JSON/zod 파싱 실패는 즉시 throw.
      if (!msg.includes("429") && !msg.includes("rate")) break
      await new Promise((r) => setTimeout(r, backoffMs))
      backoffMs *= 2
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/**
 * 학생 풀이 논리 진단 — few-shot prompt (prompts/solution-diagnosis.ts).
 *
 * 단순 정답/오답이 아니라 first_wrong_step·error_type·missing_concepts 까지.
 * 429 → backoff 3회, JSON/zod 실패는 즉시 throw (호출 측이 fallback).
 */
export async function diagnoseSolution(
  input: SolutionDiagnosisInput,
  opts: { signal?: AbortSignal } = {},
): Promise<SolutionDiagnosisOutputT> {
  const client = getClient()
  if (!client) {
    throw new Error("Upstage client unavailable — UPSTAGE_API_KEY missing")
  }

  const messages = buildDiagnosisMessages(input)

  let lastErr: unknown = null
  let backoffMs = 1000
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await client.chat.completions.create(
        {
          model: env.UPSTAGE_SOLAR_MODEL,
          messages,
          response_format: { type: "json_object" },
          temperature: 0.2,
          max_tokens: 1800,
        },
        { signal: opts.signal },
      )
      const raw = resp.choices[0]?.message?.content ?? ""
      return SolutionDiagnosisOutput.parse(JSON.parse(raw))
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      if (!msg.includes("429") && !msg.includes("rate")) break
      await new Promise((r) => setTimeout(r, backoffMs))
      backoffMs *= 2
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr))
}

/**
 * Generic Solar Pro chat — JSON 응답이 아닌 자유 텍스트 용도.
 * 리캡 카드 fallback, 코치 메시지 등에서 사용 가능.
 */
export async function solarChat(
  messages: { role: "system" | "user" | "assistant"; content: string }[],
  opts: { temperature?: number; signal?: AbortSignal } = {},
): Promise<string> {
  const client = getClient()
  if (!client) {
    throw new Error("Upstage client unavailable — UPSTAGE_API_KEY missing")
  }
  const resp = await client.chat.completions.create(
    {
      model: env.UPSTAGE_SOLAR_MODEL,
      messages,
      temperature: opts.temperature ?? 0.3,
    },
    { signal: opts.signal },
  )
  return resp.choices[0]?.message?.content ?? ""
}
