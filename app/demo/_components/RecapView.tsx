"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { ArrowRight, Check } from "lucide-react"
import type { RecapCard } from "@/lib/demo/recap-cards"

type Props = {
  card: RecapCard
  returnItemId: string
}

export function RecapView({ card, returnItemId }: Props) {
  const router = useRouter()
  const [answered, setAnswered] = useState(false)

  function handleRetry() {
    router.push(`/demo/solve?itemId=${returnItemId}&mode=retry`)
  }

  return (
    <div className="flex-1 grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-6 px-8 py-6">
      {/* 좌: 미니 강의 */}
      <div className="bg-white rounded-lg border border-black/5 p-8">
        <div className="flex items-center gap-2 mb-3">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40">
            {card.subtitle}
          </div>
          {card.curriculumCode && (
            <span className="text-[10px] font-bold px-1.5 py-0.5 bg-[#15803D]/10 text-[#15803D] rounded">
              {card.curriculumCode}
            </span>
          )}
        </div>
        <h3 className="text-xl font-bold mb-6">{card.title}</h3>
        <div className="prose prose-sm max-w-none">
          {card.body.split("\n").map((line, i) => (
            <p key={i} className="my-2 leading-relaxed whitespace-pre-wrap">
              {line || " "}
            </p>
          ))}
        </div>
      </div>

      {/* 우: 영향 범위 + 빠른 확인 + 재시도 */}
      <div className="flex flex-col gap-4">
        {card.impact && (
          <div className="bg-[#FFF8E6] border border-[#FFA500]/30 rounded-lg p-5">
            <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-[#B25A00] mb-2">
              이 결손의 영향 범위
            </div>
            <div className="text-sm font-bold mb-1 text-black">
              {card.impact.label}
            </div>
            <p className="text-xs text-black/70 leading-relaxed">
              {card.impact.description}
            </p>
          </div>
        )}

        <div className="bg-white rounded-lg border border-black/5 p-6">
          <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-3">
            빠른 확인
          </div>
          <p className="text-sm font-medium mb-4">{card.quickCheck.question}</p>
          {!answered ? (
            <button
              onClick={() => setAnswered(true)}
              className="text-xs px-3 py-1.5 bg-black/5 rounded hover:bg-black/10 transition"
            >
              답 확인
            </button>
          ) : (
            <div>
              <div className="flex items-center gap-2 text-green-600 font-bold mb-2">
                <Check size={16} />
                {card.quickCheck.answer}
              </div>
              <p className="text-xs text-black/60 leading-relaxed">
                {card.quickCheck.explanation}
              </p>
            </div>
          )}
        </div>

        <button
          onClick={handleRetry}
          className="flex items-center justify-center gap-2 px-4 py-3 bg-[#15803D] text-white text-sm font-bold rounded-md hover:bg-[#0F6A30] transition"
        >
          Q6 다시 풀어보기
          <ArrowRight size={16} />
        </button>
      </div>
    </div>
  )
}
