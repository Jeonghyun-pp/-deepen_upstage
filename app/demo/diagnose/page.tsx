/**
 * ④ 종합 진단 (3:30 ~ 4:30) — ★ 데모 임팩트 정점.
 *
 * 5회 풀이 history (sessionStorage) → 종합 결손 노드 + Solar Pro narration.
 * 좌측 5회 history 패널 + 우측 종합 결손 카드 + 인용.
 *
 * 단일 itemId 진단 모드는 더 이상 사용 안 함 (회차별은 SolveCanvas 내부에 미니 진단 inline).
 */

import { AggregateView } from "../_components/AggregateView"
import { loadDemoData } from "@/lib/demo/data-loader"

// 종합 narration Solar Pro(narrateAggregate) server action 호출 → timeout 60s.
export const maxDuration = 60

export default async function DiagnoseScreen() {
  const data = loadDemoData()

  const patterns = data.patterns.map((p) => ({
    key: p.stableKey,
    label: p.label,
    tldr: p.tldr ?? null,
  }))

  const edges = data.edges.prerequisite.map((e) => ({
    from: e.from,
    to: e.to,
  }))

  // patternKey → 가장 confidence 높은 chunk 인용 (NCIC 본문).
  const chunkByPattern: Record<string, { quote: string; section: string }> = {}
  for (const c of data.chunks) {
    for (const m of c.patternMappings) {
      const prev = chunkByPattern[m.patternKey]
      if (!prev || m.confidence > 0.9) {
        chunkByPattern[m.patternKey] = {
          quote: c.content,
          section: c.sectionTitle ?? "NCIC 교육과정",
        }
      }
    }
  }

  // distractor 라벨링 메타 — 학생 오답 → 결손 노드 추론용.
  const itemMeta = data.items.map((it) => ({
    patternKey: it.patternKey ?? null,
    distractorMeanings: it.distractorMeanings,
  }))

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-[#DA1E28] mb-2">
          STEP 4 / 6 · 5회 종합 진단
        </div>
        <h2 className="text-2xl font-bold">
          5문제를 통합해서, <span className="text-[#DA1E28]">진짜 결손</span>을 짚어냅니다
        </h2>
      </div>

      <AggregateView
        patterns={patterns}
        edges={edges}
        chunkByPattern={chunkByPattern}
        itemMeta={itemMeta}
      />
    </div>
  )
}
