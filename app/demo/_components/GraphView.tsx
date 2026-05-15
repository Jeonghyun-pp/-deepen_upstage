"use client"

import { useMemo } from "react"
import { GraphCanvas } from "reagraph"
import type { DemoGraph } from "@/lib/demo/queries"

/** 진단 후 노드 상태 색칠. uuid → 상태. */
export type GraphNodeStatus = "deficit" | "suspect" | "mastered" | "neutral"

const STATUS_FILL: Record<GraphNodeStatus, string> = {
  deficit: "#DA1E28", // 빨강 — 확정 결손
  suspect: "#F1C21B", // 노랑 — 의심
  mastered: "#15803D", // 초록 — 정복
  neutral: "#525252", // 회색 — 미평가
}

type Props = {
  graph: DemoGraph
  highlightId: string | null
  /** Item ID 로 강조할 TARGET item — Pattern 으로 매핑해서 그래프 강조. */
  targetItemId?: string
  /** 진단 후 노드 색칠 — uuid → 상태. 있으면 displayLayer 색상보다 우선. */
  nodeStatus?: Record<string, GraphNodeStatus>
}

export function GraphView({
  graph,
  highlightId,
  targetItemId,
  nodeStatus,
}: Props) {
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
      graph.nodes.map((n) => {
        // 진단 색칠이 있으면 최우선.
        const status = nodeStatus?.[n.id]
        const fill = status
          ? STATUS_FILL[status]
          : n.id === targetPatternId || n.id === targetItemId
            ? "#DA1E28"
            : n.type === "pattern"
              ? n.displayLayer === "concept"
                ? "#15803D"
                : "#0F62FE"
              : "#525252"
        return {
          id: n.id,
          label: n.label,
          fill,
          size:
            status === "deficit"
              ? 20
              : n.id === targetPatternId || n.id === targetItemId
                ? 18
                : status
                  ? 13
                  : 10,
        }
      }),
    [graph.nodes, targetPatternId, targetItemId, nodeStatus],
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
        layoutType="forceDirected3d"
        cameraMode="orbit"
        edgeArrowPosition="end"
        labelType="nodes"
        theme={{
          canvas: { background: "#FAFAF8" },
          node: {
            fill: "#525252",
            activeFill: "#15803D",
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
            fill: "#94a3b8",
            activeFill: "#15803D",
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
      <Legend diagnostic={!!nodeStatus} />
    </div>
  )
}

function Legend({ diagnostic }: { diagnostic: boolean }) {
  if (diagnostic) {
    return (
      <div className="absolute bottom-4 left-4 bg-white/90 border border-black/10 rounded-md p-3 text-xs space-y-1.5 z-10">
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#15803D]" /> 정복
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#F1C21B]" /> 의심
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#DA1E28]" /> 결손
        </div>
        <div className="flex items-center gap-2">
          <span className="w-3 h-3 rounded-full bg-[#525252]" /> 미평가
        </div>
      </div>
    )
  }
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
