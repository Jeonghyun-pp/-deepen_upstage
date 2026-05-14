/**
 * ④ 결손 역추적 — 데모용 통합 함수.
 *
 * 흐름:
 *   1. itemId 에서 contains 로 연결된 Pattern (= TARGET) 찾기
 *   2. TARGET 의 prerequisite Pattern 들 BFS (깊이 2)
 *   3. 각 후보 prereq 에 대해 Solar Pro 호출 (lib/upstage/client.ts)
 *      - 학생 풀이(stub: "wrong" 캐시) + 정답을 비교
 *      - 본문 인용 (chunkNodeMap) 후보 chunks 제공
 *   4. top-1 candidate 반환 + BFS 경로 + 인용
 *
 * Fallback (Upstage 미설정 시):
 *   - prereq weight 가 가장 높은 노드 + 매핑된 chunk 인용 정적 반환.
 */

import { and, eq, inArray } from "drizzle-orm"
import { db } from "@/lib/db"
import { edges, nodes } from "@/lib/db/schema"
import { isAvailable, scorePrereqMatch } from "@/lib/upstage/client"
import { loadDemoItem, loadChunksForPattern } from "./queries"
import { PATTERN_LEAF_1 } from "./constants"

export interface DiagnosisResult {
  /** Target item (Q6). */
  target: { id: string; label: string; content: string }
  /** 가장 가능성 높은 prereq 후보. */
  candidate: {
    id: string
    label: string
    content: string
    score: number
    rationale: string
  }
  /** TARGET → ... → candidate 경로 (Pattern id 배열). */
  bfsPath: string[]
  /** Context 본문 인용 + chunk id. */
  justification: { quote: string; chunkId: string; sectionTitle: string | null } | null
  /** 학생 풀이 단계 (LaTeX). */
  studentSteps: string[]
  /** 학생/정답. */
  studentAnswer: string
  correctAnswer: string
}

/** 데모용 stub 학생 풀이 — 의도적으로 판별식 단계 누락. */
const STUB_WRONG_ATTEMPT = {
  steps: [
    "접점 (t, t^2 + t + 1)",
    "접선의 기울기 = 2t + 1",
    "접선이 (0, -3) 을 지난다: -3 = (2t+1)(0 - t) + (t^2 + t + 1)",
    "정리: -3 = -2t^2 - t + t^2 + t + 1",
    "-t^2 = 4 → t^2 = -4 (불가능)",
  ],
  studentAnswer: "0개",
  // 실수: 부호 처리 + 판별식 응용 누락
}

export async function diagnoseAttempt({
  itemId,
  attemptKey: _attemptKey,
}: {
  itemId: string
  attemptKey: string
}): Promise<DiagnosisResult> {
  const target = await loadDemoItem(itemId)
  if (!target) throw new Error(`item not found: ${itemId}`)

  // 1) Pattern --contains--> Item 의 source Pattern.
  const [containerEdge] = await db
    .select({ source: edges.sourceNodeId })
    .from(edges)
    .where(and(eq(edges.targetNodeId, itemId), eq(edges.type, "contains")))
    .limit(1)
  const targetPatternId = containerEdge?.source

  // 2) Pattern --prerequisite--> targetPattern 들 (직접 prereq).
  let prereqIds: string[] = []
  if (targetPatternId) {
    const prereqRows = await db
      .select({ source: edges.sourceNodeId, weight: edges.weight })
      .from(edges)
      .where(
        and(
          eq(edges.targetNodeId, targetPatternId),
          eq(edges.type, "prerequisite"),
        ),
      )
    prereqIds = prereqRows.map((r) => r.source)
  }

  if (prereqIds.length === 0) prereqIds = [PATTERN_LEAF_1] // fallback

  const prereqs = await db
    .select()
    .from(nodes)
    .where(inArray(nodes.id, prereqIds))

  // 3) 각 prereq 에 대해 score. Upstage 가용하면 LLM, 아니면 weight 기반.
  let bestId = prereqs[0]!.id
  let bestScore = 0
  let bestRationale = ""
  let bestJustification: { quote: string; chunkId: string; sectionTitle: string | null } | null =
    null

  for (const p of prereqs) {
    const candidateChunks = await loadChunksForPattern(p.id)

    if (isAvailable()) {
      try {
        const result = await scorePrereqMatch({
          steps: STUB_WRONG_ATTEMPT.steps,
          studentAnswer: STUB_WRONG_ATTEMPT.studentAnswer,
          correctAnswer: target.itemAnswer ?? "?",
          targetPattern: { label: target.label, content: target.content },
          candidatePattern: { id: p.id, label: p.label, content: p.content },
          contextChunks: candidateChunks.map((c) => ({ id: c.id, content: c.content })),
        })
        if (result.score > bestScore) {
          bestScore = result.score
          bestId = p.id
          bestRationale = result.rationale
          if (result.justification && result.justificationChunkId) {
            const chunk = candidateChunks.find((c) => c.id === result.justificationChunkId)
            bestJustification = {
              quote: result.justification,
              chunkId: result.justificationChunkId,
              sectionTitle: chunk?.sectionTitle ?? null,
            }
          }
        }
      } catch (err) {
        console.warn("[demo/diagnose] Solar Pro fail, fallback to weight:", err)
        // fall through to heuristic
      }
    }

    // Heuristic fallback — 매핑된 chunk 가 있고 confidence 높으면 점수↑.
    if (bestScore === 0 && candidateChunks[0]) {
      bestScore = candidateChunks[0].confidence
      bestId = p.id
      bestRationale = `${p.label} 결손이 의심됩니다.`
      bestJustification = {
        quote: candidateChunks[0].content,
        chunkId: candidateChunks[0].id,
        sectionTitle: candidateChunks[0].sectionTitle,
      }
    }
  }

  const winner = prereqs.find((p) => p.id === bestId)!

  return {
    target: { id: target.id, label: target.label, content: target.content },
    candidate: {
      id: winner.id,
      label: winner.label,
      content: winner.content,
      score: bestScore,
      rationale: bestRationale,
    },
    bfsPath: targetPatternId ? [targetPatternId, winner.id] : [winner.id],
    justification: bestJustification,
    studentSteps: STUB_WRONG_ATTEMPT.steps,
    studentAnswer: STUB_WRONG_ATTEMPT.studentAnswer,
    correctAnswer: target.itemAnswer ?? "?",
  }
}
