/**
 * 데모 데이터 fetch — DB seed 결과를 읽어 화면에 공급.
 *
 * 모든 함수는 server-side. /demo/* 페이지에서 직접 호출.
 */

import { eq, inArray, isNull } from "drizzle-orm"
import { db } from "@/lib/db"
import { chunks, chunkNodeMap, edges, nodes } from "@/lib/db/schema"
import { DEMO_DOC_ID, DEMO_META_FLAG } from "./constants"

export type DemoNode = {
  id: string
  type: "pattern" | "item"
  label: string
  content: string
  grade: string | null
  displayLayer: "concept" | "pattern" | null
  isKiller: boolean
  x: number | null
  y: number | null
  itemAnswer: string | null
  itemChoices: string[] | null
  itemSolution: string | null
}

export type DemoEdge = {
  source: string
  target: string
  type: "prerequisite" | "contains" | "relatedTo"
  weight: number | null
}

export type DemoGraph = {
  nodes: DemoNode[]
  edges: DemoEdge[]
}

/** 데모 그래프 전체 (Pattern + Item, 모든 edges). */
export async function loadDemoGraph(): Promise<DemoGraph> {
  // meta.kind='hackathon_demo' 인 노드 + 그 edges.
  const allNodes = await db
    .select()
    .from(nodes)
    .where(isNull(nodes.userId))
  const demoNodes = allNodes.filter((n) => {
    const meta = n.meta as { kind?: string } | null
    return meta?.kind === DEMO_META_FLAG.kind
  })

  const nodeIds = demoNodes.map((n) => n.id)
  const allEdges =
    nodeIds.length === 0
      ? []
      : await db
          .select()
          .from(edges)
          .where(
            // 양쪽 다 데모 노드인 edge 만.
            inArray(edges.sourceNodeId, nodeIds),
          )

  const demoEdges = allEdges.filter(
    (e) =>
      nodeIds.includes(e.sourceNodeId) && nodeIds.includes(e.targetNodeId),
  )

  return {
    nodes: demoNodes.map((n) => ({
      id: n.id,
      type: n.type,
      label: n.label,
      content: n.content,
      grade: n.grade,
      displayLayer: n.displayLayer,
      isKiller: n.isKiller,
      x: (n.whiteboardPos as { x: number; y: number } | null)?.x ?? null,
      y: (n.whiteboardPos as { x: number; y: number } | null)?.y ?? null,
      itemAnswer: n.itemAnswer,
      itemChoices: n.itemChoices,
      itemSolution: n.itemSolution,
    })),
    edges: demoEdges.map((e) => ({
      source: e.sourceNodeId,
      target: e.targetNodeId,
      type: e.type,
      weight: e.weight,
    })),
  }
}

/** Item 1개 조회. */
export async function loadDemoItem(itemId: string): Promise<DemoNode | null> {
  const [row] = await db.select().from(nodes).where(eq(nodes.id, itemId)).limit(1)
  if (!row) return null
  return {
    id: row.id,
    type: row.type,
    label: row.label,
    content: row.content,
    grade: row.grade,
    displayLayer: row.displayLayer,
    isKiller: row.isKiller,
    x: (row.whiteboardPos as { x: number; y: number } | null)?.x ?? null,
    y: (row.whiteboardPos as { x: number; y: number } | null)?.y ?? null,
    itemAnswer: row.itemAnswer,
    itemChoices: row.itemChoices,
    itemSolution: row.itemSolution,
  }
}

/** Context 문서 chunks (인용 후보). */
export async function loadDemoChunks(): Promise<
  { id: string; content: string; sectionTitle: string | null }[]
> {
  const rows = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      sectionTitle: chunks.sectionTitle,
    })
    .from(chunks)
    .where(eq(chunks.documentId, DEMO_DOC_ID))
  return rows
}

/** 특정 Pattern 노드에 매핑된 chunks (인용 lookup). */
export async function loadChunksForPattern(
  patternId: string,
): Promise<{ id: string; content: string; sectionTitle: string | null; confidence: number }[]> {
  const rows = await db
    .select({
      id: chunks.id,
      content: chunks.content,
      sectionTitle: chunks.sectionTitle,
      confidence: chunkNodeMap.confidence,
    })
    .from(chunkNodeMap)
    .innerJoin(chunks, eq(chunks.id, chunkNodeMap.chunkId))
    .where(eq(chunkNodeMap.nodeId, patternId))
  return rows
}
