/**
 * 5회 attempt history → 종합 결손 노드 계산.
 *
 * 알고리즘 (그래프 전파 + distractor 부스트):
 *   for each attempt:
 *     nodes = itemPatternKey + prereq closure (depth=2)
 *     if 정답 (-2): 그 모든 노드 무죄 가중
 *     if 오답 (+1): 그 모든 노드 의심 가중
 *     if 오답 + distractor meta: 특정 결손 노드 +3 부스트
 *
 *   결손 후보 = argmax(score)
 *   페르소나가 결손을 hard-code 하지 않음 — 학생 풀이 패턴으로 자동 발견.
 *
 * 색칠 (그래프 14노드 한정):
 *   score ≥ 3  → red    (확정 결손)
 *   score ≥ 1  → yellow (의심)
 *   score ≤ 0  → gray   (무죄/무관)
 */

import type { DemoSession } from "./session"

export type NodeColor = "red" | "yellow" | "gray"

export type AggregateResult = {
  topCandidatePatternKey: string
  topConfidence: number
  nodeColors: Record<string, NodeColor>
  appearanceCount: Record<string, number>
  innocenceCount: Record<string, number>
  scoreByNode: Record<string, number>
}

/**
 * @param session                5회 history
 * @param prereqOf               patternKey → 직접 prereq patternKey[]
 * @param options.distractorOf   학생 오답 → 특정 결손 nodeKey[] (라벨링 메타)
 * @param options.scopeNodes     score 산출 대상 노드 (그래프 14노드). 미설정시 전체.
 */
export function aggregateSession(
  session: DemoSession,
  prereqOf: (patternKey: string) => string[],
  options?: {
    distractorOf?: (
      itemPatternKey: string,
      studentChoice: string,
    ) => string[]
    scopeNodes?: string[]
  },
): AggregateResult {
  const scope = options?.scopeNodes ? new Set(options.scopeNodes) : null
  const distractorOf = options?.distractorOf

  // depth=2 transitive closure — 너무 깊으면 모든 노드가 다 prereq라 noise.
  function closure(start: string): Set<string> {
    const out = new Set<string>([start])
    const queue = [start]
    let depth = 0
    while (queue.length > 0 && depth < 2) {
      const next: string[] = []
      for (const n of queue) {
        for (const p of prereqOf(n)) {
          if (!out.has(p)) {
            out.add(p)
            next.push(p)
          }
        }
      }
      queue.length = 0
      queue.push(...next)
      depth++
    }
    return out
  }

  const score: Record<string, number> = {}
  const appearance: Record<string, number> = {}
  const innocence: Record<string, number> = {}

  function addScore(node: string, delta: number) {
    if (scope && !scope.has(node)) return
    score[node] = (score[node] ?? 0) + delta
  }

  for (const a of session.attempts) {
    const nodes = closure(a.itemPatternKey)
    if (a.isCorrect) {
      for (const n of nodes) {
        if (scope && !scope.has(n)) continue
        innocence[n] = (innocence[n] ?? 0) + 1
        addScore(n, -2)
      }
    } else {
      for (const n of nodes) {
        if (scope && !scope.has(n)) continue
        appearance[n] = (appearance[n] ?? 0) + 1
        addScore(n, 1)
      }
      // distractor 메타: 특정 오답 보기 → 결손 노드 부스트
      if (distractorOf) {
        const specific = distractorOf(a.itemPatternKey, a.studentAnswer)
        for (const n of specific) {
          addScore(n, 3)
          appearance[n] = (appearance[n] ?? 0) + 1
        }
      }
    }
  }

  // argmax — 동점이면 appearance 큰 쪽.
  let topKey = ""
  let topScore = -Infinity
  for (const [k, v] of Object.entries(score)) {
    if (
      v > topScore ||
      (v === topScore && (appearance[k] ?? 0) > (appearance[topKey] ?? 0))
    ) {
      topScore = v
      topKey = k
    }
  }

  const nodeColors: Record<string, NodeColor> = {}
  const allNodes = new Set<string>([
    ...Object.keys(score),
    ...(options?.scopeNodes ?? []),
  ])
  for (const k of allNodes) {
    const v = score[k] ?? 0
    if (v >= 3) nodeColors[k] = "red"
    else if (v >= 1) nodeColors[k] = "yellow"
    else nodeColors[k] = "gray"
  }

  const totalAttempts = Math.max(1, session.attempts.length)
  const topConfidence = Math.min(
    1,
    (appearance[topKey] ?? 0) / totalAttempts,
  )

  return {
    topCandidatePatternKey: topKey,
    topConfidence,
    nodeColors,
    appearanceCount: appearance,
    innocenceCount: innocence,
    scoreByNode: score,
  }
}

/** 그래프 edges.json 으로부터 prereqOf lookup 빌더. */
export function buildPrereqLookup(
  edges: { from: string; to: string }[],
): (patternKey: string) => string[] {
  // from → to 가 prereq 관계 (from 이 to 의 선행). 즉 to 의 prereq 는 from.
  const byTo = new Map<string, string[]>()
  for (const e of edges) {
    const arr = byTo.get(e.to) ?? []
    arr.push(e.from)
    byTo.set(e.to, arr)
  }
  return (patternKey: string) => byTo.get(patternKey) ?? []
}

/**
 * items.json 의 distractorMeanings 메타 → 학생 오답 → 결손 노드 매핑.
 * items[].distractorMeanings: { "2": ["C1-도함수"], "3": ["H1-인수분해"] }
 * key 는 학생이 고른 보기 번호 ("1"~"5"), value 는 결손 노드 patternKey 배열.
 */
export function buildDistractorLookup(
  items: Array<{
    patternKey: string | null | undefined
    distractorMeanings?: Record<string, string[]>
  }>,
): (itemPatternKey: string, studentChoice: string) => string[] {
  // itemPatternKey 가 같은 문제가 여러 개일 수 있어 (페르소나 중복 가능)
  // 첫 매칭의 distractorMeanings 사용.
  const byPattern = new Map<string, Record<string, string[]>>()
  for (const it of items) {
    if (it.patternKey && it.distractorMeanings && !byPattern.has(it.patternKey)) {
      byPattern.set(it.patternKey, it.distractorMeanings)
    }
  }
  return (itemPatternKey: string, studentChoice: string) => {
    const m = byPattern.get(itemPatternKey)
    return m?.[studentChoice] ?? []
  }
}
