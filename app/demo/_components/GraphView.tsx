"use client"

import { useMemo } from "react"
import { GraphCanvas } from "reagraph"
import type { DemoGraph } from "@/lib/demo/queries"

type Props = {
  graph: DemoGraph
  highlightId: string | null
  /** Item ID 로 강조할 TARGET item — Pattern 으로 매핑해서 그래프 강조. */
  targetItemId?: string
}

export function GraphView({ graph, highlightId, targetItemId }: Props) {
  const targetPatternId = useMemo(() => {
    if (!targetItemId) return highlightId
    // Item → Pattern (contains 역방향).
    const edge = graph.edges.find(
      (e) => e.type === "contains" && e.target === targetItemId,
    )
    return edge?.source ?? highlightId
  }, [graph, highlightId, targetItemId])

  const rgNodes = useMemo(
    () =>
      graph.nodes.map((n) => ({
        id: n.id,
        label: n.label,
        fill:
          n.id === targetPatternId
            ? "#DA1E28"
            : n.id === targetItemId
              ? "#DA1E28"
              : n.type === "pattern"
                ? n.displayLayer === "concept"
                  ? "#15803D"
                  : "#0F62FE"
                : "#525252",
        size: n.id === targetPatternId || n.id === targetItemId ? 18 : 10,
      })),
    [graph.nodes, targetPatternId, targetItemId],
  )

  const rgEdges = useMemo(
    () =>
      graph.edges.map((e) => ({
        id: `${e.source}-${e.target}`,
        source: e.source,
        target: e.target,
        label: e.type === "prerequisite" ? "prereq" : "",
        size: e.type === "prerequisite" ? 2 : 1,
      })),
    [graph.edges],
  )

  return (
    <div className="relative w-full h-full" style={{ minHeight: 500 }}>
      <GraphCanvas
        nodes={rgNodes}
        edges={rgEdges}
        layoutType="forceDirected2d"
        edgeArrowPosition="end"
        labelType="all"
        theme={{
          canvas: { background: "#FAFAF8" },
          node: {
            color: "#525252",
            opacity: 1,
            selectedOpacity: 1,
            inactiveOpacity: 0.4,
            label: {
              color: "#1A1A2E",
              stroke: "#FAFAF8",
              activeColor: "#1A1A2E",
            },
          },
          edge: {
            color: "#94a3b8",
            opacity: 0.7,
            selectedOpacity: 1,
            inactiveOpacity: 0.2,
            label: {
              color: "#525252",
              stroke: "#FAFAF8",
              activeColor: "#1A1A2E",
            },
          },
          ring: { fill: "#fafafa", activeFill: "#15803D" },
          arrow: { fill: "#94a3b8", activeFill: "#15803D" },
          lasso: { background: "#15803D11", border: "#15803D" },
        }}
      />
      <Legend />
    </div>
  )
}

function Legend() {
  return (
    <div className="absolute bottom-4 left-4 bg-white/90 border border-black/10 rounded-md p-3 text-xs space-y-1.5 z-10">
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-[#15803D]" /> Concept (개념)
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-[#0F62FE]" /> Pattern (유형)
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-[#525252]" /> Item (문제)
      </div>
      <div className="flex items-center gap-2">
        <span className="w-3 h-3 rounded-full bg-[#DA1E28]" /> ★ TARGET
      </div>
    </div>
  )
}
