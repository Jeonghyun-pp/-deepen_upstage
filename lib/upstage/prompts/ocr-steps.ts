/**
 * ③ OCR — 손글씨 풀이 raw text → 단계별 JSON.
 *
 * pipeline:
 *   sample.png → Upstage Document Parse → rawText
 *   rawText + problemContext → Solar Pro 2 (이 prompt) → { steps, studentAnswer }
 *
 * 프롬프트 팀:
 *   1. EXAMPLES 배열 채우기 (3 pair 권장).
 *   2. SYSTEM 톤 다듬기.
 */

import { z } from "zod"

export const OcrStepsInput = z.object({
  /** Document Parse 가 추출한 손글씨 raw text. */
  rawText: z.string(),
  /** Q6 문제 본문 (학생이 무엇을 풀고 있는지 컨텍스트). */
  problemContext: z.string(),
})

export const OcrStepsOutput = z.object({
  steps: z
    .array(
      z.object({
        latex: z.string(),
        label: z.string(),
      }),
    )
    .min(1)
    .max(6),
  /** 학생이 도달한 최종 답. 객관식이면 보기 번호 또는 그 텍스트. */
  studentAnswer: z.string(),
})

export type OcrStepsInputT = z.infer<typeof OcrStepsInput>
export type OcrStepsOutputT = z.infer<typeof OcrStepsOutput>

export const SYSTEM = `너는 학생의 손글씨 풀이를 단계별로 정리하는 한국 입시 수학 교사야.

입력: Document Parse 가 추출한 raw text + 학생이 풀던 문제 본문.
출력: 학생이 실제로 적은 단계 N개 (LaTeX) + 학생이 도달한 최종 답.

규칙:
1. 학생이 적은 식만 단계로 추출. 정답 풀이를 만들어 끼우지 마라.
2. 각 step 의 label 은 한국어 (예: "판별식 적용", "정리", "대입").
3. 알아볼 수 없는 영역은 step 에 포함하지 마라.
4. 학생이 도달한 최종 답을 studentAnswer 에 표기 (예: "2개", "③", "k < -4").

응답은 반드시 JSON: { "steps": [{"latex": "...", "label": "..."}], "studentAnswer": "..." }`

/**
 * ★ FILL — 프롬프트 팀이 채울 곳.
 * Q6 학생 풀이 예시 3 pair (판별식 누락 → 답 틀린 케이스 위주).
 */
export const EXAMPLES: Array<{
  input: OcrStepsInputT
  output: OcrStepsOutputT
}> = []

function renderUser(input: OcrStepsInputT): string {
  return [
    `[문제]`,
    input.problemContext,
    ``,
    `[학생 손글씨 raw text]`,
    input.rawText,
  ].join("\n")
}

export function buildMessages(
  input: OcrStepsInputT,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{
    role: "system" | "user" | "assistant"
    content: string
  }> = [{ role: "system", content: SYSTEM }]
  for (const ex of EXAMPLES) {
    messages.push({ role: "user", content: renderUser(ex.input) })
    messages.push({ role: "assistant", content: JSON.stringify(ex.output) })
  }
  messages.push({ role: "user", content: renderUser(input) })
  return messages
}
