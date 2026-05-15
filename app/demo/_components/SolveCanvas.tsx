"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, X, Loader2 } from "lucide-react"
import type { DemoNode } from "@/lib/demo/queries"
import { appendAttempt, type AttemptRecord } from "@/lib/demo/session"
import { runSolutionDiagnosis } from "@/lib/demo/actions"
import type { SolutionDiagnosisOutputT } from "@/lib/upstage/prompts/solution-diagnosis"
import { MathText } from "./MathText"

type DiagnosisContext = {
  problemId: string
  officialSolution: string
  typicalWrongSolution: string
  targetConcepts: string[]
  prerequisiteConcepts: string[]
}

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
  /** few-shot 진단 입력 컨텍스트. */
  diagnosisContext?: DiagnosisContext | null
}

/**
 * 5지선다 클릭 → 제출 시 few-shot 풀이 진단(diagnoseSolution) 호출.
 * 회차별로 appendAttempt 로 sessionStorage 누적.
 */
export function SolveCanvas({
  item,
  itemPatternKey = "",
  isRetry,
  round = 1,
  totalRounds = 5,
  personaKey: _personaKey = "A",
  nextUrl,
  diagnosisContext,
}: Props) {
  const router = useRouter()
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)
  const [diagnosing, setDiagnosing] = useState(false)
  const [diagnosis, setDiagnosis] = useState<SolutionDiagnosisOutputT | null>(
    null,
  )
  const isLastRound = !isRetry && round >= totalRounds

  if (!item) {
    return <div className="px-8 py-12 text-black/50">문항을 찾을 수 없습니다.</div>
  }

  const correctIdx = item.itemAnswer ? parseInt(item.itemAnswer, 10) - 1 : -1
  const isCorrect = selected === correctIdx
  const choices = item.itemChoices ?? []

  function recordAttempt(diag: SolutionDiagnosisOutputT | null) {
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
      diagnosis: diag,
      timestamp: Date.now(),
    }
    appendAttempt(record)
  }

  async function handleSubmit() {
    if (selected === null) return
    setSubmitted(true)
    if (isRetry || !diagnosisContext || !item) return

    // 정답이면 정답 풀이, 오답이면 대표 오답 풀이를 진단 입력으로.
    const correct = selected === correctIdx
    const studentSolution = correct
      ? diagnosisContext.officialSolution
      : diagnosisContext.typicalWrongSolution
    if (!studentSolution.trim()) return

    setDiagnosing(true)
    const result = await runSolutionDiagnosis({
      problemId: diagnosisContext.problemId,
      problem: item.content,
      studentSolution,
      officialSolution: diagnosisContext.officialSolution,
      targetConcepts: diagnosisContext.targetConcepts,
      prerequisiteConcepts: diagnosisContext.prerequisiteConcepts,
      relatedProblemCards: "",
    })
    setDiagnosis(result)
    setDiagnosing(false)
  }

  function handleNext() {
    if (!item) {
      router.push("/demo")
      return
    }
    if (isRetry) {
      router.push("/demo/result")
      return
    }
    recordAttempt(diagnosis)
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

      {/* 우: 채점 + 회차 진단 */}
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
          diagnosing={diagnosing}
          diagnosis={diagnosis}
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
  diagnosing,
  diagnosis,
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
  diagnosing: boolean
  diagnosis: SolutionDiagnosisOutputT | null
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

          {/* 회차 진단 — Solar 풀이 분석 */}
          {!isRetry && (
            <MiniDiagnosis diagnosing={diagnosing} diagnosis={diagnosis} />
          )}

          <button
            onClick={onNext}
            className="mt-4 flex items-center justify-center gap-2 px-4 py-2.5 bg-[#15803D] text-white text-sm font-bold rounded-md"
          >
            {nextLabel}
            <ArrowRight size={16} />
          </button>
        </>
      )}
    </>
  )
}

/** 회차별 few-shot 진단 카드 — error_summary + first_wrong_step + feedback. */
function MiniDiagnosis({
  diagnosing,
  diagnosis,
}: {
  diagnosing: boolean
  diagnosis: SolutionDiagnosisOutputT | null
}) {
  if (diagnosing) {
    return (
      <div className="flex items-center gap-2 text-sm text-black/50 py-3">
        <Loader2 size={16} className="animate-spin" />
        Solar Pro 풀이 진단 중…
      </div>
    )
  }
  if (!diagnosis) {
    return (
      <p className="text-sm text-black/50 py-2">
        회차 진단을 누적해 다음 문제로 이어갑니다.
      </p>
    )
  }
  if (diagnosis.error_type === "no_error" && !diagnosis.has_flawed_reasoning) {
    return (
      <div className="bg-green-50 border border-green-200 rounded-md p-3 text-sm">
        <div className="font-bold text-green-700 mb-1">풀이 논리 정상</div>
        <div className="text-black/70">{diagnosis.student_feedback}</div>
      </div>
    )
  }
  return (
    <div className="bg-[#FFF8E6] border border-[#FFA500]/30 rounded-md p-3 space-y-2">
      <div>
        <div className="text-[9px] uppercase tracking-[0.15em] font-bold text-[#B25A00]">
          이 회차 진단
        </div>
        <div className="text-sm font-bold mt-0.5">
          {diagnosis.error_summary}
        </div>
      </div>
      {diagnosis.first_wrong_step && (
        <div className="text-xs text-black/60">
          <span className="font-bold">처음 틀린 단계:</span>{" "}
          {diagnosis.first_wrong_step}
        </div>
      )}
      <div className="text-xs text-black/70 leading-relaxed border-t border-[#FFA500]/20 pt-2">
        {diagnosis.student_feedback}
      </div>
      {diagnosis.missing_concepts.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-1">
          {diagnosis.missing_concepts.map((c) => (
            <span
              key={c.concept_id}
              className="text-[10px] font-bold px-1.5 py-0.5 bg-[#FFA500]/15 text-[#B25A00] rounded"
            >
              {c.concept_name}
            </span>
          ))}
        </div>
      )}
    </div>
  )
}
