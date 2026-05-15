"use client"

import { useEffect, useRef, useState, type RefObject } from "react"
import { useRouter } from "next/navigation"
import {
  ArrowRight,
  ArrowDown,
  Check,
  X,
  Loader2,
  PenLine,
  ScanLine,
} from "lucide-react"
import { toPng } from "html-to-image"
import type { DemoNode } from "@/lib/demo/queries"
import { appendAttempt, type AttemptRecord } from "@/lib/demo/session"
import { runSolutionDiagnosis, recognizeHandwriting } from "@/lib/demo/actions"
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

/** 손풀이 노트 → OCR → 진단 파이프라인의 OCR 단계 상태. */
type OcrStatus = "idle" | "scanning" | "done" | "error"

/**
 * 5지선다 클릭 → 제출 시 학생 손풀이를 스캔 패널로 노출하고
 * 화면에 렌더된 그 손풀이를 그대로 캡처해 실제 OCR(Upstage Document Parse)로
 * 인식한다. OCR 결과는 화면에 노출(실제 인식 동작 시연)하되, few-shot
 * 진단(diagnoseSolution)의 입력은 깨끗한 모범 풀이(officialSolution)를 쓴다.
 *
 * 진단을 OCR 텍스트와 분리한 이유: 수식이 빽빽한 문항(Q11 등)은 OCR 단계에서
 * 수식이 깨져, 깨진 텍스트가 '계산 오류'로 오진되는 false positive 가 난다.
 * OCR 은 인식 시연용, 진단 근거는 원본 — 두 갈래로 둔다.
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
  const [ocrStatus, setOcrStatus] = useState<OcrStatus>("idle")
  const [ocrText, setOcrText] = useState<string | null>(null)
  const [ocrMs, setOcrMs] = useState<number | null>(null)
  /** 손풀이 노트의 캡처 대상 노드 — 이 DOM 을 PNG 로 떠서 OCR 에 보낸다. */
  const noteRef = useRef<HTMLDivElement>(null)
  const isLastRound = !isRetry && round >= totalRounds

  const correctIdx = item?.itemAnswer ? parseInt(item.itemAnswer, 10) - 1 : -1
  const isCorrect = selected === correctIdx
  const choices = item?.itemChoices ?? []

  // 정답을 골랐을 때만 손풀이 + OCR + AI 진단을 노출한다.
  // 오답이면 손풀이 없이 '오답'으로만 채점한다 (손글씨-선택답 불일치 차단).
  const studentSolution = diagnosisContext?.officialSolution ?? ""
  const showPipeline = submitted && !isRetry && !!diagnosisContext && isCorrect

  // 파이프라인이 렌더되면 손풀이 노트를 캡처 → 실제 OCR → 진단.
  useEffect(() => {
    if (!showPipeline || ocrStatus !== "idle") return
    if (!item || !diagnosisContext) return
    let cancelled = false

    async function runDiagnosis(solutionText: string) {
      if (cancelled || !item || !diagnosisContext) return
      setDiagnosing(true)
      const result = await runSolutionDiagnosis({
        problemId: diagnosisContext.problemId,
        problem: item.content,
        studentSolution: solutionText,
        officialSolution: diagnosisContext.officialSolution,
        targetConcepts: diagnosisContext.targetConcepts,
        prerequisiteConcepts: diagnosisContext.prerequisiteConcepts,
        relatedProblemCards: "",
      })
      if (cancelled) return
      setDiagnosis(result)
      setDiagnosing(false)
    }

    async function scanAndDiagnose() {
      // 진단은 OCR 손상과 무관하게 항상 깨끗한 모범 풀이로 — 수식 깨짐 오진 방지.
      void runDiagnosis(diagnosisContext!.officialSolution)

      // 아래는 OCR 시연 — 손풀이 노트를 실제로 인식하는 동작을 화면에 보여준다.
      setOcrStatus("scanning")
      // Nanum Pen Script + KaTeX 폰트 로드 후 캡처해야 글자가 깨지지 않음.
      try {
        await document.fonts.ready
      } catch {
        /* 폰트 API 미지원 — 그대로 진행 */
      }
      const node = noteRef.current
      if (!node) {
        if (!cancelled) setOcrStatus("error")
        return
      }

      let dataUrl: string
      try {
        dataUrl = await toPng(node, {
          pixelRatio: 2,
          backgroundColor: "#ffffff",
          cacheBust: true,
        })
      } catch (err) {
        console.warn("[demo] 손풀이 캡처 실패:", err)
        if (!cancelled) setOcrStatus("error")
        return
      }

      const ocr = await recognizeHandwriting(dataUrl)
      if (cancelled) return
      if (!ocr || !ocr.text.trim()) {
        setOcrStatus("error")
        return
      }
      setOcrText(ocr.text)
      setOcrMs(ocr.ms)
      setOcrStatus("done")
    }

    void scanAndDiagnose()
    return () => {
      cancelled = true
    }
    // showPipeline 이 켜질 때 1회만 실행 (ocrStatus 가드).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPipeline])

  if (!item) {
    return <div className="px-8 py-12 text-black/50">문항을 찾을 수 없습니다.</div>
  }

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

  function handleSubmit() {
    if (selected === null) return
    setSubmitted(true)
    // 정답이면 useEffect 가 파이프라인 렌더 후 캡처→OCR→진단을 돌린다.
    // 오답은 손풀이·진단 없이 채점만 한다.
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
    <div className="flex-1 flex flex-col gap-6 px-8 py-6">
      {/* 1행: 문제 + 보기 / 채점 */}
      <div className="grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6">
        <div className="bg-white rounded-lg border border-black/5 p-6 min-h-[360px]">
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

      {/* 2행: 손풀이 → OCR → LLM 진단 파이프라인 */}
      {showPipeline && (
        <div className="grid grid-cols-1 lg:grid-cols-[1fr_auto_1fr] gap-4 items-stretch">
          <HandwrittenPanel
            solution={studentSolution}
            noteRef={noteRef}
            ocrStatus={ocrStatus}
            ocrText={ocrText}
            ocrMs={ocrMs}
          />
          <PipelineArrow />
          <DiagnosisPanel diagnosing={diagnosing} diagnosis={diagnosis} />
        </div>
      )}
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
            className={`flex items-center gap-2 text-lg font-bold mb-2 ${
              isCorrect ? "text-green-600" : "text-red-600"
            }`}
          >
            {isCorrect ? <Check size={20} /> : <X size={20} />}
            {isCorrect ? "정답!" : "오답"}
          </div>
          <p className="text-sm text-black/55 leading-relaxed">
            {isRetry
              ? "결손 보강 후 재시도 결과입니다."
              : isCorrect
                ? "아래에서 학생 손풀이를 OCR로 인식해 AI가 진단합니다."
                : "오답입니다. 다음 문제로 넘어가세요."}
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

/** itemSolution 의 마크다운 헤더·강조 기호를 손풀이 표시용으로 정리. */
function cleanSolutionText(raw: string): string {
  const cleaned = raw
    .replace(/\*\*/g, "")
    .replace(/^\s*\d+\.\s*출제의도\s*:.*$/gm, "")
    .replace(/^정답풀이\s*:?\s*$/gm, "")
    .replace(/^-{2,}\s*$/gm, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
  return dropUnclosedMath(cleaned)
}

/**
 * 데이터가 수식 한복판에서 잘려(예: itemSolution 1000자 컷) 닫히지 않은
 * `$` 가 남으면 KaTeX 렌더가 깨지고, 그 깨진 노트가 그대로 OCR 캡처된다.
 * `$` 개수가 홀수면 마지막 안 닫힌 `$` 부터 뒤를 잘라 미완결 수식을 제거한다.
 */
function dropUnclosedMath(text: string): string {
  const dollarCount = (text.match(/\$/g) ?? []).length
  if (dollarCount % 2 === 0) return text
  const lastDollar = text.lastIndexOf("$")
  if (lastDollar < 0) return text
  return text.slice(0, lastDollar).replace(/\s+$/, "")
}

/**
 * 학생 손풀이 스캔 패널 — 손글씨 폰트로 렌더한 풀이를 그대로 노출하고,
 * 그 노드(noteRef)를 캡처해 실제 OCR 에 멕인다. 하단에 OCR 인식 결과를
 * 실시간으로 보여준다.
 */
function HandwrittenPanel({
  solution,
  noteRef,
  ocrStatus,
  ocrText,
  ocrMs,
}: {
  solution: string
  noteRef: RefObject<HTMLDivElement | null>
  ocrStatus: OcrStatus
  ocrText: string | null
  ocrMs: number | null
}) {
  const text = cleanSolutionText(solution) || "(손풀이 데이터 없음)"
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <PenLine size={13} className="text-[#B25A00]" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/45">
          학생 손풀이 · OCR 입력 이미지
        </span>
        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-[#FFA500]/15 text-[#B25A00]">
          이 노트를 캡처해 OCR
        </span>
      </div>

      {/* 스캔된 노트 — noteRef 영역이 그대로 PNG 로 캡처돼 OCR 에 전송된다. */}
      <div
        className="relative rounded-md border border-black/10 px-6 py-5 shadow-[0_6px_20px_-8px_rgba(0,0,0,0.35)]"
        style={{
          transform: "rotate(-0.5deg)",
          backgroundColor: "#FBF7EC",
          backgroundImage:
            "repeating-linear-gradient(transparent, transparent 31px, rgba(0,0,0,0.06) 31px, rgba(0,0,0,0.06) 32px)",
        }}
      >
        {/* 모서리 테이프 */}
        <div className="absolute -top-2 left-8 h-4 w-14 rotate-[-4deg] bg-[#FFE08A]/60 border border-[#E0B84A]/40" />
        <div
          ref={noteRef}
          className="text-[1.45rem] leading-[32px] text-[#1d2733]"
          style={{ fontFamily: "var(--font-handwriting), cursive" }}
        >
          <MathText>{text}</MathText>
        </div>
      </div>

      {/* OCR 인식 결과 — 위 노트를 캡처해 Upstage Document Parse 로 추출. */}
      <OcrResultCard status={ocrStatus} text={ocrText} ms={ocrMs} />
    </div>
  )
}

/** 손풀이 노트 캡처 → OCR 추출 결과 카드. */
function OcrResultCard({
  status,
  text,
  ms,
}: {
  status: OcrStatus
  text: string | null
  ms: number | null
}) {
  return (
    <div className="rounded-md border border-black/10 bg-white p-4">
      <div className="flex items-center gap-2 mb-2">
        <ScanLine size={13} className="text-[#15803D]" />
        <span className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/45">
          OCR 인식 결과 · Upstage Document Parse
        </span>
        {status === "done" && ms != null && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-green-100 text-green-700">
            인식 완료 · {(ms / 1000).toFixed(1)}s
          </span>
        )}
        {status === "error" && (
          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-red-100 text-red-700">
            OCR 실패
          </span>
        )}
      </div>

      {status === "scanning" ? (
        <div className="flex items-center gap-2 text-sm text-black/50 py-1">
          <Loader2 size={15} className="animate-spin" />
          손풀이 노트를 캡처해 OCR 인식 중…
        </div>
      ) : status === "error" ? null : status === "done" && text ? (
        <pre className="text-xs text-black/75 leading-relaxed whitespace-pre-wrap font-sans max-h-44 overflow-y-auto">
          {text}
        </pre>
      ) : (
        <p className="text-sm text-black/40 py-1">캡처 대기 중…</p>
      )}
    </div>
  )
}

/** 손풀이 → 진단 사이의 파이프라인 표시. */
function PipelineArrow() {
  return (
    <div className="flex lg:flex-col items-center justify-center gap-1 px-2">
      <div className="hidden lg:flex flex-col items-center gap-1.5">
        <div className="h-9 w-9 rounded-full bg-[#15803D] text-white flex items-center justify-center">
          <ArrowRight size={16} />
        </div>
      </div>
      <div className="lg:hidden h-9 w-9 rounded-full bg-[#15803D] text-white flex items-center justify-center">
        <ArrowDown size={16} />
      </div>
    </div>
  )
}

/** AI 진단 결과 패널 — few-shot 풀이 진단(error_summary + feedback). */
function DiagnosisPanel({
  diagnosing,
  diagnosis,
}: {
  diagnosing: boolean
  diagnosis: SolutionDiagnosisOutputT | null
}) {
  return (
    <div className="flex flex-col">
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/45 mb-2">
        AI 풀이 진단 — Solar Pro
      </div>
      <div className="flex-1 bg-white rounded-md border border-black/10 p-5">
        {diagnosing ? (
          <div className="flex items-center gap-2 text-sm text-black/50 py-3">
            <Loader2 size={16} className="animate-spin" />
            손풀이를 진단 중…
          </div>
        ) : !diagnosis ? (
          <p className="text-sm text-black/45 py-2">
            진단 결과를 불러오지 못했습니다. 정답/오답으로만 회차를 누적합니다.
          </p>
        ) : diagnosis.error_type === "no_error" &&
          !diagnosis.has_flawed_reasoning ? (
          <div className="space-y-2.5">
            <div className="font-bold text-green-700">풀이 논리 정상</div>
            <div className="text-sm text-black/75 leading-relaxed">
              <MathText>{diagnosis.student_feedback}</MathText>
            </div>
            {diagnosis.correct_reasoning && (
              <div className="border-t border-black/10 pt-2">
                <div className="text-[9px] uppercase tracking-[0.15em] font-bold text-green-700 mb-1">
                  왜 맞았는가
                </div>
                <div className="text-xs text-black/70 leading-relaxed">
                  <MathText>{diagnosis.correct_reasoning}</MathText>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="space-y-3">
            <div>
              <div className="text-[9px] uppercase tracking-[0.15em] font-bold text-[#B25A00]">
                이 회차 진단
              </div>
              <div className="text-sm font-bold mt-0.5">
                <MathText>{diagnosis.error_summary}</MathText>
              </div>
            </div>
            {diagnosis.first_wrong_step && (
              <div className="text-xs text-black/60">
                <span className="font-bold">처음 틀린 단계:</span>{" "}
                <MathText>{diagnosis.first_wrong_step}</MathText>
              </div>
            )}
            <div className="text-xs text-black/70 leading-relaxed border-t border-black/10 pt-2">
              <MathText>{diagnosis.student_feedback}</MathText>
            </div>
            {diagnosis.missing_concepts.length > 0 && (
              <div className="flex flex-wrap gap-1 pt-0.5">
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
        )}
      </div>
    </div>
  )
}
