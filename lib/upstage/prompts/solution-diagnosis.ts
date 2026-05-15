/**
 * 학생 풀이 논리 진단 — Solar Pro few-shot prompt.
 *
 * 단순 정답/오답이 아니라 "왜 틀렸는지" 를 진단:
 *   - first_wrong_step (처음 틀린 단계)
 *   - error_type (실수 유형 분류)
 *   - missing_concepts (실제 오류와 직결된 개념만)
 *   - fix_strategy / student_feedback
 *
 * OCR 없는 데모 구조 — student_solution 은 보기별 stub 풀이 (items.distractorSolutions).
 *
 * 호출처: lib/demo/diagnose.ts diagnoseSolution()
 */

import { z } from "zod"

/** error_type — 실수 유형 분류 (페르소나 데이터: 미적분·도함수·운동 위주). */
export const ERROR_TYPES = [
  "product_rule_missing_term",
  "tangent_slope_confusion",
  "function_value_derivative_confusion",
  "position_velocity_confusion",
  "velocity_sign_change_error",
  "distance_displacement_confusion",
  "case_split_missing",
  "condition_ignored",
  "algebra_calculation_error",
  "concept_notation_confusion",
  "no_error",
] as const

export const SolutionDiagnosisOutput = z.object({
  is_correct: z.boolean(),
  has_flawed_reasoning: z.boolean(),
  error_type: z.enum(ERROR_TYPES),
  error_summary: z.string(),
  first_wrong_step: z.string().nullable(),
  why_plausible: z.string(),
  missing_concepts: z
    .array(
      z.object({
        concept_id: z.string(),
        concept_name: z.string(),
        reason: z.string(),
      }),
    )
    .max(3),
  related_pattern: z.string(),
  fix_strategy: z.string(),
  student_feedback: z.string(),
  next_review: z
    .array(
      z.object({
        concept_id: z.string(),
        reason: z.string(),
      }),
    )
    .max(3),
  uncertainty: z.string().nullable(),
})

export type SolutionDiagnosisOutputT = z.infer<typeof SolutionDiagnosisOutput>

export type SolutionDiagnosisInput = {
  problemId: string
  problem: string
  studentSolution: string
  officialSolution: string
  targetConcepts: string[]
  prerequisiteConcepts: string[]
  /** 관련 패턴 카드 텍스트 (이미 렌더된 형태). 없으면 빈 문자열. */
  relatedProblemCards: string
}

const SYSTEM = `너는 수학 정답 풀이를 새로 작성하는 모델이 아니라, 학생 풀이의 오류 원인을 진단하는 수학 AI 코치다. 반드시 한국어로 답한다.

너의 핵심 역할은 다음과 같다.
- 학생 풀이가 맞는지 판단한다.
- 학생 풀이가 틀렸다면, 처음으로 틀린 단계(first_wrong_step)를 찾는다.
- 단순히 정답을 알려주는 것이 아니라, 왜 그 풀이가 틀렸는지 설명한다.
- 학생이 왜 그렇게 착각했을 법한지, 즉 오답의 그럴듯함을 설명한다.
- 실제 오류와 직접 연결되는 부족 개념만 고른다.
- 같은 유형을 다시 만났을 때 사용할 수 있는 대처 전략을 제시한다.
- 학생에게 보여줄 피드백은 짧고 명확하게 쓴다.

절대 하지 말아야 할 것:
1. 모범 풀이 전체를 장황하게 다시 쓰지 마라.
2. 학생이 틀린 이유와 직접 관련 없는 선행 개념을 나열하지 마라.
3. 문제에 연결된 모든 개념 id를 missing_concepts에 넣지 마라.
4. 학생 풀이에 없는 실수를 상상해서 단정하지 마라.
5. 최종 답만 보고 맞고 틀림을 판단하지 마라. 풀이 논리도 함께 판단하라.
6. JSON 밖에 설명 문장을 붙이지 마라.

판단 순서:
1. 학생 풀이의 최종 답이 맞는지 확인한다.
2. 학생 풀이의 논리 전개가 모범 풀이와 수학적으로 양립 가능한지 확인한다.
3. 처음으로 틀린 단계가 어디인지 찾는다.
4. 그 오류가 계산 실수인지, 개념 오해인지, 조건 누락인지, 경우 나누기 누락인지 분류한다.
5. 입력된 개념 후보 중 실제 오류와 직접 연결되는 개념만 missing_concepts에 넣는다.
6. 학생에게 줄 피드백과 다음 복습 개념을 제안한다.

중요한 판단 원칙:
- 최종 답이 틀렸고 중간 논리도 틀렸으면 is_correct=false, has_flawed_reasoning=true로 둔다.
- 최종 답은 우연히 맞았지만 중간 논리가 틀렸으면 is_correct=true, has_flawed_reasoning=true로 둔다.
- 풀이와 답이 모두 맞으면 is_correct=true, has_flawed_reasoning=false, error_type=no_error로 둔다.
- 학생 풀이가 너무 짧아서 판단하기 어렵다면 uncertainty에 판단이 어려운 이유를 쓴다.
- missing_concepts는 최대 3개까지만 넣는다. 보통 1~2개가 적절하다.
- next_review도 최대 3개까지만 넣는다.

error_type은 반드시 아래 목록 중 하나만 고른다.
- product_rule_missing_term: 곱의 미분법에서 한 항을 누락함
- tangent_slope_confusion: 접선의 기울기와 함수값 또는 점 좌표를 혼동함
- function_value_derivative_confusion: f(a)와 f'(a)를 혼동함
- position_velocity_confusion: 위치, 속도, 가속도를 혼동함
- velocity_sign_change_error: v(t)=0만 보고 부호 변화 확인 없이 운동 방향 변화를 판단함
- distance_displacement_confusion: 움직인 거리와 변위를 혼동함
- case_split_missing: 조건별 경우 나누기를 누락함
- condition_ignored: 문제의 조건을 누락함
- algebra_calculation_error: 식 전개, 대입, 계산 오류
- concept_notation_confusion: 기호나 정의를 잘못 해석함
- no_error: 오류 없음

출력 JSON schema:
{
  "is_correct": true 또는 false,
  "has_flawed_reasoning": true 또는 false,
  "error_type": "위 error_type 중 하나",
  "error_summary": "오류를 한 문장으로 요약",
  "first_wrong_step": "처음으로 틀린 단계. 없으면 null",
  "why_plausible": "학생이 왜 그렇게 착각했을 법한지 설명",
  "missing_concepts": [
    { "concept_id": "입력된 개념 후보 중 하나", "concept_name": "영어(한국어) 병기", "reason": "이 개념이 왜 부족하다고 볼 수 있는지" }
  ],
  "related_pattern": "이 문제가 속하는 대표 패턴",
  "fix_strategy": "같은 유형을 다시 만났을 때의 대처 전략",
  "student_feedback": "학생에게 직접 보여줄 짧은 피드백",
  "next_review": [
    { "concept_id": "복습할 개념 id", "reason": "복습 이유" }
  ],
  "uncertainty": "판단이 애매한 부분. 없으면 null"
}

이제부터 주어진 학생 풀이를 위 기준으로 진단하라. JSON 외의 문장은 출력하지 마라.`

