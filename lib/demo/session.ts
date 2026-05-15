/**
 * 데모 세션 — sessionStorage 5회 풀이 history 저장/조회.
 *
 * 흐름:
 *   /demo/graph → 페르소나 선택 + startSession()
 *   /demo/solve (회차 1~5) → 풀이 진단 후 appendAttempt()
 *   /demo/diagnose → getSession() 으로 5회 history 읽음
 *   /demo/recap → 종합 결손 노드 기반 카드 렌더
 *
 * 정책:
 *   - SSR 호환 (window 없는 환경에서는 in-memory dummy).
 *   - 페르소나 변경 시 기존 세션 덮어씀.
 *   - 새 페이지 refresh 후에도 같은 탭이면 유지 (sessionStorage).
 */

const STORAGE_KEY = "deepen.demo.session"

export type AttemptRecord = {
  /** items.uuid */
  itemId: string
  /** items.stableKey (Q1 등) — UI 표시·디버그용 */
  itemStableKey: string
  /** 이 문제의 정답 결손 후보 — items.patternKey */
  itemPatternKey: string
  studentAnswer: string
  correctAnswer: string
  isCorrect: boolean
  studentSteps: string[]
  /** 회차별 단회 진단 결과 — diagnose.ts diagnoseAttempt() 의 candidate.patternKey */
  candidatePatternKey: string
  candidateLabel: string
  candidateScore: number
  candidateRationale: string
  /** 회차별 진단 시 인용된 chunk (없을 수도) */
  justificationQuote: string | null
  timestamp: number
}

export type DemoSession = {
  /** "A" | "B" | "C" | "D" */
  personaKey: string
  attempts: AttemptRecord[]
  startedAt: number
}

// SSR fallback — server 컴포넌트에서 import 시 throw 안 하도록.
const _memoryStore: { current: DemoSession | null } = { current: null }

function hasStorage(): boolean {
  return typeof window !== "undefined" && !!window.sessionStorage
}

export function startSession(personaKey: string): DemoSession {
  const s: DemoSession = {
    personaKey,
    attempts: [],
    startedAt: Date.now(),
  }
  if (hasStorage()) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(s))
  } else {
    _memoryStore.current = s
  }
  return s
}

export function getSession(): DemoSession | null {
  if (hasStorage()) {
    const raw = window.sessionStorage.getItem(STORAGE_KEY)
    return raw ? (JSON.parse(raw) as DemoSession) : null
  }
  return _memoryStore.current
}

export function appendAttempt(attempt: AttemptRecord): DemoSession {
  let cur = getSession()
  if (!cur) {
    // 세션 없이 들어왔으면 페르소나 A 로 기본 시작.
    cur = startSession("A")
  }
  // itemId 기반 upsert — 같은 문제를 다시 풀면 (뒤로가기 등) 덮어쓰기.
  // attempts 길이 = 풀이한 문제 수 (중복 없음) 가 보장됨.
  const existingIdx = cur.attempts.findIndex((a) => a.itemId === attempt.itemId)
  if (existingIdx >= 0) {
    cur.attempts[existingIdx] = attempt
  } else {
    cur.attempts.push(attempt)
  }
  if (hasStorage()) {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(cur))
  } else {
    _memoryStore.current = cur
  }
  return cur
}

export function clearSession(): void {
  if (hasStorage()) {
    window.sessionStorage.removeItem(STORAGE_KEY)
  } else {
    _memoryStore.current = null
  }
}

/** 회차 인덱스 (0-base) — UI indicator 용. */
export function currentRoundIndex(): number {
  return getSession()?.attempts.length ?? 0
}

export const TOTAL_ROUNDS = 5
