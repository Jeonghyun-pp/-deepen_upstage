/**
 * ⑤ 리캡 카드 (2:45 ~ 4:15) — 정적 콘텐츠.
 * lib/demo/recap-cards.ts 에서 patternKey 로 lookup.
 */

import { getRecapCard } from "@/lib/demo/recap-cards"
import { RecapView } from "../_components/RecapView"
import {
  getTargetItemId,
  getRetryItemForPattern,
} from "@/lib/demo/data-loader"

type Props = {
  searchParams: Promise<{ patternKey?: string }>
}

export default async function RecapScreen({ searchParams }: Props) {
  // 기본은 페르소나 A 결손 (이차방정식·판별식). diagnose 가 URL 로 patternKey 전달.
  const { patternKey = "H1-복소수-이차방정식" } = await searchParams
  const card = getRecapCard(patternKey)

  // 결손 노드에 맞는 재시도 문제 — patternKey 매칭 문제. 없으면 target fallback.
  const retryItem = getRetryItemForPattern(patternKey)
  const retryItemId = retryItem?.uuid ?? getTargetItemId()

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-black/40 mb-2">
          STEP 5 / 6 · 리캡
        </div>
        <h2 className="text-2xl font-bold">{card.title}</h2>
        <p className="text-sm text-black/60 mt-1">{card.subtitle}</p>
      </div>

      <RecapView card={card} returnItemId={retryItemId} />
    </div>
  )
}
