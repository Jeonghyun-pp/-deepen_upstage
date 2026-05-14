"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check, X, Camera, Loader2 } from "lucide-react"
import type { DemoNode } from "@/lib/demo/queries"
import type { OcrStepsOutputT } from "@/lib/upstage/prompts/ocr-steps"

type Props = {
  item: DemoNode | null
  isRetry: boolean
}

type Mode = "choice" | "upload"

type OcrResponse = {
  result: OcrStepsOutputT
  source: "live" | "sample" | "stub"
  stepsKey: string
}

/**
 * V1 hybrid:
 *   · choice — 5지선다 클릭 (안전 path)
 *   · upload — 학생 풀이 이미지 업로드 → Upstage Document Parse + Solar Pro 2
 *               (sample mode = body 없음 → public/demo/q6-student-handwriting.png)
 */
export function SolveCanvas({ item, isRetry }: Props) {
  const router = useRouter()
  const [mode, setMode] = useState<Mode>(isRetry ? "choice" : "upload")

  // choice mode state
  const [selected, setSelected] = useState<number | null>(null)
  const [submitted, setSubmitted] = useState(false)

  // upload mode state
  const [ocr, setOcr] = useState<OcrResponse | null>(null)
  const [ocrLoading, setOcrLoading] = useState(false)
  const [ocrError, setOcrError] = useState<string | null>(null)

  if (!item) {
    return <div className="px-8 py-12 text-black/50">문항을 찾을 수 없습니다.</div>
  }

  const correctIdx = item.itemAnswer ? parseInt(item.itemAnswer, 10) - 1 : -1
  const isCorrect = selected === correctIdx
  const choices = item.itemChoices ?? []

  async function handleUploadSample() {
    setOcrLoading(true)
    setOcrError(null)
    try {
      const resp = await fetch(`/api/demo/ocr?itemId=${item!.id}`, {
        method: "POST",
      })
      if (!resp.ok) throw new Error(`OCR ${resp.status}`)
      const data = (await resp.json()) as OcrResponse
      setOcr(data)
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : String(err))
    } finally {
      setOcrLoading(false)
    }
  }

  function handleUploadNext() {
    if (!ocr) return
    router.push(
      `/demo/diagnose?itemId=${item!.id}&attempt=wrong&stepsKey=${ocr.stepsKey}`,
    )
  }

  function handleChoiceSubmit() {
    if (selected === null) return
    setSubmitted(true)
  }

  function handleChoiceNext() {
    if (isRetry || isCorrect) {
      router.push(`/demo`)
    } else {
      router.push(`/demo/diagnose?itemId=${item!.id}&attempt=wrong`)
    }
  }

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_400px] gap-6 px-8 py-6">
      {/* 좌: 문제 + 풀이 영역 */}
      <div className="bg-white rounded-lg border border-black/5 p-6 min-h-[400px] relative">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40">
            {isRetry ? "재시도 · 결손 보강 후" : "풀이 영역"}
          </div>
          {!isRetry && (
            <div className="flex gap-1 text-[10px] font-bold">
              <button
                onClick={() => setMode("upload")}
                className={`px-2 py-1 rounded ${
                  mode === "upload"
                    ? "bg-black text-white"
                    : "bg-black/[0.04] text-black/50"
                }`}
              >
                사진 풀이
              </button>
              <button
                onClick={() => setMode("choice")}
                className={`px-2 py-1 rounded ${
                  mode === "choice"
                    ? "bg-black text-white"
                    : "bg-black/[0.04] text-black/50"
                }`}
              >
                보기 선택
              </button>
            </div>
          )}
        </div>

        <div className="text-base leading-relaxed mb-6 whitespace-pre-wrap">
          {item.content}
        </div>

        {mode === "choice" ? (
          <ChoiceList
            choices={choices}
            selected={selected}
            correctIdx={correctIdx}
            submitted={submitted}
            onSelect={(i) => !submitted && setSelected(i)}
          />
        ) : (
          <UploadPanel
            ocr={ocr}
            loading={ocrLoading}
            error={ocrError}
            onUpload={handleUploadSample}
          />
        )}
      </div>

      {/* 우: 채점·다음 단계 */}
      <div className="bg-white rounded-lg border border-black/5 p-6 flex flex-col">
        {mode === "choice" ? (
          <ChoiceSidebar
            submitted={submitted}
            isCorrect={isCorrect}
            selected={selected}
            onSubmit={handleChoiceSubmit}
            onNext={handleChoiceNext}
            isRetry={isRetry}
          />
        ) : (
          <UploadSidebar
            ocr={ocr}
            correctAnswer={item.itemAnswer ?? "?"}
            onNext={handleUploadNext}
          />
        )}
      </div>
    </div>
  )
}

