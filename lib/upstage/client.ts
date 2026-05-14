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

export interface ScoringRequest {
  /** 학생 풀이 단계 (LaTeX). */
  steps: string[]
  /** 학생이 제출한 답 + 정답. */
  studentAnswer: string
  correctAnswer: string
  /** 현재 문항 label + content. */
  targetPattern: { label: string; content: string }
  /** 후보 prereq pattern 1개. */
  candidatePattern: { id: string; label: string; content: string }
  /** Context 문서에서 candidatePattern 관련 chunk content (인용 후보). */
  contextChunks: { id: string; content: string }[]
}

export interface ScoringResult {
  /** 0~1, 이 prereq 가 학생 결손과 일치하는 확률. */
  score: number
  /** Context chunk 에서 발췌한 인용 (정확히 일치하는 substring). */
  justification: string | null
  /** justification 이 나온 chunk id. */
  justificationChunkId: string | null
  /** 한국어 한 줄 설명 (UI 표시용). */
  rationale: string
}

const SCORING_SYSTEM_PROMPT = `너는 한국 입시 수학 교사야. 학생이 문제 [TARGET] 을 풀다 막혔는데,
선수 지식 [PREREQ] 결손 때문일 가능성을 평가한다.

규칙:
1. 학생 풀이 단계와 정답을 비교해 어디서 막혔는지 식별.
2. 그 막힘 지점이 [PREREQ] 의 결손과 일치하는가? 0.0~1.0 으로 점수.
3. CONTEXT 문서에서 [PREREQ] 의 정의·성질이 명시된 문장을 정확히 발췌 (substring).
   본문에 없는 내용을 만들지 마라. 없으면 justification=null.
4. 한국어 한 줄 rationale.

응답은 반드시 JSON: { "score": 0.85, "justification": "...", "justificationChunkId": "c1", "rationale": "..." }`

export async function scorePrereqMatch(
  req: ScoringRequest,
  opts: { signal?: AbortSignal } = {},
): Promise<ScoringResult> {
  const client = getClient()
  if (!client) {
    throw new Error("Upstage client unavailable — UPSTAGE_API_KEY missing")
  }

  const userPrompt = [
    `[TARGET 문항]`,
    `${req.targetPattern.label}: ${req.targetPattern.content}`,
    ``,
    `[PREREQ 후보]`,
    `${req.candidatePattern.label}: ${req.candidatePattern.content}`,
    ``,
    `[학생 풀이 단계]`,
    ...req.steps.map((s, i) => `(${i + 1}) ${s}`),
    ``,
    `[학생 답]: ${req.studentAnswer}`,
    `[정답]: ${req.correctAnswer}`,
    ``,
    `[CONTEXT 문서 chunks]`,
    ...req.contextChunks.map((c) => `[${c.id}]\n${c.content}`),
  ].join("\n")

  let lastErr: unknown = null
  let backoffMs = 1000
  for (let attempt = 0; attempt < 3; attempt++) {
    try {
      const resp = await client.chat.completions.create(
        {
          model: env.UPSTAGE_SOLAR_MODEL,
          messages: [
            { role: "system", content: SCORING_SYSTEM_PROMPT },
            { role: "user", content: userPrompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.1,
        },
        { signal: opts.signal },
      )
      const raw = resp.choices[0]?.message?.content ?? ""
      const parsed = JSON.parse(raw) as Partial<ScoringResult>
      if (typeof parsed.score !== "number") {
        throw new Error(`invalid score: ${raw.slice(0, 200)}`)
      }
      return {
        score: Math.max(0, Math.min(1, parsed.score)),
        justification: parsed.justification ?? null,
        justificationChunkId: parsed.justificationChunkId ?? null,
        rationale: parsed.rationale ?? "",
      }
    } catch (err) {
      lastErr = err
      const msg = err instanceof Error ? err.message : String(err)
      // 429 만 backoff. JSON 파싱 실패는 즉시 throw.
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
