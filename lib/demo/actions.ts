"use server"

/**
 * Server Actions — client component 가 Solar Pro 호출 결과를 직접 받기 위함.
 *
 * /demo/diagnose AggregateView 에서 호출.
 */

import { narrateAggregate } from "./diagnose"
import { diagnoseSolution } from "@/lib/upstage/client"
import type { DemoSession } from "./session"
import type { AggregateResult } from "./aggregate"
import type {
  SolutionDiagnosisInput,
  SolutionDiagnosisOutputT,
} from "@/lib/upstage/prompts/solution-diagnosis"

export async function getAggregateNarration(input: {
  session: DemoSession
  aggregate: AggregateResult
  topNodeLabel: string
}): Promise<string> {
  return narrateAggregate(input)
}

/**
 * few-shot 풀이 진단 — 회차별 SolveCanvas 에서 호출.
 * Solar 실패 시 null (UI 가 단순 정답/오답으로 fallback).
 */
export async function runSolutionDiagnosis(
  input: SolutionDiagnosisInput,
): Promise<SolutionDiagnosisOutputT | null> {
  try {
    return await diagnoseSolution(input)
  } catch (err) {
    console.warn("[demo] runSolutionDiagnosis fail:", err)
    return null
  }
}
