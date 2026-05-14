/**
 * Process-life OCR 결과 캐시.
 *
 * /api/demo/ocr 가 결과를 박고 cacheKey 반환.
 * /demo/diagnose 가 그 key 로 픽업해 diagnoseAttempt 에 전달.
 *
 * 같은 Next.js process 안에서만 유효. dev hot reload 시 비워질 수 있음 (데모 OK).
 */

import type { OcrStepsOutputT } from "@/lib/upstage/prompts/ocr-steps"

const _store = new Map<string, OcrStepsOutputT>()
const TTL_MS = 10 * 60 * 1000 // 10분

export function setOcrResult(value: OcrStepsOutputT): string {
  const key = crypto.randomUUID()
  _store.set(key, value)
  setTimeout(() => _store.delete(key), TTL_MS).unref?.()
  return key
}

export function getOcrResult(key: string): OcrStepsOutputT | null {
  return _store.get(key) ?? null
}
