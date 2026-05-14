/**
 * 데모 데이터 상수 — UUID 고정.
 *
 * 데모 페이지 (/demo/*) 와 seed 스크립트 (scripts/seed-demo.ts) 가 공유.
 * Q6 (TARGET) 는 데모 핵심 동선이라 ID 박아둠.
 */

// Pattern nodes
export const PATTERN_LEAF_1 = "11111111-1111-4111-8111-111111111111" // 판별식 (중3)
export const PATTERN_LEAF_2 = "22222222-2222-4222-8222-222222222222" // 이차방정식 근 존재 (고1)
export const PATTERN_LEAF_3 = "33333333-3333-4333-8333-333333333333" // 미분계수=접선 기울기 (고2)
export const PATTERN_MID_1 = "44444444-4444-4444-8444-444444444444" // 이차함수+직선 위치관계
export const PATTERN_MID_2 = "55555555-5555-4555-8555-555555555555" // 곡선 위 접선 방정식
export const PATTERN_TARGET = "66666666-6666-4666-8666-666666666666" // ★ 곡선 밖 접선 개수

// Item nodes (Q1~Q8)
export const ITEM_Q1 = "a1111111-1111-4111-8111-111111111111"
export const ITEM_Q2 = "a2222222-2222-4222-8222-222222222222"
export const ITEM_Q3 = "a3333333-3333-4333-8333-333333333333"
export const ITEM_Q4 = "a4444444-4444-4444-8444-444444444444"
export const ITEM_Q5 = "a5555555-5555-4555-8555-555555555555"
export const ITEM_Q6 = "a6666666-6666-4666-8666-666666666666" // ★ TARGET item
export const ITEM_Q7 = "a7777777-7777-4777-8777-777777777777"
export const ITEM_Q8 = "a8888888-8888-4888-8888-888888888888" // distractor

// Context document
export const DEMO_DOC_ID = "d0000000-0000-4000-8000-000000000001"

// Context chunks (인용 후보)
export const CHUNK_C1 = "c1111111-1111-4111-8111-111111111111" // 판별식
export const CHUNK_C2 = "c2222222-2222-4222-8222-222222222222" // 이차방정식 근 존재
export const CHUNK_C3 = "c3333333-3333-4333-8333-333333333333" // 미분계수
export const CHUNK_C4 = "c4444444-4444-4444-8444-444444444444" // 접선 방정식
export const CHUNK_C5 = "c5555555-5555-4555-8555-555555555555" // 곡선 밖 접선

export const DEMO_TARGET_ITEM_ID = ITEM_Q6

/** 데모 데이터를 식별·삭제할 때 쓰는 meta 필드 키. */
export const DEMO_META_FLAG = { kind: "hackathon_demo" as const }

export type DemoPatternKey =
  | "LEAF-1"
  | "LEAF-2"
  | "LEAF-3"
  | "MID-1"
  | "MID-2"
  | "TARGET"

export const PATTERN_BY_KEY: Record<DemoPatternKey, string> = {
  "LEAF-1": PATTERN_LEAF_1,
  "LEAF-2": PATTERN_LEAF_2,
  "LEAF-3": PATTERN_LEAF_3,
  "MID-1": PATTERN_MID_1,
  "MID-2": PATTERN_MID_2,
  TARGET: PATTERN_TARGET,
}
