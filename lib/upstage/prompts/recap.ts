/**
 * ⑤ 리캡 — 정적 카드 5장 schema.
 *
 * 데모 V1 은 LLM 호출 없이 정적 카드 (lib/demo/recap-cards.ts) 만 렌더.
 * 이 모듈은 카드 shape 의 단일 source of truth.
 *
 * 시간 남으면 Solar Pro 가 코치 톤으로 카드 본문을 다듬는 옵션도 가능.
 */

import { z } from "zod"

export const RecapCard = z.object({
  /** 카드 슬롯 식별자 — UI 가 5장 순서 고정에 사용. */
  slot: z.enum([
    "deficit", // 1. 오늘 발견된 결손
    "curriculum", // 2. 교육과정 정렬
    "next_items", // 3. 다음 학습
    "impact", // 4. 영향 범위
    "retry", // 5. 재시도 CTA
  ]),
  title: z.string(),
  body: z.string(),
  /** 선택: 카드별 메타 (성취기준 코드, item id 등) */
  meta: z.record(z.string(), z.unknown()).optional(),
})

export const RecapDeck = z.object({
  cards: z.array(RecapCard).length(5),
})

export type RecapCardT = z.infer<typeof RecapCard>
export type RecapDeckT = z.infer<typeof RecapDeck>

/**
 * (옵션) Solar Pro 가 카드 본문을 다듬을 때 쓰는 input.
 * V1 에선 호출 안 함.
 */
export const RecapPolishInput = z.object({
  leafLabel: z.string(),
  leafContent: z.string(),
  chunkContent: z.string(),
  chunkSectionTitle: z.string().nullable(),
  itemPreview: z.array(z.object({ label: z.string(), content: z.string() })),
})

export type RecapPolishInputT = z.infer<typeof RecapPolishInput>

/**
 * ★ FILL (옵션) — 프롬프트 팀.
 * V1 에선 빈 채로 두고, 시간 남으면 카드 톤 다듬는 prompt 작성.
 */
export const SYSTEM = `너는 한국 입시 코치야. 학생이 결손을 발견한 직후, 5장의 카드로
오늘의 학습을 정리한다. 카드 각 본문은 2~3 문장, 한국어, 격려 톤.`
