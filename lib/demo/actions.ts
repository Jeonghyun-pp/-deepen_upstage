"use server"

/**
 * Server Actions — client component 가 Solar Pro 호출 결과를 직접 받기 위함.
 *
 * /demo/diagnose AggregateView 에서 호출.
 */

import { narrateAggregate } from "./diagnose"
import type { DemoSession } from "./session"
import type { AggregateResult } from "./aggregate"

export async function getAggregateNarration(input: {
  session: DemoSession
  aggregate: AggregateResult
  topNodeLabel: string
}): Promise<string> {
  return narrateAggregate(input)
}
