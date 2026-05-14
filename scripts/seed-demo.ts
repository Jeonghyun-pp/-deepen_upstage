/**
 * 해커톤 데모 seed — 곡선 밖 접선 prerequisite 체인.
 *
 * 실행:  npx tsx scripts/seed-demo.ts
 *
 * 무엇을 하나:
 *   1. DEV_AUTH_BYPASS_USER_ID 가 가리키는 user row 가 있는지 확인
 *   2. 기존 데모 데이터(meta.kind='hackathon_demo') 모두 삭제 → 재seed (idempotent)
 *   3. Context 문서 1개 (NCIC 교육과정 발췌) + 5 chunks
 *   4. Pattern 6개 (LEAF-1·2·3, MID-1·2, TARGET) — 한국어 prereq 체인
 *   5. Item 8개 (Q1~Q8) — 모두 5지선다
 *   6. Edges: prerequisite (Pattern→Pattern) + contains (Pattern→Item)
 *   7. chunkNodeMap: 인용 chunk → Pattern (confidence)
 *
 * 결과:
 *   /demo 진입 → 그래프 그대로 표시 가능
 */

import { config } from "dotenv"
import { eq, inArray } from "drizzle-orm"
import { db } from "../lib/db"
import {
  chunkNodeMap,
  chunks,
  documents,
  edges,
  nodes,
  users,
} from "../lib/db/schema"
import {
  CHUNK_C1,
  CHUNK_C2,
  CHUNK_C3,
  CHUNK_C4,
  CHUNK_C5,
  DEMO_DOC_ID,
  DEMO_META_FLAG,
  ITEM_Q1,
  ITEM_Q2,
  ITEM_Q3,
  ITEM_Q4,
  ITEM_Q5,
  ITEM_Q6,
  ITEM_Q7,
  ITEM_Q8,
  PATTERN_LEAF_1,
  PATTERN_LEAF_2,
  PATTERN_LEAF_3,
  PATTERN_MID_1,
  PATTERN_MID_2,
  PATTERN_TARGET,
} from "../lib/demo/constants"

config({ path: ".env.local" })

