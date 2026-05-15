/**
 * 손글씨 노트 OCR — Upstage Document Parse.
 *
 * SolveCanvas 가 화면의 "학생 손풀이" 패널을 PNG 로 캡처해 넘기면
 * Document Parse(ocr=force) 로 텍스트를 추출한다.
 *
 * 입력이 messy 사진이 아니라 손글씨 폰트로 렌더된 깨끗한 이미지이므로
 * Document Parse 만으로 충분히 인식된다 (vision 모델 불필요).
 *
 * 호출처: lib/demo/actions.ts → recognizeHandwriting (server action)
 */

import { env, features } from "@/lib/env"

const ENDPOINT = "https://api.upstage.ai/v1/document-digitization"

export type HandwritingOcrResult = {
  /** 추출 텍스트 (text 우선, 없으면 markdown). */
  text: string
  /** Upstage 호출 소요(ms) — 데모에서 "실시간" 근거로 노출. */
  ms: number
}

/** data:image/png;base64,... dataURL → Document Parse 추출 텍스트. */
export async function recognizeHandwritingImage(
  dataUrl: string,
): Promise<HandwritingOcrResult> {
  if (!features.upstage) throw new Error("UPSTAGE_API_KEY 미설정")

  const m = /^data:(image\/[\w.+-]+);base64,([\s\S]+)$/.exec(dataUrl)
  if (!m) throw new Error("invalid image dataURL")
  const [, mime, b64] = m
  const buf = Buffer.from(b64, "base64")

  const form = new FormData()
  form.append("document", new Blob([buf], { type: mime }), "handwriting.png")
  form.append("model", "document-parse")
  // 손글씨 폰트 렌더 이미지 — auto 는 디지털 텍스트만 검출하므로 force.
  form.append("ocr", "force")
  form.append("output_formats", '["text","markdown"]')

  const t0 = Date.now()
  const res = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${env.UPSTAGE_API_KEY}` },
    body: form,
  })
  const ms = Date.now() - t0
  if (!res.ok) {
    throw new Error(
      `Document Parse HTTP ${res.status}: ${await res.text().catch(() => "")}`,
    )
  }
  const json = await res.json()
  const text: string = json?.content?.text ?? json?.content?.markdown ?? ""
  return { text: text.trim(), ms }
}
