"use client"

import { useEffect, useState } from "react"
import { X, AlertTriangle } from "lucide-react"
import { MathText } from "./MathText"

type Props = {
  wrongSolution: string
}

/**
 * 시연 보조 — 현재 문제의 대표 오답 풀이를 모달로 노출.
 * wrongSolution 이 비어있으면 렌더하지 않는다.
 */
export function WrongSolveButton({ wrongSolution }: Props) {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false)
    }
    window.addEventListener("keydown", onKey)
    return () => window.removeEventListener("keydown", onKey)
  }, [open])

  if (!wrongSolution.trim()) return null

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-[0.05em] bg-orange-50 text-orange-700 border border-orange-200 hover:bg-orange-100 transition"
      >
        <AlertTriangle size={12} />
        틀린풀이예시
      </button>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-modal="true"
        >
          <div
            className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[80vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between px-6 py-4 border-b border-black/10">
              <div className="flex items-center gap-2">
                <AlertTriangle size={16} className="text-orange-600" />
                <h3 className="text-base font-bold">틀린 풀이 예시</h3>
                <span className="text-xs text-black/40">학생이 자주 빠지는 오답</span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1 rounded hover:bg-black/5"
                aria-label="닫기"
              >
                <X size={18} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto px-6 py-5">
              <div className="text-sm leading-relaxed">
                <MathText>{wrongSolution}</MathText>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
