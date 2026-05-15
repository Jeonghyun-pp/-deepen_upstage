"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, X } from "lucide-react"
import type { DemoNode } from "@/lib/demo/queries"
import { appendAttempt, type AttemptRecord } from "@/lib/demo/session"
import { MathText } from "./MathText"

type Props = {
  item: DemoNode | null
  /** items.json 의 patternKey (stableKey) — aggregate 알고리즘 키. */
  itemPatternKey?: string
  isRetry: boolean
  /** 1-base 회차. retry 모드면 무관. */
  round?: number
  totalRounds?: number
  personaKey?: string
  /** 다음 회차 url — server 가 미리 계산 (마지막 회차면 /demo/diagnose). */
  nextUrl?: string
}

/**
 * 5지선다 클릭만으로 풀이 진행 — OCR 제거.
 * 회차별로 appendAttempt 호출해 sessionStorage 에 누적.
 */
export function SolveCanvas({
  item,
  itemPatternKey = "",
  isRetry,
  round = 1,
  totalRounds = 5,
  personaKey: _personaKey = "A",
  nextUrl,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const isLastRound = !isRetry && round >= totalRounds

  if (!item) {
    return <div className="px-8 py-12 text-black/50">문항을 찾을 수 없습니다.</div>
  }

  const correctIdx = item.itemAnswer ? parseInt(item.itemAnswer, 10) - 1 : -1
  const isCorrect = selected === correctIdx
  const choices = item.itemChoices ?? []

  function recordAttempt() {
    if (isRetry || !item) return
    const record: AttemptRecord = {
      itemId: item.id,
      itemStableKey: item.label ?? `R${round}`,
      itemPatternKey,
      studentAnswer: selected !== null ? String(selected + 1) : "?",
      correctAnswer: item.itemAnswer ?? "?",
      isCorrect,
      studentSteps: [],
      candidatePatternKey: itemPatternKey,
      candidateLabel: item.label ?? "결손 후보",
      candidateScore: isCorrect ? 0.1 : 0.7,
      candidateRationale: isCorrect
        ? "이 문제는 정답 — 관련 prereq 무죄."
        : "이 문제 오답 — 결손 의심.",
      justificationQuote: null,
      timestamp: Date.now(),
    }
    appendAttempt(record)
  }

  function handleSubmit() {
    if (selected === null) return
    setSubmitted(true)
  }

  function handleNext() {
    if (!item) {
      router.push("/demo")
      return
    }
    if (isRetry) {
      // 재시도 후 → 정복·결손 그래프 엔딩.
      router.push("/demo/result")
      return
    }
    recordAttempt()
    router.push(nextUrl ?? "/demo/diagnose")
  }

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 px-8 py-6">
      {/* 좌: 문제 + 보기 */}
      <div className="bg-white rounded-lg border border-black/5 p-6 min-h-[400px]">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
          {isRetry ? "재시도 · 결손 보강 후" : "보기 선택"}
        </div>

        <div className="text-base leading-relaxed mb-6">
          <MathText>{item.content}</MathText>
        </div>

        <ChoiceList
          choices={choices}
          selected={selected}
          correctIdx={correctIdx}
          submitted={submitted}
          onSelect={(i) => !submitted && setSelected(i)}
        />
      </div>

      {/* 우: 채점·다음 단계 */}
      <div className="bg-white rounded-lg border border-black/5 p-6 flex flex-col">
        <ChoiceSidebar
          submitted={submitted}
          isCorrect={isCorrect}
          selected={selected}
          onSubmit={handleSubmit}
          onNext={handleNext}
          isRetry={isRetry}
          isLastRound={isLastRound}
          round={round}
          totalRounds={totalRounds}
        />
      </div>
    </div>
  )
}

function ChoiceList({
  choices,
  selected,
  correctIdx,
  submitted,
  onSelect,
}: {
  choices: string[]
  selected: number | null
  correctIdx: number
  submitted: boolean
  onSelect: (i: number) => void
}) {
  return (
    <div className="space-y-2">
      {choices.map((c, i) => {
        const isSelected = selected === i
        const isCorrectChoice = i === correctIdx
        const showResult = submitted
        return (
          <button
            key={i}
            onClick={() => onSelect(i)}
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
            <MathText preserveWhitespace={false}>{c}</MathText>
          </button>
        )
      })}
    </div>
  )
}

function ChoiceSidebar({
  submitted,
  isCorrect,
  selected,
  onSubmit,
  onNext,
  isRetry,
  isLastRound,
  round,
  totalRounds,
}: {
  submitted: boolean
  isCorrect: boolean
  selected: number | null
  onSubmit: () => void
  onNext: () => void
  isRetry: boolean
  isLastRound: boolean
  round: number
  totalRounds: number
}) {
  const nextLabel = isRetry
    ? "정복·결손 지도 보기"
    : isLastRound
      ? "종합 진단 보기"
      : `다음 문제 (${round + 1}/${totalRounds})`

  return (
    <>
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
        {isRetry ? "채점" : `채점 — 회차 ${round}/${totalRounds}`}
      </div>
      {!submitted ? (
        <>
          <p className="text-sm text-black/60 mb-4">답을 고르고 제출하세요.</p>
          <button
            onClick={onSubmit}
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
            {isRetry
              ? isCorrect
                ? "정답이에요. 결손이 채워졌습니다."
                : "결손이 아직 남아있어요. 다시 짚어봅니다."
              : isLastRound
                ? "마지막 회차입니다. 5문제 종합으로 결손을 찾아냅니다."
                : isCorrect
                  ? "정답 — 관련 prereq 는 무죄로 처리됩니다."
                  : "회차 진단을 누적해 다음 문제로 이어갑니다."}
          </p>
          <button
            onClick={onNext}
            className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#15803D] text-white text-sm font-bold rounded-md"
          >
            {nextLabel}
            <ArrowRight size={16} />
          </button>
        </>
      )}
    </>
  )
}