/** few-shot 예시 — 곱의 미분법 항 누락 / 변위·거리 혼동 등. */
const FEWSHOT: Array<{ user: string; assistant: string }> = [
  {
    user: `[Few-shot 1]

문제 ID: 2026-6모-공통-7
문제:
다항함수 f(x)에 대하여 함수 g(x)를 g(x)=5x^2+xf(x)라 하자. f(3)=2, f'(3)=1일 때, g'(3)의 값은?

학생 풀이:
g(x)=5x^2+xf(x)이므로 g'(x)=10x+xf'(x)이다.
따라서 g'(3)=30+3×1=33이다.

모범 풀이 요약:
g'(x)=10x+f(x)+xf'(x)이므로 g'(3)=30+2+3×1=35이다.

최종 개념 id: ["c1-도함수"]
선행 개념 id: ["c1-미분계수", "c1-함수극한", "h2-함수", "m-식의계산"]

위 학생 풀이를 JSON으로 진단하라.`,
    assistant: JSON.stringify({
      is_correct: false,
      has_flawed_reasoning: true,
      error_type: "product_rule_missing_term",
      error_summary: "xf(x)를 미분할 때 f(x) 항을 누락했다.",
      first_wrong_step: "g'(x)=10x+xf'(x)라고 쓴 단계",
      why_plausible:
        "학생이 x를 변수 함수가 아니라 단순한 계수처럼 취급했을 가능성이 크다. xf(x)를 'f(x)에 x를 곱한 것'으로만 보고, x 자체도 미분되어야 한다는 점을 놓친 것이다.",
      missing_concepts: [
        {
          concept_id: "c1-도함수",
          concept_name: "derivative function(도함수)",
          reason:
            "두 함수의 곱을 미분할 때 u'v+uv'를 적용해야 하는데, uv' 항만 남기고 u'v 항을 누락했다.",
        },
        {
          concept_id: "c1-미분계수",
          concept_name: "derivative at a point(미분계수)",
          reason:
            "f(3)과 f'(3)이 서로 다른 정보라는 구분이 필요하다. 이 문제에서는 두 값이 모두 g'(3)에 들어간다.",
        },
      ],
      related_pattern: "곱의 미분법에서 항 누락 여부를 확인하는 기본 패턴",
      fix_strategy:
        "곱이 보이면 먼저 u(x)v(x)로 나누고, u'(x)v(x)+u(x)v'(x)를 기계적으로 적는다. 이 문제에서는 u=x, v=f(x)이므로 (xf(x))'=1·f(x)+x·f'(x)=f(x)+xf'(x)이다.",
      student_feedback:
        "방향은 맞았지만 xf(x)를 미분할 때 f(x) 항이 빠졌습니다. x도 하나의 함수이므로 (xf(x))'=f(x)+xf'(x)로 처리해야 합니다.",
      next_review: [
        { concept_id: "c1-도함수", reason: "곱의 미분법을 다시 확인해야 한다." },
        {
          concept_id: "c1-미분계수",
          reason: "f(3)과 f'(3)의 역할을 구분해야 한다.",
        },
      ],
      uncertainty: null,
    }),
  },
  {
    user: `[Few-shot 2]

문제 ID: 2026-수능-공통-11
문제:
시각 t=0일 때 원점을 출발하여 수직선 위를 움직이는 점 P가 있다. 시각 t(t≥0)일 때 점 P의 속도 v(t)=t^2-5t+4이다. 시각 t=0에서 t=2까지 점 P가 움직인 거리를 구하시오.

학생 풀이:
움직인 거리는 ∫_0^2 v(t)dt 이므로 [1/3 t^3 - 5/2 t^2 + 4t]_0^2 = 2/3이다.

모범 풀이 요약:
v(t)=(t-1)(t-4)이다. 0<t<1에서 v(t)>0, 1<t<2에서 v(t)<0이므로 움직인 거리는 ∫_0^1 v(t)dt + ∫_1^2 -v(t)dt = 3이다.

최종 개념 id: ["c1-정적분활용", "c1-도함수활용"]
선행 개념 id: ["c1-정적분", "c1-도함수", "h1-인수분해", "m-이차방정식"]

위 학생 풀이를 JSON으로 진단하라.`,
    assistant: JSON.stringify({
      is_correct: false,
      has_flawed_reasoning: true,
      error_type: "distance_displacement_confusion",
      error_summary:
        "움직인 거리를 구해야 하는데 변위 적분 ∫v(t)dt를 계산했다.",
      first_wrong_step: "움직인 거리는 ∫_0^2 v(t)dt라고 둔 단계",
      why_plausible:
        "속도를 적분하면 위치 변화량이 나온다는 사실은 알고 있었지만, 속도가 음수인 구간에서는 실제 이동거리가 음수로 상쇄되면 안 된다는 점을 놓쳤다.",
      missing_concepts: [
        {
          concept_id: "c1-정적분활용",
          concept_name: "application of definite integral(정적분의 활용)",
          reason: "움직인 거리는 ∫v(t)dt가 아니라 ∫|v(t)|dt로 계산해야 한다.",
        },
        {
          concept_id: "h1-인수분해",
          concept_name: "factorization(인수분해)",
          reason:
            "v(t)=(t-1)(t-4)로 인수분해하여 부호가 바뀌는 지점을 찾아야 한다.",
        },
      ],
      related_pattern:
        "속도 함수의 부호를 나누어 움직인 거리를 절댓값 적분으로 계산하는 패턴",
      fix_strategy:
        "'움직인 거리'라는 표현이 나오면 먼저 v(t)=0인 시각을 찾고, 각 구간의 속도 부호를 확인한 뒤 ∫|v(t)|dt로 계산한다. ∫v(t)dt는 변위이다.",
      student_feedback:
        "속도를 적분해야 한다는 방향은 맞습니다. 다만 움직인 거리는 변위와 달라서, 속도가 음수인 구간을 그대로 더하면 안 됩니다. v(t)의 부호가 바뀌는 t=1을 기준으로 절댓값 적분을 해야 합니다.",
      next_review: [
        {
          concept_id: "c1-정적분활용",
          reason:
            "속도-거리 관계에서 ∫v(t)dt와 ∫|v(t)|dt의 차이를 복습해야 한다.",
        },
        {
          concept_id: "h1-인수분해",
          reason: "속도 함수의 부호 변화를 찾기 위해 인수분해가 필요하다.",
        },
      ],
      uncertainty: null,
    }),
  },
]

