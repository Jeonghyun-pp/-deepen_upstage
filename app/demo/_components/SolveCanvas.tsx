"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, X } from "lucide-react"
import type { DemoNode } from "@/lib/demo/queries"

type Props = {
  item: DemoNode | null
  isRetry: boolean
}

/**
 * V1: 5지선다 클릭으로 답안 선택. 데모 임팩트를 위한 펜 입력 (tldraw + OCR) 은
 * 다음 iteration. 지금은 데모 흐름 (③ → ④ 진단) 완주가 우선.
 */
export function SolveCanvas({ item, isRetry }: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  if (!item) {
    return <div className="px-8 py-12 text-black/50">문항을 찾을 수 없습니다.</div>
  }

  const correctIdx = item.itemAnswer ? parseInt(item.itemAnswer, 10) - 1 : -1
  const isCorrect = selected === correctIdx
  const choices = item.itemChoices ?? []

  function handleSubmit() {
    if (selected === null) return
    setSubmitted(true)
  }

  function handleNext() {
    if (isRetry || isCorrect) {
      router.push(`/demo`) // 정답이면 데모 종료 (리셋 화면)
    } else {
      router.push(`/demo/diagnose?itemId=${item!.id}&attempt=wrong`)
    }
  }

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 px-8 py-6">
      {/* 좌: 풀이 영역 */}
      <div className="bg-white rounded-lg border border-black/5 p-6 min-h-[400px] relative">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
          {isRetry ? "재시도 · 결손 보강 후" : "풀이 영역"}
        </div>
        <div className="text-base leading-relaxed mb-6 whitespace-pre-wrap">
          {item.content}
        </div>
        <div className="space-y-2">
          {choices.map((c, i) => {
            const isSelected = selected === i
            const isCorrectChoice = i === correctIdx
            const showResult = submitted
            return (
              <button
                key={i}
                onClick={() => !submitted && setSelected(i)}
                disabled={submitted}
                className={`w-full text-left px-4 py-3 rounded-md border transition ${
                  showResult && isCorrectChoice
                    ? "bg-green-50 border-green-500"
                    : showResult && isSelected && !isCorrectChoice
                      ? "bg-red-50 border-red-500"
                      : isSelected
                        ? "bg-blue-50 border-blue-500"
                        : "bg-white border-black/10 hover:border-black/30"
                }`}
              >
                <span className="inline-block w-6 text-black/40 font-bold">
                  {["①", "②", "③", "④", "⑤"][i]}
                </span>
                {c}
              </button>
            )
          })}
        </div>

        {/* TODO: tldraw 캔버스로 업그레이드 — lib/pencil/canvas-host.tsx 통합 */}
        <div className="mt-6 text-[10px] text-black/30">
          ※ V1 데모: 5지선다. 펜 풀이는 다음 iteration.
        </div>
      </div>

      {/* 우: 채점 + 다음 단계 */}
      <div className="bg-white rounded-lg border border-black/5 p-6 flex flex-col">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
          채점
        </div>
        {!submitted ? (
          <>
            <p className="text-sm text-black/60 mb-4">답을 고르고 제출하세요.</p>
            <button
              onClick={handleSubmit}
              disabled={selected === null}
              className="px-4 py-2.5 bg-[#15803D] text-white text-sm font-bold rounded-md disabled:opacity-40"
            >
              제출
            </button>
          </>
        ) : (
          <>
            <div
              className={`flex items-center gap-2 text-lg font-bold mb-3 ${
                isCorrect ? "text-green-600" : "text-red-600"
              }`}
            >
              {isCorrect ? <Check size={20} /> : <X size={20} />}
              {isCorrect ? "정답!" : "오답"}
            </div>
            <p className="text-sm text-black/60 mb-4">
              {isCorrect
                ? "정답이에요. 풀이 단계를 모두 거쳤습니다."
                : "Q6 의 진짜 결손이 어디에 있는지 함께 짚어볼게요."}
            </p>
            <button
              onClick={handleNext}
              className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#15803D] text-white text-sm font-bold rounded-md"
            >
              {isCorrect ? "데모 종료" : "결손 진단 보기"}
              <ArrowRight size={16} />
            </button>
          </>
        )}
      </div>
    </div>
  )
}
