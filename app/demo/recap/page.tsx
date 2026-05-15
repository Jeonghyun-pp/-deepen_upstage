/**
 * ⑤ 리캡 카드 (2:45 ~ 4:15) — 정적 콘텐츠.
 * lib/demo/recap-cards.ts 에서 patternKey 로 lookup.
 */

import { getRecapCard } from "@/lib/demo/recap-cards"
import { RecapView } from "../_components/RecapView"
import { getTargetItemId } from "@/lib/demo/data-loader"

type Props = {
  searchParams: Promise<{ patternKey?: string }>
}

export default async function RecapScreen({ searchParams }: Props) {
  const { patternKey = "LEAF-1" } = await searchParams
  const card = getRecapCard(patternKey)

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-black/40 mb-2">
          STEP 5 / 6 · 리캡
        </div>
        <h2 className="text-2xl font-bold">{card.title}</h2>
        <p className="text-sm text-black/60 mt-1">{card.subtitle}</p>
      </div>

      <RecapView card={card} returnItemId={getTargetItemId()} />
    </div>
  )
}
