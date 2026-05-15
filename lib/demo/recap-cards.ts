/**
 * ⑤ 정적 리캡 카드 — data/demo/recap-cards.json 에서 동적 로드.
 *
 * 90초 짜리 미니 강의 + 1~2 빠른 확인 문제.
 * 데모 키는 메타데이터의 patternKey (LEAF-1 등).
 */

import { getRecapCardData, type RecapCardData } from "./data-loader"

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
  /** 2022 개정 교육과정 성취기준 코드. */
  curriculumCode?: string
  /** 이 결손이 영향 주는 상위 유형 — "단순 결손이 아니다" 메시지. */
  impact?: {
    label: string
    description: string
  }
}

function toCard(data: RecapCardData): RecapCard {
  return {
    key: data.patternKey,
    title: data.title,
    subtitle: data.subtitle,
    body: data.body,
    quickCheck: data.quickCheck,
    curriculumCode: data.curriculumCode,
    impact: data.impact,
  }
}

export function getRecapCard(key: string): RecapCard {
  return toCard(getRecapCardData(key))
}
