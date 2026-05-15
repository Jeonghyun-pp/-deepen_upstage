/**
 * ② 그래프 화면 (0:20 ~ 0:50).
 * 캐시된 Pattern·Item 그래프 + TARGET 강조 + 자동 진행 (③ 풀이로).
 *
 * 실제 force-directed 시각화는 _components/GraphView 에서.
 */

import { GraphView } from "../_components/GraphView"
import { loadDemoGraph } from "@/lib/demo/queries"
import { getTargetItemId } from "@/lib/demo/data-loader"
import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default async function GraphScreen() {
  const graph = await loadDemoGraph()
  const targetItemId = getTargetItemId()

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-black/40 mb-2">
          STEP 2 / 6 · 그래프 생성
        </div>
        <h2 className="text-2xl font-bold">
          NCIC 교육과정 + 평가원 8문제 → Concept-Pattern-Item 그래프
        </h2>
        <p className="text-sm text-black/50 mt-1">
          ★ TARGET Q6 (곡선 밖 접선)을 풀어볼 차례
        </p>
      </div>

      <div className="flex-1 min-h-[500px]">
        <GraphView graph={graph} highlightId={null} targetItemId={targetItemId} />
      </div>

      <div className="px-8 pb-6 flex justify-end">
        <Link
          href={`/demo/solve?itemId=${targetItemId}`}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#15803D] text-white text-sm font-bold rounded-md hover:bg-[#0F6A30] transition"
        >
          Q6 풀어보기
          <ArrowRight size={16} />
        </Link>
      </div>
    </div>
  )
}
