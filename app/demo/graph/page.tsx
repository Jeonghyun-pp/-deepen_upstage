/**
 * ② 그래프 + 페르소나 선택 (0:20 ~ 0:40).
 *
 * 14노드 prereq 그래프를 회색 초기 상태로 보여주고,
 * 4 페르소나 카드 중 하나를 골라 5문제 세션을 시작한다.
 */

import { GraphView } from "../_components/GraphView"
import { PersonaPicker } from "../_components/PersonaPicker"
import { loadDemoGraph } from "@/lib/demo/queries"
import { getAllPersonas, getPersonaSequence } from "@/lib/demo/data-loader"

// DB(loadDemoGraph) 를 읽으므로 빌드 시 prerender 금지 — 런타임 렌더.
// seed 갱신이 재배포 없이 반영되도록.
export const dynamic = "force-dynamic"

// 페르소나는 "어떤 5문제를 푸는 학생"일 뿐 — 결손은 진단이 발견하므로
// 선택 화면에서는 결손을 노출하지 않는다.
const PERSONA_META: Record<
  string,
  { title: string; subtitle: string }
> = {
  A: {
    title: "학생 A",
    subtitle: "2026 평가원 5문제 — 메인 시연",
  },
  B: {
    title: "학생 B",
    subtitle: "2026 평가원 5문제",
  },
  C: {
    title: "학생 C",
    subtitle: "2026 평가원 5문제",
  },
  D: {
    title: "학생 D",
    subtitle: "2026 평가원 5문제",
  },
}

export default async function GraphScreen() {
  const graph = await loadDemoGraph()
  const personaKeys = getAllPersonas()

  const personas = personaKeys.map((k) => {
    const seq = getPersonaSequence(k)
    return {
      key: k,
      title: PERSONA_META[k]?.title ?? `페르소나 ${k}`,
      subtitle: PERSONA_META[k]?.subtitle ?? "",
      count: seq.length,
      firstItemId: seq[0]?.uuid ?? "",
    }
  })

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-black/40 mb-2">
          STEP 2 / 6 · 그래프 + 페르소나 선택
        </div>
        <h2 className="text-2xl font-bold">
          NCIC 교육과정 + 평가원 19문제 → 14노드 prereq 그래프
        </h2>
        <p className="text-sm text-black/50 mt-1">
          학생 페르소나를 골라 5문제 세션을 시작하세요. 결손은 풀이 후 빨강으로 표시됩니다.
        </p>
      </div>

      <div className="flex-1 min-h-[400px]">
        <GraphView graph={graph} highlightId={null} />
      </div>

      <div className="px-8 pb-6 pt-2">
        <div className="text-[10px] uppercase tracking-[0.18em] font-bold text-black/40 mb-2">
          학생 페르소나
        </div>
        <PersonaPicker personas={personas} />
      </div>
    </div>
  )
}
