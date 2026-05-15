/**
 * 해커톤 데모 seed — data/demo/*.json 부어넣기.
 *
 * 실행:  npx tsx scripts/seed-demo.ts
 *
 * 흐름 (전부 lib/demo/data-loader 가 검증한 데이터에서 derive):
 *   1. DEV_AUTH_BYPASS_USER_ID 가 가리키는 user row 확인.
 *   2. 기존 데모 데이터(meta.kind='hackathon_demo') 모두 삭제 → 재seed (idempotent).
 *   3. Context 문서 1개 + chunks N개.
 *   4. Pattern N개 (data/demo/patterns.json).
 *   5. Item N개 (data/demo/items.json).
 *   6. Edges: prerequisite (edges.json) + contains (items.patternKey 에서 자동).
 *   7. chunkNodeMap: chunks.patternMappings 에서 자동.
 *
 * 데이터 늘리기: data/demo/*.json 만 수정. 이 스크립트 코드는 건드릴 일 없음.
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
import { DEMO_DOC_ID, DEMO_META_FLAG } from "../lib/demo/constants"
import { DEMO_DOCUMENT, loadDemoData } from "../lib/demo/data-loader"

config({ path: ".env.local" })

async function main() {
  const userId = process.env.DEV_AUTH_BYPASS_USER_ID
  if (!userId) {
    console.error("❌ DEV_AUTH_BYPASS_USER_ID not set in .env.local")
    process.exit(1)
  }

  // users row 확인.
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

  // ── 데이터 로드 + 검증 ──
  const data = loadDemoData()
  console.log(
    `✓ data/demo/*.json 로드: ` +
      `patterns=${data.patterns.length}, items=${data.items.length}, ` +
      `chunks=${data.chunks.length}, prereq=${data.edges.prerequisite.length}, ` +
      `recap-cards=${data.recapCards.length}`,
  )

  // ── 1) 기존 데모 데이터 정리 ──
  const allDemoNodeIds = [
    ...data.patterns.map((p) => p.uuid),
    ...data.items.map((i) => i.uuid),
  ]
  if (allDemoNodeIds.length > 0) {
    await db.delete(nodes).where(inArray(nodes.id, allDemoNodeIds))
  }
  await db.delete(chunks).where(eq(chunks.documentId, DEMO_DOC_ID))
  await db.delete(documents).where(eq(documents.id, DEMO_DOC_ID))
  console.log("✓ 기존 데모 데이터 삭제")

  // ── 2) Context 문서 + chunks ──
  await db.insert(documents).values({
    id: DEMO_DOC_ID,
    userId,
    title: DEMO_DOCUMENT.title,
    storagePath: DEMO_DOCUMENT.storagePath,
    pageCount: DEMO_DOCUMENT.pageCount,
    status: "ready",
  })

  await db.insert(chunks).values(
    data.chunks.map((c) => ({
      id: c.uuid,
      userId,
      documentId: DEMO_DOC_ID,
      ordinal: c.ordinal,
      sectionTitle: c.sectionTitle ?? null,
      content: c.content,
    })),
  )
  console.log(`✓ Context 문서 + ${data.chunks.length} chunks`)

  // ── 3) Pattern nodes ──
  await db.insert(nodes).values(
    data.patterns.map((p) => ({
      id: p.uuid,
      userId: null,
      type: "pattern" as const,
      displayLayer: p.displayLayer,
      label: p.label,
      content: p.content,
      tldr: p.tldr ?? null,
      grade: p.grade ?? null,
      signature: p.signature ?? null,
      isKiller: p.isKiller ?? false,
      whiteboardPos: p.whiteboardPos ?? null,
      meta: { ...DEMO_META_FLAG, key: p.stableKey },
    })),
  )
  console.log(`✓ Pattern 노드 ${data.patterns.length}개`)

  // ── 4) Item nodes ──
  await db.insert(nodes).values(
    data.items.map((i) => ({
      id: i.uuid,
      userId: null,
      type: "item" as const,
      label: i.label,
      content: i.content,
      grade: i.grade ?? null,
      itemSource: i.itemSource ?? null,
      itemChoices: i.itemChoices,
      itemAnswer: i.itemAnswer,
      itemSolution: i.itemSolution,
      itemDifficulty: i.itemDifficulty ?? null,
      meta: {
        ...DEMO_META_FLAG,
        label: i.metaLabel ?? i.patternKey ?? "ITEM",
        ...(i.isTarget ? { isTarget: true } : {}),
        ...(i.isDistractor ? { isDistractor: true } : {}),
      },
    })),
  )
  console.log(`✓ Item 노드 ${data.items.length}개`)

  // ── 5) Edges — prerequisite ──
  const prereqRows = data.edges.prerequisite.map((e) => {
    const from = data.patternByKey.get(e.from)
    const to = data.patternByKey.get(e.to)
    if (!from || !to) {
      throw new Error(`unknown pattern in edge: ${e.from} → ${e.to}`)
    }
    return {
      userId,
      sourceNodeId: from.uuid,
      targetNodeId: to.uuid,
      type: "prerequisite" as const,
      weight: e.weight,
    }
  })
  if (prereqRows.length > 0) {
    await db.insert(edges).values(prereqRows)
  }

  // ── 6) Edges — contains (items.patternKey 에서 자동) ──
  const containsRows = data.items
    .filter((i) => !!i.patternKey)
    .map((i) => {
      const p = data.patternByKey.get(i.patternKey!)!
      return {
        userId,
        sourceNodeId: p.uuid,
        targetNodeId: i.uuid,
        type: "contains" as const,
      }
    })
  if (containsRows.length > 0) {
    await db.insert(edges).values(containsRows)
  }
  console.log(
    `✓ Edges (prereq ${prereqRows.length} + contains ${containsRows.length})`,
  )

  // ── 7) chunkNodeMap (chunks.patternMappings 에서 자동) ──
  const chunkMapRows = data.chunks.flatMap((c) =>
    c.patternMappings.map((m) => {
      const p = data.patternByKey.get(m.patternKey)!
      return {
        chunkId: c.uuid,
        nodeId: p.uuid,
        state: "confirmed" as const,
        confidence: m.confidence,
        proposedBy: "llm" as const,
      }
    }),
  )
  if (chunkMapRows.length > 0) {
    await db.insert(chunkNodeMap).values(chunkMapRows)
  }
  console.log(`✓ chunkNodeMap ${chunkMapRows.length} 매핑`)

  console.log("\n🎉 데모 seed 완료. /demo 진입 가능.")
  process.exit(0)
}

main().catch((err) => {
  console.error("❌ seed 실패:", err)
  process.exit(1)
})
