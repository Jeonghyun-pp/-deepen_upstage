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
import { isAvailable, scorePrereqMatch, solarChat } from "@/lib/upstage/client"
import { loadDemoItem, loadChunksForPattern } from "./queries"
import { getFallbackPatternId, getPatternByUuid } from "./data-loader"
import type { DemoSession } from "./session"
import type { AggregateResult } from "./aggregate"

export interface DiagnosisResult {
  /** Target item (Q6). */
  target: { id: string; label: string; content: string }
  /** 가장 가능성 높은 prereq 후보. */
  candidate: {
    id: string
    /** Pattern stableKey (LEAF-1 등) — 리캡 카드 라우팅에 사용. */
    patternKey: string
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
  studentSteps,
  studentAnswer,
}: {
  itemId: string
  attemptKey: string
  /** ③ OCR pipeline 결과. 없으면 stub. */
  studentSteps?: string[]
  studentAnswer?: string
}): Promise<DiagnosisResult> {
  const target = await loadDemoItem(itemId)
  if (!target) throw new Error(`item not found: ${itemId}`)

  const steps = studentSteps ?? STUB_WRONG_ATTEMPT.steps
  const ans = studentAnswer ?? STUB_WRONG_ATTEMPT.studentAnswer

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

  if (prereqIds.length === 0) prereqIds = [getFallbackPatternId()] // fallback

  const prereqs = await db
    .select()
    .from(nodes)
    .where(inArray(nodes.id, prereqIds))

  // 3) 후보 prereq scoring — 병렬. 30초 룰 사수.
  //    각 후보: LLM 1회 → 실패 시 chunk confidence 기반 heuristic.
  const scored = await Promise.all(
    prereqs.map(async (p) => {
      const candidateChunks = await loadChunksForPattern(p.id)
      const fallback = () => {
        const fb = candidateChunks[0]
        return {
          patternId: p.id,
          score: fb?.confidence ?? 0,
          rationale: `${p.label} 결손이 의심됩니다.`,
          justification: fb
            ? { quote: fb.content, chunkId: fb.id, sectionTitle: fb.sectionTitle }
            : null,
        }
      }

      if (!isAvailable()) return fallback()
      try {
        const r = await scorePrereqMatch({
          steps,
          studentAnswer: ans,
          correctAnswer: target.itemAnswer ?? "?",
          targetSolution: target.itemSolution ?? undefined,
          targetPattern: { label: target.label, content: target.content },
          candidatePattern: { id: p.id, label: p.label, content: p.content },
          contextChunks: candidateChunks.map((c) => ({ id: c.id, content: c.content })),
        })
        const matchedChunk =
          r.justificationChunkId &&
          candidateChunks.find((c) => c.id === r.justificationChunkId)
        return {
          patternId: p.id,
          score: r.score,
          rationale: r.rationale,
          justification:
            r.justification && matchedChunk
              ? {
                  quote: r.justification,
                  chunkId: matchedChunk.id,
                  sectionTitle: matchedChunk.sectionTitle,
                }
              : null,
        }
      } catch (err) {
        console.warn(`[demo/diagnose] Solar Pro fail for ${p.label}:`, err)
        return fallback()
      }
    }),
  )

  // argmax. tie 시 fallback pattern (보통 LEAF-1) 우선 — 데모 안전판.
  const fallbackId = getFallbackPatternId()
  const winner = scored.reduce((best, cur) => {
    if (cur.score > best.score) return cur
    if (cur.score === best.score && cur.patternId === fallbackId) return cur
    return best
  })

  const winnerNode = prereqs.find((p) => p.id === winner.patternId)!
  const winnerPattern = getPatternByUuid(winnerNode.id)

  return {
    target: { id: target.id, label: target.label, content: target.content },
    candidate: {
      id: winnerNode.id,
      patternKey: winnerPattern?.stableKey ?? "UNKNOWN",
      label: winnerNode.label,
      content: winnerNode.content,
      score: winner.score,
      rationale: winner.rationale,
    },
    bfsPath: targetPatternId ? [targetPatternId, winnerNode.id] : [winnerNode.id],
    justification: winner.justification,
    studentSteps: steps,
    studentAnswer: ans,
    correctAnswer: target.itemAnswer ?? "?",
  }
}

/**
 * 5회 history + 종합 aggregate 결과 → Solar Pro narration 1단락.
 *
 * Solar 미연결 시 정적 fallback 문장으로 대체.
 * 시연 임팩트: "표면적으로 다른 단원인데 같은 결손으로 수렴" 한 점을 강조.
 */
export async function narrateAggregate({
  session,
  aggregate,
  topNodeLabel,
}: {
  session: DemoSession
  aggregate: AggregateResult
  topNodeLabel: string
}): Promise<string> {
  const totalAttempts = session.attempts.length
  const topAppearance = aggregate.appearanceCount[aggregate.topCandidatePatternKey] ?? 0
  const correctCount = session.attempts.filter((a) => a.isCorrect).length

  const staticFallback = [
    `총 ${totalAttempts}문제 중 ${topAppearance}회 동일 결손 후보로 등장.`,
    correctCount > 0
      ? `${correctCount}문제는 정답으로 무죄 처리되어 잡음을 제거했습니다.`
      : "",
    `표면 단원은 다르지만 ${topNodeLabel} 단계에서 일관되게 막힌 것으로 보입니다.`,
  ]
    .filter(Boolean)
    .join(" ")

  if (!isAvailable()) return staticFallback

  try {
    const summary = session.attempts
      .map(
        (a, i) =>
          `${i + 1}회 (${a.itemStableKey}, ${a.isCorrect ? "정답" : "오답"}, ` +
          `회차후보=${a.candidatePatternKey})`,
      )
      .join("\n")

    const text = await solarChat(
      [
        {
          role: "system",
          content:
            "당신은 한국 고등학교 수학 진단 도우미입니다. 학생의 5회 풀이 history 를 종합해 결손을 짧게 narrate 합니다. JSON 출력 금지, 자연스러운 한국어 2~3 문장만.",
        },
        {
          role: "user",
          content:
            `5회 풀이 history:\n${summary}\n\n` +
            `종합 결손 후보: ${topNodeLabel}\n` +
            `appearance: ${JSON.stringify(aggregate.appearanceCount)}\n` +
            `innocence:  ${JSON.stringify(aggregate.innocenceCount)}\n\n` +
            "위 데이터로 학생의 종합 결손을 2~3 문장으로 narrate. " +
            "표면 단원은 다른데도 같은 결손으로 수렴한 점을 한 번은 명시.",
        },
      ],
      { temperature: 0.3 },
    )
    const trimmed = text.trim()
    return trimmed.length > 20 ? trimmed : staticFallback
  } catch (err) {
    console.warn("[demo/diagnose] narrateAggregate Solar fail:", err)
    return staticFallback
  }
}
