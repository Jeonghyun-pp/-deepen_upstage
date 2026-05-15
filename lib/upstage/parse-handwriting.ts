/**
 * ③ OCR pipeline — Upstage Document Parse + Solar Pro 2.
 *
 *   image  ──[Document Parse]──→ rawText
 *   rawText + Q6 context ──[Solar Pro 2 + prompts/ocr-steps]──→ { steps, studentAnswer }
 *
 * 호출처: app/api/demo/ocr/route.ts
 * 실패 시: STUB_OCR_RESULT 로 fallback (route 가 결정).
 */

import OpenAI from "openai"
import { env, features } from "@/lib/env"
import {
  buildMessages as buildOcrMessages,
  OcrStepsOutput,
  type OcrStepsOutputT,
} from "./prompts/ocr-steps"

const DOCUMENT_PARSE_URL = "https://api.upstage.ai/v1/document-digitization"

let _solarClient: OpenAI | null = null
function getSolarClient(): OpenAI | null {
  if (!features.upstage) return null
  if (!_solarClient) {
    _solarClient = new OpenAI({
      apiKey: env.UPSTAGE_API_KEY!,
      baseURL: "https://api.upstage.ai/v1",
    })
  }
  return _solarClient
}

/**
 * 1) Document Parse — 이미지/PDF → text/markdown.
 */
async function documentParse(blob: Blob, filename: string): Promise<string> {
  if (!features.upstage) throw new Error("Upstage 키 미설정")

  const form = new FormData()
  form.append("document", blob, filename)
  form.append("model", "document-parse")
  // OCR 강제 — 손글씨/이미지 PDF 다 cover.
  form.append("ocr", "force")

  const resp = await fetch(DOCUMENT_PARSE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${env.UPSTAGE_API_KEY}`,
    },
    body: form,
  })

  if (!resp.ok) {
    const text = await resp.text()
    throw new Error(
      `Document Parse ${resp.status}: ${text.slice(0, 300)}`,
    )
  }

  const data = (await resp.json()) as {
    content?: { markdown?: string; text?: string; html?: string }
    text?: string
    markdown?: string
    html?: string
  }

  // 응답 shape 변종 흡수 (markdown > text > html 우선).
  const out =
    data.content?.markdown ??
    data.markdown ??
    data.content?.text ??
    data.text ??
    data.content?.html ??
    data.html ??
    ""

  if (!out.trim()) {
    throw new Error("Document Parse 응답 비어있음")
  }
  return out
}

/**
 * 2) Solar Pro 2 — rawText → { steps, studentAnswer } 구조화.
 */
async function structureSteps(
  rawText: string,
  problemContext: string,
): Promise<OcrStepsOutputT> {
  const client = getSolarClient()
  if (!client) throw new Error("Upstage 키 미설정")

  const messages = buildOcrMessages({ rawText, problemContext })
  const resp = await client.chat.completions.create({
    model: env.UPSTAGE_SOLAR_MODEL,
    messages,
    response_format: { type: "json_object" },
    temperature: 0.1,
  })
  const raw = resp.choices[0]?.message?.content ?? ""
  return OcrStepsOutput.parse(JSON.parse(raw))
}

/**
 * 메인 — image → { steps, studentAnswer }.
 */
export async function parseHandwriting(
  blob: Blob,
  filename: string,
  problemContext: string,
): Promise<OcrStepsOutputT> {
  const rawText = await documentParse(blob, filename)
  return structureSteps(rawText, problemContext)
}

/**
 * 데모 안전판 — Upstage 실패 / sample 누락 시 fallback.
 * Q6 학생 풀이 (판별식 누락 시나리오와 일치).
 */
export const STUB_OCR_RESULT: OcrStepsOutputT = {
  steps: [
    { latex: "(t,\\ t^2+t+1)", label: "접점 설정" },
    { latex: "f'(t)=2t+1", label: "기울기 계산" },
    {
      latex: "-3-(t^2+t+1)=(2t+1)(0-t)",
      label: "접선이 (0,-3) 통과 조건",
    },
    {
      latex: "-t^2=4\\ \\Rightarrow\\ t^2=-4",
      label: "부호 처리 — 판별식 미적용",
    },
  ],
  studentAnswer: "0개",
}