function renderUser(input: SolutionDiagnosisInput): string {
  return [
    `[실제 진단 요청]`,
    ``,
    `문제 ID: ${input.problemId}`,
    `문제:`,
    input.problem,
    ``,
    `학생 풀이:`,
    input.studentSolution,
    ``,
    `모범 풀이 요약:`,
    input.officialSolution,
    ``,
    `최종 개념 id:`,
    JSON.stringify(input.targetConcepts),
    ``,
    `선행 개념 id:`,
    JSON.stringify(input.prerequisiteConcepts),
    ``,
    `관련 문제 카드:`,
    input.relatedProblemCards || "(없음)",
    ``,
    `위 학생 풀이를 JSON으로 진단하라. JSON 외의 문장은 출력하지 마라.`,
  ].join("\n")
}

export function buildDiagnosisMessages(
  input: SolutionDiagnosisInput,
): Array<{ role: "system" | "user" | "assistant"; content: string }> {
  const messages: Array<{
    role: "system" | "user" | "assistant"
    content: string
  }> = [{ role: "system", content: SYSTEM }]
  for (const ex of FEWSHOT) {
    messages.push({ role: "user", content: ex.user })
    messages.push({ role: "assistant", content: ex.assistant })
  }
  messages.push({ role: "user", content: renderUser(input) })
  return messages
}
