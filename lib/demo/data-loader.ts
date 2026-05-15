/**
 * 데모 자산 loader — data/demo/*.json 의 단일 진입점.
 *
 * 정책:
 *   - JSON 5종 (patterns, items, chunks, edges, recap-cards) 을 zod 로 검증.
 *   - stableKey ↔ uuid 양방향 lookup helper 제공.
 *   - "데이터 부으면 끝" 원칙 — 새 문제/패턴/카드 추가 시 JSON 만 늘리면 됨.
 *
 * 호출처:
 *   scripts/seed-demo.ts          — DB seed
 *   lib/demo/recap-cards.ts       — patternKey → card lookup
 *   lib/demo/diagnose.ts          — fallback patternKey
 *   app/demo/_components/*        — TARGET item id, patternKey 등
 */

import { readFileSync } from "node:fs"
import path from "node:path"
import { z } from "zod"

const DATA_DIR = path.join(process.cwd(), "data", "demo")

// ── Schemas ─────────────────────────────────────────────────────────

const Pattern = z.object({
  stableKey: z.string(),
  uuid: z.string().uuid(),
  displayLayer: z.enum(["concept", "pattern"]),
  label: z.string(),
  content: z.string(),
  tldr: z.string().optional().nullable(),
  grade: z.string().optional().nullable(),
  signature: z.array(z.string()).optional(),
  isKiller: z.boolean().optional(),
  isFallback: z.boolean().optional(),
  whiteboardPos: z.object({ x: z.number(), y: z.number() }).optional().nullable(),
})

const PersonaMapping = z.object({
  /** 페르소나 key: "A" | "B" | "C" | "D" */
  persona: z.string(),
  /** 시퀀스 내 순서 (1~5) */
  order: z.number().int().positive(),
})

const Item = z.object({
  stableKey: z.string(),
  uuid: z.string().uuid(),
  label: z.string(),
  content: z.string(),
  grade: z.string().optional().nullable(),
  itemSource: z.string().optional().nullable(),
  itemChoices: z.array(z.string()),
  itemAnswer: z.string(),
  itemSolution: z.string(),
  itemDifficulty: z.number().min(0).max(1).optional(),
  /** Pattern stableKey — null/undefined = distractor (어떤 패턴에도 contains 안 함). */
  patternKey: z.string().optional().nullable(),
  /** seed 의 meta.label — UI 가 분류 표시할 때 사용 (옵션). */
  metaLabel: z.string().optional(),
  /** 데모 진입 시 default 로 노출되는 anchor item (페르소나별 시퀀스 시작점). */
  isTarget: z.boolean().optional(),
  isDistractor: z.boolean().optional(),
  /** 페르소나별 시퀀스 메타 — 1문제가 여러 페르소나에 속할 수 있음. */
  personaMappings: z.array(PersonaMapping).optional().default([]),
  /** 평가원 배점 (2/3/4점). */
  examPoints: z.number().int().optional(),
  /** 단답형 → 5지선다 자동 변환 여부. */
  wasSynthesizedChoices: z.boolean().optional(),
  /**
   * distractor 라벨링 — 학생이 고른 오답 보기 → 추정 결손 노드.
   * { "2": ["C1-도함수"], "3": ["H1-인수분해"] } (보기번호 1~5 → patternKey[])
   * 정상 객관식만 부여, 자동변환 단답형은 없음.
   */
  distractorMeanings: z.record(z.string(), z.array(z.string())).optional(),
})

const Chunk = z.object({
  stableKey: z.string(),
  uuid: z.string().uuid(),
  ordinal: z.number().int().positive(),
  sectionTitle: z.string().optional().nullable(),
  content: z.string(),
  /** chunk → patterns 매핑 (chunkNodeMap row 자동 생성). */
  patternMappings: z
    .array(
      z.object({
        patternKey: z.string(),
        confidence: z.number().min(0).max(1),
      }),
    )
    .default([]),
})

const Edges = z.object({
  prerequisite: z.array(
    z.object({
      from: z.string(),
      to: z.string(),
      weight: z.number().min(0).max(1).default(0.8),
    }),
  ),
})

const RecapCard = z.object({
  patternKey: z.string(),
  title: z.string(),
  subtitle: z.string(),
  body: z.string(),
  curriculumCode: z.string().optional(),
  quickCheck: z.object({
    question: z.string(),
    answer: z.string(),
    explanation: z.string(),
  }),
  impact: z
    .object({
      label: z.string(),
      description: z.string(),
    })
    .optional(),
})

export type PatternData = z.infer<typeof Pattern>
export type ItemData = z.infer<typeof Item>
export type ChunkData = z.infer<typeof Chunk>
export type EdgesData = z.infer<typeof Edges>
export type RecapCardData = z.infer<typeof RecapCard>

// ── 데모 문서 (NCIC 발췌) — 1개 고정. ───────────────────────────────

export const DEMO_DOCUMENT = {
  uuid: "d0000000-0000-4000-8000-000000000001",
  title: "2022 개정 수학과 교육과정 (NCIC 발췌)",
  storagePath: "demo/ncic-curriculum.pdf",
  pageCount: 6,
} as const

// ── Loader (한번만 읽고 캐시) ────────────────────────────────────────

let _cache: {
  patterns: PatternData[]
  items: ItemData[]
  chunks: ChunkData[]
  edges: EdgesData
  recapCards: RecapCardData[]
  patternByKey: Map<string, PatternData>
  itemByKey: Map<string, ItemData>
  chunkByKey: Map<string, ChunkData>
  recapByKey: Map<string, RecapCardData>
} | null = null

