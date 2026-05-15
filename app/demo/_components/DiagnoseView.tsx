"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import type { DiagnosisResult } from "@/lib/demo/diagnose"

// patternKey ↔ uuid 매핑은 diagnose.ts 에서 candidate.patternKey 로 같이 옴 — 정적 dict 불필요.

/**
 * 가짜 typewriter — 이미 받은 텍스트를 1글자씩 reveal.
 * Solar Pro 가 JSON 모드라 진짜 stream 은 못 흘리지만,
 * "AI 가 생각하면서 답한다" UX 효과는 동일.
 */
function TypeOut({
  text,
  speed = 22,
  startDelay = 0,
  onDone,
}: {
  text: string
  speed?: number
  startDelay?: number
  onDone?: () => void
}) {
  const [shown, setShown] = useState("")
  useEffect(() => {
    setShown("")
    let cancelled = false
    let intervalId: ReturnType<typeof setInterval> | null = null
    const startId = setTimeout(() => {
      if (cancelled) return
      let i = 0
      intervalId = setInterval(() => {
        i++
        setShown(text.slice(0, i))
        if (i >= text.length) {
          if (intervalId) clearInterval(intervalId)
          onDone?.()
        }
      }, speed)
    }, startDelay)
    return () => {
      cancelled = true
      clearTimeout(startId)
      if (intervalId) clearInterval(intervalId)
    }
  }, [text, speed, startDelay, onDone])

  const isComplete = shown.length === text.length
  return (
    <>
      {shown}
      {!isComplete && (
        <span className="ml-0.5 inline-block w-[2px] h-[0.95em] bg-current align-middle animate-pulse" />
      )}
    </>
  )
}

export function DiagnoseView({ diagnosis }: { diagnosis: DiagnosisResult }) {
  const router = useRouter()

  // typewriter chain — rationale 끝나면 justification 박스 등장.
  const [rationaleDone, setRationaleDone] = useState(false)

  function handleRecap() {
    router.push(`/demo/recap?patternKey=${diagnosis.candidate.patternKey}`)
  }

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-6 px-8 py-6">
      {/* 좌: 학생 풀이 + 정답 비교 */}
      <div className="bg-white rounded-lg border border-black/5 p-6">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
          학생 풀이 단계
        </div>
        <div className="space-y-2 mb-6">
          {diagnosis.studentSteps.map((step, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.15 }}
              className="px-3 py-2 bg-black/[0.02] rounded text-sm font-mono"
            >
              ({i + 1}) {step}
            </motion.div>
          ))}
        </div>
        <div className="flex items-center gap-4 text-sm">
          <div>
            <span className="text-black/40 text-xs">학생 답:</span>{" "}
            <span className="text-red-600 font-bold">{diagnosis.studentAnswer}</span>
          </div>
          <div>
            <span className="text-black/40 text-xs">정답:</span>{" "}
            <span className="text-green-600 font-bold">{diagnosis.correctAnswer}</span>
          </div>
        </div>
      </div>

      {/* 우: 진단 결과 */}
      <div className="bg-[#1A1A2E] text-white rounded-lg p-6 flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50 mb-3">
          ★ 결손 역추적 — Solar Pro
        </div>

        {/* BFS 역추적 경로 — TARGET → winner */}
        <div className="bg-white/5 border border-white/10 rounded-md p-3 mb-4">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-white/50 mb-2">
            역추적 경로
          </div>
          <div className="flex items-stretch gap-2">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex-1 px-3 py-2 border border-white/20 rounded text-xs flex flex-col justify-center min-w-0"
            >
              <div className="text-white/40 text-[9px] uppercase tracking-wider mb-0.5">
                풀던 문제
              </div>
              <div className="text-white truncate">{diagnosis.target.label}</div>
            </motion.div>
            <motion.div
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: 0.6, duration: 0.4 }}
              className="text-[#FFA500] text-2xl self-center"
            >
              →
            </motion.div>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{
                opacity: 1,
                boxShadow: [
                  "0 0 0 0 rgba(255,165,0,0)",
                  "0 0 16px 2px rgba(255,165,0,0.45)",
                  "0 0 8px 1px rgba(255,165,0,0.25)",
                ],
              }}
              transition={{ delay: 1.1, duration: 0.6 }}
              className="flex-1 px-3 py-2 border-2 border-[#FFA500] rounded text-xs flex flex-col justify-center min-w-0"
            >
              <div className="text-[#FFA500] text-[9px] uppercase tracking-wider mb-0.5 font-bold">
                결손
              </div>
              <div className="text-white font-bold truncate">
                {diagnosis.candidate.label}
              </div>
            </motion.div>
          </div>
        </div>

        <div className="mb-4">
          <div className="text-xs text-white/40 mb-1">진짜 결손</div>
          <div className="text-2xl font-extrabold text-[#FFA500]">
            {diagnosis.candidate.label}
          </div>
          <div className="text-xs text-white/40 mt-1">
            confidence {(diagnosis.candidate.score * 100).toFixed(0)}%
          </div>
        </div>

        {diagnosis.candidate.rationale && (
          <p className="text-sm text-white/80 mb-4 leading-relaxed min-h-[1.4em]">
            <TypeOut
              text={diagnosis.candidate.rationale}
              startDelay={1700}
              onDone={() => setRationaleDone(true)}
            />
          </p>
        )}

        {diagnosis.justification && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={rationaleDone ? { opacity: 1, y: 0 } : { opacity: 0, y: 8 }}
            transition={{ duration: 0.4 }}
            className="bg-white/5 border border-white/10 rounded-md p-4 mb-4"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-yellow-400 mb-2">
              📖 본문 인용 · {diagnosis.justification.sectionTitle ?? "NCIC 교육과정"}
            </div>
            <div className="text-sm leading-relaxed text-white/90">
              <span className="bg-yellow-300 text-black px-1.5 py-0.5 rounded font-semibold shadow-[0_1px_0_rgba(0,0,0,0.15)]">
                {rationaleDone ? (
                  <TypeOut text={diagnosis.justification.quote} startDelay={300} />
                ) : (
                  // 박스 자체가 안 보이는 동안 placeholder 로 자리 차지.
                  <span className="opacity-0">{diagnosis.justification.quote}</span>
                )}
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
