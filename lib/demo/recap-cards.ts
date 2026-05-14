/**
 * ⑤ 정적 리캡 카드 5개 — LEAF-1·2·3, MID-1·2.
 *
 * 90초 짜리 미니 강의 + 1~2 빠른 확인 문제.
 * 데모 키는 메타데이터의 label (LEAF-1 등).
 */

export interface RecapCard {
  key: string
  title: string
  subtitle: string
  /** 짧은 미니 강의 (markdown-ish). */
  body: string
  /** 빠른 확인 1문제. */
  quickCheck: {
    question: string
    answer: string
    explanation: string
  }
}

export const RECAP_CARDS: Record<string, RecapCard> = {
  "LEAF-1": {
    key: "LEAF-1",
    title: "판별식 — 1분 30초 복습",
    subtitle: "중3 · 이차방정식의 근의 판별",
    body: [
      "이차방정식 ax² + bx + c = 0 의 판별식 D = b² − 4ac.",
      "",
      "• D > 0 → 서로 다른 두 실근",
      "• D = 0 → 중근 (한 점에서 접함)",
      "• D < 0 → 허근 (실근 없음)",
      "",
      "핵심: 곡선·직선 위치관계, 접선 개수 — 모두 판별식 부호로 환원된다.",
    ].join("\n"),
    quickCheck: {
      question: "x² − 6x + k = 0 이 중근을 가질 때 k 의 값은?",
      answer: "9",
      explanation: "D = 36 − 4k = 0 ⇒ k = 9.",
    },
  },

  "LEAF-2": {
    key: "LEAF-2",
    title: "이차방정식의 근 존재 조건",
    subtitle: "고1 · 실근 조건",
    body: [
      "이차방정식 ax² + bx + c = 0 이 실근을 가질 조건: D ≥ 0.",
      "",
      "이차함수 y = ax² + bx + c 와 x축의 교점:",
      "• D > 0 → 서로 다른 두 점",
      "• D = 0 → 한 점 (접함)",
      "• D < 0 → 만나지 않음",
    ].join("\n"),
    quickCheck: {
      question: "y = x² − 2x + a 가 x축과 만나도록 하는 a 의 범위는?",
      answer: "a ≤ 1",
      explanation: "D = 4 − 4a ≥ 0 ⇒ a ≤ 1.",
    },
  },

  "LEAF-3": {
    key: "LEAF-3",
    title: "미분계수 = 접선의 기울기",
    subtitle: "고2 수학Ⅱ · 미분의 기하적 의미",
    body: [
      "함수 f(x) 가 x = a 에서 미분가능 ⇒ f'(a) 는 곡선 y = f(x) 위 점 (a, f(a)) 에서의 접선의 기울기.",
      "",
      "f'(a) = lim_{h→0} (f(a+h) − f(a)) / h",
      "",
      "그래서 접선의 방정식은 y − f(a) = f'(a)(x − a).",
    ].join("\n"),
    quickCheck: {
      question: "f(x) = x³ 일 때 x = 2 에서의 접선의 기울기는?",
      answer: "12",
      explanation: "f'(x) = 3x², f'(2) = 12.",
    },
  },

  "MID-1": {
    key: "MID-1",
    title: "이차함수와 직선의 위치관계",
    subtitle: "고1 · 연립 → 판별식",
    body: [
      "이차함수와 직선이 만나는 점의 개수는 두 식을 연립한 이차방정식의 판별식 부호로 결정된다.",
      "",
      "1. 두 식을 연립 ⇒ 이차방정식 ax² + bx + c = 0",
      "2. D = b² − 4ac",
      "3. D > 0 → 두 점, D = 0 → 한 점(접함), D < 0 → 만나지 않음",
    ].join("\n"),
    quickCheck: {
      question: "y = x² 와 y = 2x + k 가 접할 때 k 는?",
      answer: "−1",
      explanation: "x² − 2x − k = 0, D = 4 + 4k = 0 ⇒ k = −1.",
    },
  },

  "MID-2": {
    key: "MID-2",
    title: "곡선 위 점에서의 접선의 방정식",
    subtitle: "고2 수학Ⅱ · 접선 1단계",
    body: [
      "곡선 y = f(x) 위의 점 (a, f(a)) 에서의 접선의 방정식:",
      "",
      "y − f(a) = f'(a) · (x − a)",
      "",
      "절차: ① 미분 → f'(x) ② x = a 대입 → 기울기 ③ 점-기울기 형식.",
    ].join("\n"),
    quickCheck: {
      question: "y = x² − 3x 위 점 (2, −2) 에서의 접선의 방정식?",
      answer: "y = x − 4",
      explanation: "f'(x) = 2x − 3, f'(2) = 1. y + 2 = 1·(x − 2).",
    },
  },
}

export function getRecapCard(key: string): RecapCard {
  return RECAP_CARDS[key] ?? RECAP_CARDS["LEAF-1"]!
}