function readJson(name: string): unknown {
  const raw = readFileSync(path.join(DATA_DIR, name), "utf-8")
  return JSON.parse(raw)
}

export function loadDemoData() {
  if (_cache) return _cache

  const patterns = z.array(Pattern).parse(readJson("patterns.json"))
  const items = z.array(Item).parse(readJson("items.json"))
  const chunks = z.array(Chunk).parse(readJson("chunks.json"))
  const edges = Edges.parse(readJson("edges.json"))
  const recapCards = z.array(RecapCard).parse(readJson("recap-cards.json"))

  // ── 무결성 검증 ──
  const patternKeys = new Set(patterns.map((p) => p.stableKey))

  // items.patternKey 가 patterns 에 존재하는지
  for (const it of items) {
    if (it.patternKey && !patternKeys.has(it.patternKey)) {
      throw new Error(
        `item ${it.stableKey} references unknown patternKey '${it.patternKey}'`,
      )
    }
    if (!it.patternKey && !it.isDistractor) {
      throw new Error(
        `item ${it.stableKey} has no patternKey but is not marked isDistractor`,
      )
    }
  }

  // chunks.patternMappings 의 patternKey 검증
  for (const c of chunks) {
    for (const m of c.patternMappings) {
      if (!patternKeys.has(m.patternKey)) {
        throw new Error(
          `chunk ${c.stableKey} maps to unknown patternKey '${m.patternKey}'`,
        )
      }
    }
  }

  // edges.prerequisite 의 from/to 검증
  for (const e of edges.prerequisite) {
    if (!patternKeys.has(e.from)) {
      throw new Error(`edge from='${e.from}' is unknown pattern`)
    }
    if (!patternKeys.has(e.to)) {
      throw new Error(`edge to='${e.to}' is unknown pattern`)
    }
  }

  // recap-cards 의 patternKey 검증
  for (const r of recapCards) {
    if (!patternKeys.has(r.patternKey)) {
      throw new Error(
        `recap-card patternKey '${r.patternKey}' is unknown pattern`,
      )
    }
  }

  // anchor item (페르소나별 시퀀스 진입점) 최소 1개 — 4 페르소나면 4개까지 허용.
  const targets = items.filter((i) => i.isTarget)
  if (targets.length < 1) {
    throw new Error(
      `items.json must contain at least 1 isTarget=true item, found ${targets.length}`,
    )
  }

  _cache = {
    patterns,
    items,
    chunks,
    edges,
    recapCards,
    patternByKey: new Map(patterns.map((p) => [p.stableKey, p])),
    itemByKey: new Map(items.map((i) => [i.stableKey, i])),
    chunkByKey: new Map(chunks.map((c) => [c.stableKey, c])),
    recapByKey: new Map(recapCards.map((r) => [r.patternKey, r])),
  }
  return _cache
}

// ── 자주 쓰는 helper ────────────────────────────────────────────────

export function getTargetItem(): ItemData {
  const { items } = loadDemoData()
  // 첫 anchor item — 기본 데모 진입점 (페르소나 A 시퀀스 시작).
  return items.find((i) => i.isTarget)!
}

export function getTargetItemId(): string {
  return getTargetItem().uuid
}

/** 페르소나별 시퀀스 5문제 — order 순. */
export function getPersonaSequence(personaKey: string): ItemData[] {
  const { items } = loadDemoData()
  const matched = items.flatMap((it) => {
    const m = it.personaMappings?.find((pm) => pm.persona === personaKey)
    return m ? [{ item: it, order: m.order }] : []
  })
  matched.sort((a, b) => a.order - b.order)
  return matched.map((x) => x.item)
}

/** 전체 페르소나 key 목록 — items.json 에서 자동 수집. */
export function getAllPersonas(): string[] {
  const { items } = loadDemoData()
  const keys = new Set<string>()
  for (const it of items) {
    for (const pm of it.personaMappings ?? []) keys.add(pm.persona)
  }
  return [...keys].sort()
}

/** uuid → items.json 의 patternKey (stableKey) lookup. */
export function getItemPatternKey(itemUuid: string): string | null {
  const { items } = loadDemoData()
  const matched = items.find((i) => i.uuid === itemUuid)
  return matched?.patternKey ?? null
}

/**
 * 결손 노드(patternKey)에 맞는 재시도 문제 1개.
 * 같은 patternKey 문제 중 excludeItemIds(이미 푼 것)에 없는 것 우선.
 * 매칭이 없으면 null.
 */
export function getRetryItemForPattern(
  patternKey: string,
  excludeItemIds: string[] = [],
): ItemData | null {
  const { items } = loadDemoData()
  const matched = items.filter((i) => i.patternKey === patternKey)
  if (matched.length === 0) return null
  const exclude = new Set(excludeItemIds)
  const unsolved = matched.filter((i) => !exclude.has(i.uuid))
  return unsolved[0] ?? matched[0]!
}

export function getFallbackPatternId(): string {
  const { patterns } = loadDemoData()
  return (patterns.find((p) => p.isFallback) ?? patterns[0]!).uuid
}

export function getPatternByUuid(uuid: string): PatternData | undefined {
  const { patterns } = loadDemoData()
  return patterns.find((p) => p.uuid === uuid)
}

export function getRecapCardData(patternKey: string): RecapCardData {
  const { recapByKey, recapCards } = loadDemoData()
  return (
    recapByKey.get(patternKey) ??
    // patternKey 가 카드 없는 패턴이면 첫 카드로 안전 fallback.
    recapCards[0]!
  )
}
