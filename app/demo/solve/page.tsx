/**
 * ③ Q6 캔버스 (0:50 ~ 2:00) — 펜으로 풀이.
 * ⑥ 재시도 (4:15 ~ 5:00) — mode=retry 로 동일 페이지 재사용.
 *
 * tldraw 캔버스는 client 컴포넌트. 손글씨 → LaTeX 인식은 실시간 (Claude Vision 또는 IE Vision).
 */

import { loadDemoItem } from "@/lib/demo/queries"
import { SolveCanvas } from "../_components/SolveCanvas"
import { getTargetItemId } from "@/lib/demo/data-loader"

type Props = {
  searchParams: Promise<{ itemId?: string; mode?: "retry" }>
}

export default async function SolveScreen({ searchParams }: Props) {
  const { itemId = getTargetItemId(), mode } = await searchParams
  const item = await loadDemoItem(itemId)
  const isRetry = mode === "retry"

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-black/40 mb-2">
          {isRetry ? "STEP 6 / 6 · 재시도" : "STEP 3 / 6 · 풀이"}
        </div>
        <h2 className="text-2xl font-bold">{item?.label}</h2>
        <p className="text-base text-black/70 mt-2">{item?.content}</p>
      </div>

      <SolveCanvas item={item} isRetry={isRetry} />
    </div>
  )
}
