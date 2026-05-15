/**
 * ⑥ 정복·결손 그래프 엔딩 (5:00 ~).
 *
 * 5문제 세션 종합 결과를 전체 그래프 위에 색칠해서 보여준다.
 *   초록 = 정복 / 노랑 = 의심 / 빨강 = 결손 / 회색 = 미평가
 */

import { ResultView } from "../_components/ResultView"
import { loadDemoGraph } from "@/lib/demo/queries"
import { loadDemoData } from "@/lib/demo/data-loader"

// DB(loadDemoGraph) 를 읽으므로 런타임 렌더.
export const dynamic = "force-dynamic"

export default async function ResultScreen() {
  const graph = await loadDemoGraph()
  const data = loadDemoData()

  const patterns = data.patterns.map((p) => ({
    key: p.stableKey,
    label: p.label,
    uuid: p.uuid,
  }))
  const edges = data.edges.prerequisite.map((e) => ({
    from: e.from,
    to: e.to,
  }))
  const itemMeta = data.items.map((it) => ({
    patternKey: it.patternKey ?? null,
    distractorMeanings: it.distractorMeanings,
  }))

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6 pb-2">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-black/40 mb-2">
          STEP 6 / 6 · 정복 · 결손 지도
        </div>
        <h2 className="text-2xl font-bold">
          한 바퀴 끝. <span className="text-[#15803D]">정복</span>한 곳과{" "}
          <span className="text-[#DA1E28]">결손</span>이 한눈에
        </h2>
      </div>

      <ResultView
        graph={graph}
        patterns={patterns}
        edges={edges}
        itemMeta={itemMeta}
      />
    </div>
  )
}
