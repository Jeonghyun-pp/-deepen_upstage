/**
 * ③ OCR pipeline — Solar Pro 2 vision (multimodal).
 *
 *   image  ──[Solar Pro 2 vision]──→ { steps, studentAnswer }
 *
 * 회전된 사진·손글씨·한국어·수식 모두 vision 모델이 한 번에 처리.
 * Document Parse 는 인쇄물 전용으로 손글씨 + 회전에 약해서 제거.
 *
 * 호출처: app/api/demo/ocr/route.ts
 * 실패 시: STUB_OCR_RESULT 로 fallback (route 가 결정).
 */

import OpenAI from "openai"
import { env, features } from "@/lib/env"
import { OcrStepsOutput, type OcrStepsOutputT } from "./prompts/ocr-steps"

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

const VISION_SYSTEM = `당신은 한국 고등학교 수학 손글씨 풀이를 인식하는 OCR 도우미다.

이미지에는 학생이 종이에 적은 풀이가 있다. 사진이 옆/거꾸로 회전돼있어도 글자 방향을 자동 인식해서 읽어라.

규칙:
1. 학생이 실제로 적은 식만 단계로 추출. 정답 풀이를 만들어 끼우지 마라.
2. 각 step 의 label 은 한국어 (예: "도함수 계산", "극값 조건", "f(2) 대입").
3. 알아볼 수 없는 영역은 skip.
4. 학생이 도달한 최종 답을 studentAnswer 에 표기. 객관식이면 보기 번호 또는 그 텍스트 (예: "14", "③", "k < -4", "2개").
5. steps 는 1~6개.

응답은 반드시 JSON:
{ "steps": [{"latex": "...", "label": "..."}], "studentAnswer": "..." }`

/**
 * 메인 — image → { steps, studentAnswer }.
 *
 * @param blob 학생 풀이 이미지 (jpeg/png)
 * @param _filename 디버그용 (Upstage 호출엔 사용 X)
 * @param problemContext 학생이 풀던 문제 본문
 */
export async function parseHandwriting(
  blob: Blob,
  _filename: string,
  problemContext: string,
): Promise<OcrStepsOutputT> {
  const client = getSolarClient()
  if (!client) throw new Error("Upstage 키 미설정")

  // 이미지 → base64 dataURL.
  const arrayBuffer = await blob.arrayBuffer()
  const base64 = Buffer.from(arrayBuffer).toString("base64")
  const mimeType = blob.type || "image/jpeg"
  const dataUrl = `data:${mimeType};base64,${base64}`

  const resp = await client.chat.completions.create({
    model: env.UPSTAGE_SOLAR_MODEL,
    messages: [
      { role: "system", content: VISION_SYSTEM },
      {
        role: "user",
        content: [
          {
            type: "text",
            text:
              `학생이 풀던 문제:\n${problemContext}\n\n` +
              "위 사진은 이 학생의 손글씨 풀이입니다. " +
              "단계별로 추출하고 최종 답을 찾으세요.",
          },
          {
            type: "image_url",
            image_url: { url: dataUrl },
          },
        ],
      },
    ],
    response_format: { type: "json_object" },
    temperature: 0.1,
    max_tokens: 1500,
  })
  const raw = resp.choices[0]?.message?.content ?? ""
  return OcrStepsOutput.parse(JSON.parse(raw))
}

/**
 * 데모 안전판 — Upstage 실패 / sample 누락 시 fallback.
 *
 * 의도적으로 generic (특정 문제의 정답 X) — 시연자가 stub 노출을 인지할 수 있게.
 * 라이브 OCR 가 실패하면 화면에 "OCR 실패 (재업로드 권장)" 으로 보임.
 */
export const STUB_OCR_RESULT: OcrStepsOutputT = {
  steps: [
    { latex: "\\text{(OCR 인식 실패 — 재업로드 권장)}", label: "OCR 실패" },
  ],
  studentAnswer: "?",
}
