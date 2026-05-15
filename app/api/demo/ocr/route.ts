/**
 * POST /api/demo/ocr?itemId=...
 *
 * 입력
 *   - multipart/form-data 의 "file" 필드 = 학생 풀이 이미지
 *   - 또는 body 없이 호출 시 sample 이미지 (public/demo/q6-student-handwriting.png) 사용
 *
 * 출력 { result: OcrStepsOutputT, source: "live" | "sample" | "stub" }
 *
 * source 의미
 *   live    유저가 업로드한 이미지 → Upstage 호출 성공
 *   sample  sample 이미지 → Upstage 호출 성공 (캐시될 수 있음)
 *   stub    Upstage 실패 or sample 누락 — 정적 STUB_OCR_RESULT
 */

import { NextRequest, NextResponse } from "next/server"
import path from "node:path"
import fs from "node:fs/promises"
import {
  parseHandwriting,
  STUB_OCR_RESULT,
} from "@/lib/upstage/parse-handwriting"
import { loadDemoItem } from "@/lib/demo/queries"
import { getTargetItemId } from "@/lib/demo/data-loader"
import { setOcrResult } from "@/lib/demo/ocr-store"
import type { OcrStepsOutputT } from "@/lib/upstage/prompts/ocr-steps"

// process-life 캐시 — sample 이미지 OCR 결과 1회만 호출.
let _sampleCache: OcrStepsOutputT | null = null

const SAMPLE_PATH = path.join(
  process.cwd(),
  "public",
  "demo",
  "q6-student-handwriting.png",
)

export async function POST(req: NextRequest) {
  const itemId = req.nextUrl.searchParams.get("itemId") ?? getTargetItemId()
  const item = await loadDemoItem(itemId)
  if (!item) {
    return NextResponse.json(
      { error: `item not found: ${itemId}` },
      { status: 404 },
    )
  }

  const contentType = req.headers.get("content-type") ?? ""
  const isMultipart = contentType.startsWith("multipart/form-data")

  // ── sample mode ──
  if (!isMultipart) {
    if (_sampleCache) {
      const stepsKey = setOcrResult(_sampleCache)
      return NextResponse.json({
        result: _sampleCache,
        source: "sample",
        stepsKey,
      })
    }
    try {
      const buf = await fs.readFile(SAMPLE_PATH)
      const blob = new Blob([buf], { type: "image/png" })
      const result = await parseHandwriting(
        blob,
        "q6-student-handwriting.png",
        item.content,
      )
      _sampleCache = result
      const stepsKey = setOcrResult(result)
      return NextResponse.json({ result, source: "sample", stepsKey })
    } catch (err) {
      console.warn("[demo/ocr] sample mode failed, fallback to stub:", err)
      const stepsKey = setOcrResult(STUB_OCR_RESULT)
      return NextResponse.json({
        result: STUB_OCR_RESULT,
        source: "stub",
        stepsKey,
      })
    }
  }

  // ── live upload ──
  try {
    const form = await req.formData()
    const file = form.get("file")
    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: "form field 'file' required" },
        { status: 400 },
      )
    }
    const result = await parseHandwriting(file, file.name, item.content)
    const stepsKey = setOcrResult(result)
    return NextResponse.json({ result, source: "live", stepsKey })
  } catch (err) {
    console.warn("[demo/ocr] live upload failed, fallback to stub:", err)
    return NextResponse.json({ result: STUB_OCR_RESULT, source: "stub" })
  }
}