async function main() {
  const userId = process.env.DEV_AUTH_BYPASS_USER_ID
  if (!userId) {
    console.error("❌ DEV_AUTH_BYPASS_USER_ID not set in .env.local")
    process.exit(1)
  }

  // users row 가 있는지 확인.
  const [user] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.id, userId))
    .limit(1)
  if (!user) {
    console.error(
      `❌ users(id=${userId}) row 없음. 먼저 /v2 한 번 진입해서 row 생성하거나 직접 insert 해주세요.`,
    )
    process.exit(1)
  }
  console.log(`✓ demo user: ${userId}`)

  // 1) 기존 데모 데이터 정리 — 노드 cascade 로 edges/chunkNodeMap 도 함께 삭제.
  const allDemoNodeIds = [
    PATTERN_LEAF_1, PATTERN_LEAF_2, PATTERN_LEAF_3,
    PATTERN_MID_1, PATTERN_MID_2, PATTERN_TARGET,
    ITEM_Q1, ITEM_Q2, ITEM_Q3, ITEM_Q4,
    ITEM_Q5, ITEM_Q6, ITEM_Q7, ITEM_Q8,
  ]
  await db.delete(nodes).where(inArray(nodes.id, allDemoNodeIds))
  await db.delete(chunks).where(eq(chunks.documentId, DEMO_DOC_ID))
  await db.delete(documents).where(eq(documents.id, DEMO_DOC_ID))
  console.log("✓ 기존 데모 데이터 삭제")

  // 2) Context 문서 + chunks
  await db.insert(documents).values({
    id: DEMO_DOC_ID,
    userId,
    title: "2022 개정 수학과 교육과정 (NCIC 발췌)",
    storagePath: "demo/ncic-curriculum.pdf",
    pageCount: 6,
    status: "ready",
  })

  await db.insert(chunks).values([
    {
      id: CHUNK_C1,
      userId,
      documentId: DEMO_DOC_ID,
      ordinal: 1,
      sectionTitle: "중3 · 이차방정식의 근의 판별",
      content:
        "이차방정식 ax²+bx+c=0의 근의 판별. 판별식 D=b²-4ac의 부호에 따라 서로 다른 두 실근(D>0), 중근(D=0), 허근(D<0)으로 판단한다.",
    },
    {
      id: CHUNK_C2,
      userId,
      documentId: DEMO_DOC_ID,
      ordinal: 2,
      sectionTitle: "고1 · 이차방정식과 이차함수",
      content:
        "이차방정식 ax²+bx+c=0이 실근을 가질 조건은 D≥0이다. 이차함수 y=ax²+bx+c가 x축과 두 점에서 만날 조건은 D>0이다.",
    },
    {
      id: CHUNK_C3,
      userId,
      documentId: DEMO_DOC_ID,
      ordinal: 3,
      sectionTitle: "고2 수학Ⅱ · 미분계수",
      content:
        "함수 f(x)가 x=a에서 미분가능할 때 미분계수 f'(a)는 곡선 y=f(x) 위의 점 (a, f(a))에서의 접선의 기울기와 같다.",
    },
    {
      id: CHUNK_C4,
      userId,
      documentId: DEMO_DOC_ID,
      ordinal: 4,
      sectionTitle: "고2 수학Ⅱ · 접선의 방정식",
      content:
        "곡선 y=f(x) 위의 점 (a, f(a))에서의 접선의 방정식은 y-f(a) = f'(a)(x-a) 이다.",
    },
    {
      id: CHUNK_C5,
      userId,
      documentId: DEMO_DOC_ID,
      ordinal: 5,
      sectionTitle: "고2 수학Ⅱ · 곡선 밖 접선",
      content:
        "곡선 밖의 한 점에서 그은 접선의 개수를 구할 때는 접점을 미지수 t로 두고 접선이 그 점을 지나는 조건에서 t에 관한 방정식을 얻는다. 그 방정식의 실근 개수가 접선의 개수이며, 판별식 분석이 필요하다.",
    },
  ])
  console.log("✓ Context 문서 + 5 chunks")

  // 3) Pattern nodes
  await db.insert(nodes).values([
    {
      id: PATTERN_LEAF_1,
      userId: null,
      type: "pattern",
      displayLayer: "concept",
      label: "판별식",
      content:
        "이차방정식 ax²+bx+c=0의 실근 개수를 D=b²-4ac의 부호로 판별. D>0 두 실근, D=0 중근, D<0 허근.",
      tldr: "판별식 D=b²-4ac",
      grade: "중3",
      signature: ["판별식", "이차방정식"],
      whiteboardPos: { x: 200, y: 100 },
      meta: { ...DEMO_META_FLAG, key: "LEAF-1" },
    },
    {
      id: PATTERN_LEAF_2,
      userId: null,
      type: "pattern",
      displayLayer: "concept",
      label: "이차방정식 근 존재 조건",
      content: "이차방정식이 실근을 가질 조건 D≥0.",
      tldr: "D≥0 ⇔ 실근",
      grade: "고1",
      signature: ["이차방정식", "근의 존재"],
      whiteboardPos: { x: 500, y: 100 },
      meta: { ...DEMO_META_FLAG, key: "LEAF-2" },
    },
    {
      id: PATTERN_LEAF_3,
      userId: null,
      type: "pattern",
      displayLayer: "concept",
      label: "미분계수 = 접선 기울기",
      content: "f'(a) = 점 (a, f(a))에서의 접선의 기울기.",
      tldr: "f'(a) = 접선 기울기",
      grade: "고2",
      signature: ["미분계수", "접선", "기울기"],
      whiteboardPos: { x: 800, y: 100 },
      meta: { ...DEMO_META_FLAG, key: "LEAF-3" },
    },
    {
      id: PATTERN_MID_1,
      userId: null,
      type: "pattern",
      displayLayer: "pattern",
      label: "이차함수와 직선의 위치관계",
      content:
        "이차함수와 직선이 만나는 점의 개수 = 두 식을 연립한 이차방정식의 판별식 부호.",
      tldr: "위치관계 ↔ 판별식",
      grade: "고1",
      signature: ["이차함수", "직선", "위치관계"],
      whiteboardPos: { x: 350, y: 350 },
      meta: { ...DEMO_META_FLAG, key: "MID-1" },
    },
    {
      id: PATTERN_MID_2,
      userId: null,
      type: "pattern",
      displayLayer: "pattern",
      label: "곡선 위 점에서의 접선의 방정식",
      content:
        "곡선 y=f(x) 위의 점 (a, f(a))에서의 접선: y - f(a) = f'(a)(x - a).",
      tldr: "y - f(a) = f'(a)(x-a)",
      grade: "고2",
      signature: ["접선", "미분"],
      whiteboardPos: { x: 700, y: 350 },
      meta: { ...DEMO_META_FLAG, key: "MID-2" },
    },
    {
      id: PATTERN_TARGET,
      userId: null,
      type: "pattern",
      displayLayer: "pattern",
      label: "곡선 밖 한 점에서 그은 접선의 개수",
      content:
        "곡선 밖 점 P에서 그은 접선의 접점을 t로 두면 f'(t)·(P_x - t) = P_y - f(t). 이 t-방정식의 실근 개수 = 접선의 개수. 판별식 분석 필요.",
      tldr: "접점 t-방정식의 실근 = 접선 개수",
      grade: "고2",
      signature: ["접선", "곡선 밖", "판별식"],
      isKiller: true,
      whiteboardPos: { x: 500, y: 600 },
      meta: { ...DEMO_META_FLAG, key: "TARGET" },
    },
  ])
  console.log("✓ Pattern 노드 6개")

  // 4) Item nodes (Q1~Q8)
  await db.insert(nodes).values([
    {
      id: ITEM_Q1,
      userId: null,
      type: "item",
      label: "Q1. 판별식 단독",
      content: "이차방정식 x² + kx + 4 = 0 이 서로 다른 두 실근을 가질 때, 실수 k 의 값의 범위는?",
      grade: "중3",
      itemSource: "데모 LEAF-1",
      itemChoices: [
        "k < -4 또는 k > 4",
        "k > -4",
        "-4 < k < 4",
        "k > 0",
        "k ≠ 0",
      ],
      itemAnswer: "1",
      itemSolution: "D = k² - 16 > 0 ⇔ k² > 16 ⇔ k < -4 또는 k > 4.",
      itemDifficulty: 0.3,
      meta: { ...DEMO_META_FLAG, label: "LEAF-1" },
    },
    {
      id: ITEM_Q2,
      userId: null,
      type: "item",
      label: "Q2. 이차함수 x축 교점",
      content: "이차함수 y = x² - 2x + a 가 x축과 서로 다른 두 점에서 만나도록 하는 실수 a 의 범위는?",
      grade: "고1",
      itemSource: "데모 LEAF-2",
      itemChoices: ["a < 1", "a > 1", "a < -1", "a < 0", "모든 실수"],
      itemAnswer: "1",
      itemSolution: "D = 4 - 4a > 0 ⇔ a < 1.",
      itemDifficulty: 0.35,
      meta: { ...DEMO_META_FLAG, label: "LEAF-2" },
    },
    {
      id: ITEM_Q3,
      userId: null,
      type: "item",
      label: "Q3. 이차함수와 직선 위치관계",
      content: "이차함수 y = x² + kx 와 직선 y = 2x 가 서로 다른 두 점에서 만나도록 하는 k 의 범위는?",
      grade: "고1",
      itemSource: "데모 MID-1",
      itemChoices: [
        "k > 2 또는 k < -2",
        "k ≠ 2",
        "-2 < k < 2",
        "k > 0",
        "k = 2",
      ],
      itemAnswer: "1",
      itemSolution: "x² + (k-2)x = 0 의 판별식 > 0 ⇔ (k-2)² > 0 ⇔ k ≠ 2. 정답 보기는 k≠2 의 표현인 ①.",
      itemDifficulty: 0.5,
      meta: { ...DEMO_META_FLAG, label: "MID-1" },
    },
    {
      id: ITEM_Q4,
      userId: null,
      type: "item",
      label: "Q4. 미분계수 = 접선 기울기",
      content: "f(x) = x³ - 3x² + 1 일 때, 곡선 y = f(x) 위의 점 (1, f(1)) 에서의 접선의 기울기는?",
      grade: "고2",
      itemSource: "데모 LEAF-3",
      itemChoices: ["-3", "-1", "0", "1", "3"],
      itemAnswer: "1",
      itemSolution: "f'(x) = 3x² - 6x. f'(1) = 3 - 6 = -3.",
      itemDifficulty: 0.4,
      meta: { ...DEMO_META_FLAG, label: "LEAF-3" },
    },
    {
      id: ITEM_Q5,
      userId: null,
      type: "item",
      label: "Q5. 곡선 위 접선",
      content: "곡선 y = x² - 3x 위의 점 (2, -2) 에서의 접선의 방정식은?",
      grade: "고2",
      itemSource: "데모 MID-2",
      itemChoices: [
        "y = x - 4",
        "y = -x",
        "y = 2x - 6",
        "y = 3x - 8",
        "y = x - 2",
      ],
      itemAnswer: "1",
      itemSolution: "f'(x) = 2x - 3. f'(2) = 1. y - (-2) = 1·(x-2) ⇒ y = x - 4.",
      itemDifficulty: 0.55,
      meta: { ...DEMO_META_FLAG, label: "MID-2" },
    },
    {
      id: ITEM_Q6,
      userId: null,
      type: "item",
      label: "Q6. ★ 곡선 밖 접선 개수 (TARGET)",
      content: "점 (0, -3) 에서 곡선 y = x² + x + 1 에 그은 접선의 개수는?",
      grade: "고2",
      itemSource: "데모 TARGET (평가원 곡선 밖 접선 유형)",
      itemChoices: ["0개", "1개", "2개", "3개", "4개"],
      itemAnswer: "3",
      itemSolution:
        "접점 (t, t²+t+1). 기울기 2t+1. 접선이 (0,-3) 을 지나려면: -3 - (t²+t+1) = (2t+1)(0-t) ⇒ -t²-t-4 = -2t²-t ⇒ t² = 4 ⇒ t = ±2. 두 개.",
      itemDifficulty: 0.75,
      meta: { ...DEMO_META_FLAG, label: "TARGET" },
    },
    {
      id: ITEM_Q7,
      userId: null,
      type: "item",
      label: "Q7. 곡선 밖 접선 + 모수",
      content: "점 (a, 0) 에서 곡선 y = x² + 1 에 그은 접선이 두 개일 때, 실수 a 의 조건은?",
      grade: "고2",
      itemSource: "데모 TARGET+ (응용)",
      itemChoices: ["a < -1 또는 a > 1", "a ≠ 0", "a > 0", "모든 실수", "a < 1"],
      itemAnswer: "2",
      itemSolution:
        "접점 (t, t²+1), 기울기 2t. 0-(t²+1) = 2t(a-t) ⇒ t²-2at+1=0. D/4 = a²-1 > 0 ⇔ a² > 1.",
      itemDifficulty: 0.8,
      meta: { ...DEMO_META_FLAG, label: "TARGET+" },
    },
    {
      id: ITEM_Q8,
      userId: null,
      type: "item",
      label: "Q8. (distractor) 함수 극한",
      content: "lim_{x→1} (x² - 1) / (x - 1) 의 값은?",
      grade: "고2",
      itemSource: "데모 NEGATIVE (다른 단원)",
      itemChoices: ["0", "1", "2", "3", "발산"],
      itemAnswer: "3",
      itemSolution: "(x-1)(x+1)/(x-1) = x+1 → 2.",
      itemDifficulty: 0.25,
      meta: { ...DEMO_META_FLAG, label: "NEGATIVE" },
    },
  ])
  console.log("✓ Item 노드 8개")

  // 5) Edges — prerequisite
  await db.insert(edges).values([
    { userId, sourceNodeId: PATTERN_LEAF_1, targetNodeId: PATTERN_LEAF_2, type: "prerequisite", weight: 0.9 },
    { userId, sourceNodeId: PATTERN_LEAF_1, targetNodeId: PATTERN_MID_1, type: "prerequisite", weight: 0.9 },
    { userId, sourceNodeId: PATTERN_LEAF_2, targetNodeId: PATTERN_MID_1, type: "prerequisite", weight: 0.7 },
    { userId, sourceNodeId: PATTERN_LEAF_3, targetNodeId: PATTERN_MID_2, type: "prerequisite", weight: 0.95 },
    { userId, sourceNodeId: PATTERN_MID_2, targetNodeId: PATTERN_TARGET, type: "prerequisite", weight: 0.9 },
    { userId, sourceNodeId: PATTERN_LEAF_1, targetNodeId: PATTERN_TARGET, type: "prerequisite", weight: 0.85 },
    { userId, sourceNodeId: PATTERN_MID_1, targetNodeId: PATTERN_TARGET, type: "prerequisite", weight: 0.7 },
  ])

  // Pattern → Item (contains)
  await db.insert(edges).values([
    { userId, sourceNodeId: PATTERN_LEAF_1, targetNodeId: ITEM_Q1, type: "contains" },
    { userId, sourceNodeId: PATTERN_LEAF_2, targetNodeId: ITEM_Q2, type: "contains" },
    { userId, sourceNodeId: PATTERN_MID_1, targetNodeId: ITEM_Q3, type: "contains" },
    { userId, sourceNodeId: PATTERN_LEAF_3, targetNodeId: ITEM_Q4, type: "contains" },
    { userId, sourceNodeId: PATTERN_MID_2, targetNodeId: ITEM_Q5, type: "contains" },
    { userId, sourceNodeId: PATTERN_TARGET, targetNodeId: ITEM_Q6, type: "contains" },
    { userId, sourceNodeId: PATTERN_TARGET, targetNodeId: ITEM_Q7, type: "contains" },
    // Q8 은 distractor — contains 안 함
  ])
  console.log("✓ Edges (prereq 7 + contains 7)")

  // 6) chunkNodeMap — Context chunk → Pattern (인용 후보)
  await db.insert(chunkNodeMap).values([
    { chunkId: CHUNK_C1, nodeId: PATTERN_LEAF_1, state: "confirmed", confidence: 0.95, proposedBy: "llm" },
    { chunkId: CHUNK_C2, nodeId: PATTERN_LEAF_2, state: "confirmed", confidence: 0.9, proposedBy: "llm" },
    { chunkId: CHUNK_C2, nodeId: PATTERN_MID_1, state: "confirmed", confidence: 0.8, proposedBy: "llm" },
    { chunkId: CHUNK_C3, nodeId: PATTERN_LEAF_3, state: "confirmed", confidence: 0.95, proposedBy: "llm" },
    { chunkId: CHUNK_C4, nodeId: PATTERN_MID_2, state: "confirmed", confidence: 0.9, proposedBy: "llm" },
    { chunkId: CHUNK_C5, nodeId: PATTERN_TARGET, state: "confirmed", confidence: 0.85, proposedBy: "llm" },
  ])
  console.log("✓ chunkNodeMap 6 매핑")

  console.log("\n🎉 데모 seed 완료. /demo 진입 가능.")
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ seed 실패:", err)
  process.exit(1)
})
