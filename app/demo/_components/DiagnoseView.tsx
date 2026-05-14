"use client"

import { useRouter } from "next/navigation"
import { ArrowRight } from "lucide-react"
import { motion } from "framer-motion"
import type { DiagnosisResult } from "@/lib/demo/diagnose"

const PATTERN_KEYS_BY_ID: Record<string, string> = {
  "11111111-1111-4111-8111-111111111111": "LEAF-1",
  "22222222-2222-4222-8222-222222222222": "LEAF-2",
  "33333333-3333-4333-8333-333333333333": "LEAF-3",
  "44444444-4444-4444-8444-444444444444": "MID-1",
  "55555555-5555-4555-8555-555555555555": "MID-2",
  "66666666-6666-4666-8666-666666666666": "TARGET",
}

export function DiagnoseView({ diagnosis }: { diagnosis: DiagnosisResult }) {
  const router = useRouter()
  const patternKey = PATTERN_KEYS_BY_ID[diagnosis.candidate.id] ?? "LEAF-1"

  function handleRecap() {
    router.push(`/demo/recap?patternKey=${patternKey}`)
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
          <p className="text-sm text-white/80 mb-4 leading-relaxed">
            {diagnosis.candidate.rationale}
          </p>
        )}

        {diagnosis.justification && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.4 }}
            className="bg-white/5 border border-white/10 rounded-md p-4 mb-4"
          >
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-yellow-400 mb-2">
              📖 본문 인용 · {diagnosis.justification.sectionTitle ?? "NCIC 교육과정"}
            </div>
            <div className="text-sm leading-relaxed text-white/90">
              <span className="bg-yellow-300 text-black px-1.5 py-0.5 rounded font-semibold shadow-[0_1px_0_rgba(0,0,0,0.15)]">
                {diagnosis.justification.quote}
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
