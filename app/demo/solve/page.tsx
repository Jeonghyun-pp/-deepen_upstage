/**
 * ③ 회차별 풀이 (0:40 ~ 3:30) — 5문제 시퀀스 중 N번째.
 * ⑥ 재시도 (mode=retry 시 단발 흐름).
 *
 * searchParams:
 *   itemId   현재 회차의 문제 (server 가 미리 계산해서 link 에 박음)
 *   persona  "A" | "B" | "C" | "D" — 세션 페르소나
 *   round    1~5 — 현재 회차
 *   mode     "retry" 시 단발 모드 (회차 indicator 없음)
 */

import { loadDemoItem } from "@/lib/demo/queries"
import { SolveCanvas } from "../_components/SolveCanvas"
import { MathText } from "../_components/MathText"
import {
  getTargetItemId,
  getPersonaSequence,
  getItemPatternKey,
  loadDemoData,
} from "@/lib/demo/data-loader"

// 회차별 Solar Pro 진단(diagnoseSolution) server action 을 호출하므로
// Vercel 함수 timeout 을 60s 로 (기본 ~10s 면 Solar 응답 중 끊김).
export const maxDuration = 60

type Props = {
  searchParams: Promise<{
    itemId?: string
    persona?: string
    round?: string
    mode?: "retry"
  }>
}

export default async function SolveScreen({ searchParams }: Props) {
  const params = await searchParams
  const personaKey = params.persona ?? "A"
  const round = Math.max(1, parseInt(params.round ?? "1", 10))
  const mode = params.mode
  const isRetry = mode === "retry"

  // persona 시퀀스 — 회차별 다음 문제 url 미리 계산.
  const sequence = isRetry ? [] : getPersonaSequence(personaKey)
  const totalRounds = sequence.length || 5
  const currentIdx = Math.min(round - 1, sequence.length - 1)
  const currentItemId =
    params.itemId ?? sequence[currentIdx]?.uuid ?? getTargetItemId()
  const item = await loadDemoItem(currentItemId)
  const itemPatternKey = getItemPatternKey(currentItemId) ?? ""

  // few-shot 진단(diagnoseSolution) 입력 컨텍스트 — items.json 메타.
  const fullItem = loadDemoData().items.find((i) => i.uuid === currentItemId)
  const diagnosisContext = fullItem
    ? {
        problemId: fullItem.itemSource ?? fullItem.stableKey,
        officialSolution: fullItem.itemSolution,
        typicalWrongSolution: fullItem.typicalWrongSolution ?? "",
        targetConcepts: fullItem.targetConcepts ?? [],
        prerequisiteConcepts: fullItem.prerequisiteConcepts ?? [],
      }
    : null

  // 다음 회차 url — 마지막 회차면 /demo/diagnose (종합).
  let nextUrl: string
  if (isRetry) {
    nextUrl = "/demo"
  } else if (round >= totalRounds) {
    nextUrl = `/demo/diagnose?persona=${personaKey}`
  } else {
    const nextItem = sequence[round] // round 는 1-base, sequence 는 0-base → 다음 = idx round
    const nextItemId = nextItem?.uuid ?? currentItemId
    nextUrl = `/demo/solve?itemId=${nextItemId}&persona=${personaKey}&round=${round + 1}`
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6">
        <div className="flex items-center justify-between mb-2">
          <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-black/40">
            {isRetry
              ? "STEP 6 / 6 · 재시도"
              : `STEP 3 / 6 · 회차 ${round} / ${totalRounds}`}
          </div>
          {!isRetry && <RoundDots total={totalRounds} current={round} />}
        </div>
        <h2 className="text-2xl font-bold">{item?.label}</h2>
        <div className="text-base text-black/70 mt-2">
          {item?.content ? <MathText>{item.content}</MathText> : null}
        </div>
      </div>

      <SolveCanvas
        // 회차/itemId 변경 시 컴포넌트 강제 remount → useState 초기화.
        // Next.js 는 같은 page 의 query 변경만으로 client component 를 재사용하므로
        // selected/submitted state 가 회차 간 carry-over 되는 문제 방지.
        key={`${personaKey}-${round}-${currentItemId}`}
        item={item}
        itemPatternKey={itemPatternKey}
        isRetry={isRetry}
        round={round}
        totalRounds={totalRounds}
        personaKey={personaKey}
        nextUrl={nextUrl}
        diagnosisContext={diagnosisContext}
      />
    </div>
  )
}

function RoundDots({ total, current }: { total: number; current: number }) {
  return (
    <div className="flex items-center gap-1.5">
      {Array.from({ length: total }, (_, i) => {
        const n = i + 1
        const done = n < current
        const active = n === current
        return (
          <div
            key={n}
            className={`w-6 h-1.5 rounded-full ${
              done
                ? "bg-[#15803D]"
                : active
                  ? "bg-[#15803D]/60"
                  : "bg-black/10"
            }`}
          />
        )
      })}
    </div>
  )
}
