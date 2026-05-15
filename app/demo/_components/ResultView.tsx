"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"
import { GraphView, type GraphNodeStatus } from "./GraphView"
import type { DemoGraph } from "@/lib/demo/queries"
import {
  aggregateSession,
  buildPrereqLookup,
  buildDistractorLookup,
  type AggregateResult,
} from "@/lib/demo/aggregate"
import { getSession, clearSession, type DemoSession } from "@/lib/demo/session"

type PatternMeta = { key: string; label: string; uuid: string }
type EdgeMeta = { from: string; to: string }
type ItemMeta = {
  patternKey: string | null
  distractorMeanings?: Record<string, string[]>
}

type Props = {
  graph: DemoGraph
  patterns: PatternMeta[]
  edges: EdgeMeta[]
  itemMeta: ItemMeta[]
}

export function ResultView({ graph, patterns, edges, itemMeta }: Props) {
  const router = useRouter()
  const [session, setSession] = useState<DemoSession | null>(null)
  const [aggregate, setAggregate] = useState<AggregateResult | null>(null)

  const prereqOf = useMemo(() => buildPrereqLookup(edges), [edges])
  const distractorOf = useMemo(
    () => buildDistractorLookup(itemMeta),
    [itemMeta],
  )
  const scopeNodes = useMemo(() => patterns.map((p) => p.key), [patterns])

  useEffect(() => {
    const s = getSession()
    if (!s) {
      router.replace("/demo/graph")
      return
    }
    setSession(s)
    setAggregate(aggregateSession(s, prereqOf, { distractorOf, scopeNodes }))
  }, [router, prereqOf, distractorOf, scopeNodes])

  // patternKey(stableKey) → uuid → 진단 상태.
  const nodeStatus = useMemo(() => {
    if (!aggregate) return {}
    const out: Record<string, GraphNodeStatus> = {}
    for (const p of patterns) {
      const color = aggregate.nodeColors[p.key]
      const innocence = aggregate.innocenceCount[p.key] ?? 0
      if (color === "red") out[p.uuid] = "deficit"
      else if (color === "yellow") out[p.uuid] = "suspect"
      else if (innocence > 0) out[p.uuid] = "mastered"
      else out[p.uuid] = "neutral"
    }
    return out
  }, [aggregate, patterns])

  const counts = useMemo(() => {
    const c = { deficit: 0, suspect: 0, mastered: 0, neutral: 0 }
    for (const s of Object.values(nodeStatus)) c[s]++
    return c
  }, [nodeStatus])

  function handleRestart() {
    clearSession()
    router.push("/demo")
  }

  if (!session || !aggregate) {
    return (
      <div className="px-8 py-12 text-black/50">세션 데이터를 불러오는 중…</div>
    )
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
        <StatCard color="#15803D" label="정복" value={counts.mastered} />
        <StatCard color="#F1C21B" label="의심" value={counts.suspect} />
        <StatCard color="#DA1E28" label="결손" value={counts.deficit} />
        <StatCard color="#525252" label="미평가" value={counts.neutral} />
      </div>

      <div className="flex-1 min-h-[420px]">
        <GraphView graph={graph} highlightId={null} nodeStatus={nodeStatus} />
      </div>

      <div className="px-8 pb-6 flex items-center justify-between">
        <p className="text-sm text-black/55">
          5문제 풀이로 그래프의{" "}
          <span className="font-bold text-[#DA1E28]">
            결손 {counts.deficit}개
          </span>
          ,{" "}
          <span className="font-bold text-[#15803D]">
            정복 {counts.mastered}개
          </span>{" "}
          영역이 드러났습니다.
        </p>
        <button
          onClick={handleRestart}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#15803D] text-white text-sm font-bold rounded-md hover:bg-[#0F6A30] transition"
        >
          <RotateCcw size={16} />
          처음부터
        </button>
      </div>
    </div>
  )
}

function StatCard({
  color,
  label,
  value,
}: {
  color: string
  label: string
  value: number
}) {
  return (
    <div className="bg-white rounded-lg border border-black/5 p-3 flex items-center gap-3">
      <span
        className="w-3 h-3 rounded-full flex-shrink-0"
        style={{ background: color }}
      />
      <div>
        <div className="text-lg font-extrabold leading-none">{value}</div>
        <div className="text-[10px] uppercase tracking-[0.15em] text-black/40 mt-0.5">
          {label}
        </div>
      </div>
    </div>
  )
}
