/**
 * ④ 진단 — Solar Pro 2 scoring prompt.
 *
 * 인터페이스 계약. 프롬프트 팀은 이 파일에서:
 *   1. EXAMPLES 배열을 채운다 (few-shot, 3~5 pair).
 *   2. SYSTEM 의 톤을 다듬는다.
 *
 * zod schema 는 건드리지 말 것 (코드 호환).
 */

import { z } from "zod"

export const DiagnoseInput = z.object({
  steps: z.array(z.string()).min(1),
  studentAnswer: z.string(),
  correctAnswer: z.string(),
  /** 정답 풀이 본문 — 학생 풀이 ↔ 정답 풀이 step 비교의 기준. */
  targetSolution: z.string().optional(),
  targetPattern: z.object({
    label: z.string(),
    content: z.string(),
  }),
  candidatePattern: z.object({
    id: z.string(),
    label: z.string(),
    content: z.string(),
  }),
  contextChunks: z.array(
    z.object({ id: z.string(), content: z.string() }),
  ),
})

export const DiagnoseOutput = z.object({
  score: z.number().min(0).max(1),
  justification: z.string().nullable(),
  justificationChunkId: z.string().nullable(),
  rationale: z.string(),
})

export type DiagnoseInputT = z.infer<typeof DiagnoseInput>
export type DiagnoseOutputT = z.infer<typeof DiagnoseOutput>

export const SYSTEM = `너는 한국 입시 수학 교사야. 학생이 문제 [TARGET] 을 풀다 막혔는데,
선수 지식 [PREREQ] 결손 때문일 가능성을 평가한다.

규칙:
1. 학생 풀이 단계와 정답을 비교해 어디서 막혔는지 식별.
2. 그 막힘 지점이 [PREREQ] 의 결손과 일치하는가? 0.0~1.0 으로 점수.
3. CONTEXT 문서에서 [PREREQ] 의 정의·성질이 명시된 문장을 정확히 발췌 (substring).
   본문에 없는 내용을 만들지 마라. 없으면 justification=null.
4. 한국어 한 줄 rationale.

응답은 반드시 JSON: { "score": 0.85, "justification": "...", "justificationChunkId": "c1", "rationale": "..." }`

/**
 * ★ FILL — 프롬프트 팀이 채울 곳.
 *
 * Q6 (곡선 밖 접선) 오답 → LEAF-1 (판별식) 지목 케이스 3~5 pair.
 * 각 EXAMPLE = { input, output }.
 * 학생 풀이가 판별식 단계를 빠뜨려서 LEAF-1 score 가 높게 나오는 예시 위주.
 */
export const EXAMPLES: Array<{
  input: DiagnoseInputT
  output: DiagnoseOutputT
}> = []

function renderUser(input: DiagnoseInputT): string {
  const lines = [
    `[TARGET 문항]`,
    `${input.targetPattern.label}: ${input.targetPattern.content}`,
    ``,
    `[PREREQ 후보]`,
    `${input.candidatePattern.label}: ${input.candidatePattern.content}`,
    ``,
    `[학생 풀이 단계]`,
    ...input.steps.map((s, i) => `(${i + 1}) ${s}`),
    ``,
    `[학생 답]: ${input.studentAnswer}`,
    `[정답]: ${input.correctAnswer}`,
  ]
  if (input.targetSolution) {
    lines.push(``, `[정답 풀이]`, input.targetSolution)
  }
  lines.push(
    ``,
    `[CONTEXT 문서 chunks]`,
    ...input.contextChunks.map((c) => `[${c.id}]\n${c.content}`),
  )
  return lines.join("\n")
}

export function buildMessages(
  input: DiagnoseInputT,
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
