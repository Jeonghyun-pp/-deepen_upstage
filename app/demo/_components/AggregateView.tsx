"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, X } from "lucide-react"
import { motion } from "framer-motion"
import {
  aggregateSession,
  buildPrereqLookup,
  buildDistractorLookup,
  type AggregateResult,
  type NodeColor,
} from "@/lib/demo/aggregate"
import { getSession, type DemoSession } from "@/lib/demo/session"
import { getAggregateNarration } from "@/lib/demo/actions"

type PatternMeta = {
  /** stableKey (= patternKey) */
  key: string
  label: string
  tldr: string | null
}

type EdgeMeta = { from: string; to: string }

type ItemMeta = {
  patternKey: string | null
  distractorMeanings?: Record<string, string[]>
}

type Props = {
  patterns: PatternMeta[]
  edges: EdgeMeta[]
  /** patternKey → 인용 후보 (NCIC chunk 본문). */
  chunkByPattern: Record<string, { quote: string; section: string }>
  /** distractor 라벨링 메타. */
  itemMeta: ItemMeta[]
}

export function AggregateView({
  patterns,
  edges,
  chunkByPattern,
  itemMeta,
}: Props) {
  const router = useRouter()
  const [session, setSession] = useState<DemoSession | null>(null)
  const [aggregate, setAggregate] = useState<AggregateResult | null>(null)
  const [narration, setNarration] = useState<string>("")
  const [narrating, setNarrating] = useState(false)

  const prereqOf = useMemo(() => buildPrereqLookup(edges), [edges])
  const distractorOf = useMemo(
    () => buildDistractorLookup(itemMeta),
    [itemMeta],
  )
  const scopeNodes = useMemo(() => patterns.map((p) => p.key), [patterns])
  const patternByKey = useMemo(
    () => new Map(patterns.map((p) => [p.key, p])),
    [patterns],
  )

  // 1) session 읽고 종합 계산
  useEffect(() => {
    const s = getSession()
    if (!s) {
      // 세션이 없으면 그래프로 돌려보냄
      router.replace("/demo/graph")
      return
    }
    setSession(s)
    setAggregate(
      aggregateSession(s, prereqOf, { distractorOf, scopeNodes }),
    )
  }, [router, prereqOf, distractorOf, scopeNodes])

  // 2) Solar narration (server action)
  useEffect(() => {
    if (!session || !aggregate) return
    const topNode = patternByKey.get(aggregate.topCandidatePatternKey)
    if (!topNode) return
    setNarrating(true)
    getAggregateNarration({
      session,
      aggregate,
      topNodeLabel: topNode.label,
    })
      .then((text) => setNarration(text))
      .catch(() => setNarration(""))
      .finally(() => setNarrating(false))
  }, [session, aggregate, patternByKey])

  if (!session || !aggregate) {
    return (
      <div className="px-8 py-12 text-black/50">세션 데이터를 불러오는 중…</div>
    )
  }

  const topNode = patternByKey.get(aggregate.topCandidatePatternKey)
  const topAppearance =
    aggregate.appearanceCount[aggregate.topCandidatePatternKey] ?? 0
  const correctCount = session.attempts.filter((a) => a.isCorrect).length
  const totalAttempts = session.attempts.length
  const citation = topNode ? chunkByPattern[topNode.key] : undefined

  function handleRecap() {
    if (!topNode) return
    router.push(`/demo/recap?patternKey=${encodeURIComponent(topNode.key)}`)
  }

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[420px_1fr] gap-6 px-8 py-6">
      {/* ── 좌측: 5회 history + 종합 카운트 + 미니 그래프 ── */}
      <div className="space-y-4">
        <div className="bg-white rounded-lg border border-black/5 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
            {totalAttempts}회 풀이 history
          </div>
          <div className="space-y-2">
            {session.attempts.map((a, i) => {
              const meta = patternByKey.get(a.candidatePatternKey)
              return (
                <motion.div
                  key={i}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  className="text-xs flex items-start gap-2 py-2 border-b border-black/[0.04] last:border-0"
                >
                  <div
                    className={`flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center ${
                      a.isCorrect
                        ? "bg-green-100 text-green-600"
                        : "bg-red-100 text-red-600"
                    }`}
                  >
                    {a.isCorrect ? <Check size={11} /> : <X size={11} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-bold truncate">{a.itemStableKey}</div>
                    <div className="text-black/40 text-[11px] truncate">
                      → {meta?.label ?? a.candidatePatternKey}
                    </div>
                    {a.diagnosis &&
                      a.diagnosis.error_type !== "no_error" && (
                        <div className="text-[10px] text-[#B25A00] mt-0.5 line-clamp-2">
                          {a.diagnosis.error_summary}
                        </div>
                      )}
                  </div>
                </motion.div>
              )
            })}
          </div>
        </div>

        <div className="bg-white rounded-lg border border-black/5 p-5">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
            종합 score
          </div>
          <div className="space-y-1.5 text-xs">
            {Object.entries(aggregate.scoreByNode)
              .sort((a, b) => b[1] - a[1])
              .slice(0, 6)
              .map(([key, score]) => {
                const meta = patternByKey.get(key)
                const color = aggregate.nodeColors[key] ?? "gray"
                return (
                  <div key={key} className="flex items-center gap-2">
                    <span
                      className={`w-2 h-2 rounded-full ${
                        color === "red"
                          ? "bg-red-500"
                          : color === "yellow"
                            ? "bg-yellow-400"
                            : "bg-black/20"
                      }`}
                    />
                    <span className="flex-1 truncate">{meta?.label ?? key}</span>
                    <span className="font-mono text-black/40">
                      {aggregate.appearanceCount[key] ?? 0}/{totalAttempts}{" "}
                      <span className="text-black/30">·</span> 무죄{" "}
                      {aggregate.innocenceCount[key] ?? 0}
                    </span>
                    <span className="font-bold w-6 text-right">{score}</span>
                  </div>
                )
              })}
          </div>
          <div className="mt-3 pt-3 border-t border-black/5 text-[10px] text-black/40">
            정답 {correctCount}/{totalAttempts} · 무죄 처리로 잡음 제거됨
          </div>
        </div>
      </div>

      {/* ── 우측: 종합 결손 + Solar narration + 인용 ── */}
      <div className="bg-[#1A1A2E] text-white rounded-lg p-6 flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50 mb-3">
          ★ 종합 결손 — Solar Pro
        </div>

        <div className="mb-4">
          <div className="text-xs text-white/40 mb-1">진짜 결손</div>
          <div className="text-3xl font-extrabold text-[#FFA500]">
            {topNode?.label ?? aggregate.topCandidatePatternKey}
          </div>
          <div className="text-xs text-white/40 mt-1">
            {totalAttempts}회 중 {topAppearance}회 등장 · confidence{" "}
            {(aggregate.topConfidence * 100).toFixed(0)}%
          </div>
        </div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="text-sm text-white/85 leading-relaxed mb-4 min-h-[3em]"
        >
          {narrating ? (
            <span className="text-white/50">Solar Pro 종합 narration 생성 중…</span>
          ) : (
            narration || "결손이 일관되게 나타나지 않습니다 — 더 많은 문제 풀이가 필요합니다."
          )}
        </motion.div>

        {citation && (
          <motion.div
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.0 }}
            className="bg-white/5 border border-white/10 rounded-md p-4 mb-4"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-yellow-400 mb-2">
              📖 본문 인용 · {citation.section}
            </div>
            <div className="text-sm leading-relaxed text-white/90">
              <span className="bg-yellow-300 text-black px-1.5 py-0.5 rounded font-semibold">
                {citation.quote}
              </span>
            </div>
          </motion.div>
        )}

        <button
          onClick={handleRecap}
          className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#FFA500] text-black text-sm font-bold rounded-md hover:bg-[#FFB733] transition"
        >
          2분 리캡 보기
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