/* ── choice mode ──────────────────────────────────── */

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
            {c}
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
}: {
  submitted: boolean
  isCorrect: boolean
  selected: number | null
  onSubmit: () => void
  onNext: () => void
  isRetry: boolean
}) {
  return (
    <>
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
        채점
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
            {isCorrect
              ? "정답이에요. 풀이 단계를 모두 거쳤습니다."
              : "Q6 의 진짜 결손이 어디에 있는지 함께 짚어볼게요."}
          </p>
          <button
            onClick={onNext}
            className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#15803D] text-white text-sm font-bold rounded-md"
          >
            {isCorrect || isRetry ? "데모 종료" : "결손 진단 보기"}
            <ArrowRight size={16} />
          </button>
        </>
      )}
    </>
  )
}

/* ── upload mode ──────────────────────────────────── */

function UploadPanel({
  ocr,
  loading,
  error,
  onUpload,
}: {
  ocr: OcrResponse | null
  loading: boolean
  error: string | null
  onUpload: () => void
}) {
  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        <Loader2 className="animate-spin text-black/40" size={32} />
        <div className="text-sm text-black/50">
          학생 손글씨 풀이를 인식하는 중…
        </div>
        <div className="text-[10px] uppercase tracking-[0.18em] text-black/30">
          Upstage Document Parse + Solar Pro 2
        </div>
      </div>
    )
  }

  if (!ocr) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-4 border-2 border-dashed border-black/15 rounded-lg">
        <Camera size={32} className="text-black/30" />
        <div className="text-sm text-black/50 text-center">
          종이에 푼 풀이를 사진으로 올려주세요.
        </div>
        <button
          onClick={onUpload}
          className="px-4 py-2 bg-black text-white text-sm font-bold rounded-md hover:bg-black/80"
        >
          데모 풀이 불러오기
        </button>
        {error && <div className="text-xs text-red-500">에러: {error}</div>}
      </div>
    )
  }

  return (
    <div>
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
        인식된 풀이 단계
        <span className="ml-2 text-[9px] text-black/30">
          source: {ocr.source}
        </span>
      </div>
      <div className="space-y-2">
        {ocr.result.steps.map((step, i) => (
          <div
            key={i}
            className="px-4 py-3 bg-black/[0.02] border border-black/5 rounded-md"
            style={{
              animation: `fadeIn 0.4s ease-out ${i * 0.12}s both`,
            }}
          >
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-1">
              ({i + 1}) {step.label}
            </div>
            <div className="text-sm font-mono">{step.latex}</div>
          </div>
        ))}
      </div>
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(4px); }
          to   { opacity: 1; transform: translateY(0); }
        }
      `}</style>
    </div>
  )
}

function UploadSidebar({
  ocr,
  correctAnswer,
  onNext,
}: {
  ocr: OcrResponse | null
  correctAnswer: string
  onNext: () => void
}) {
  if (!ocr) {
    return (
      <>
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
          채점
        </div>
        <p className="text-sm text-black/60">
          사진을 업로드하면 풀이 단계를 자동으로 추출합니다.
        </p>
      </>
    )
  }

  return (
    <>
      <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
        채점
      </div>
      <div className="flex items-center gap-2 text-lg font-bold mb-3 text-red-600">
        <X size={20} />
        오답
      </div>
      <div className="space-y-2 mb-4 text-sm">
        <div>
          <span className="text-black/40 text-xs">학생 답:</span>{" "}
          <span className="text-red-600 font-bold">
            {ocr.result.studentAnswer}
          </span>
        </div>
        <div>
          <span className="text-black/40 text-xs">정답:</span>{" "}
          <span className="text-green-600 font-bold">{correctAnswer}</span>
        </div>
      </div>
      <p className="text-sm text-black/60 mb-4">
        풀이 어디가 막혔는지 짚어볼게요.
      </p>
      <button
        onClick={onNext}
        className="mt-auto flex items-center justify-center gap-2 px-4 py-2.5 bg-[#15803D] text-white text-sm font-bold rounded-md"
      >
        결손 진단 보기
        <ArrowRight size={16} />
      </button>
    </>
  )
}
