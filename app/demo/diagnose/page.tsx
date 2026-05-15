/**
 * ④ 진단 (2:00 ~ 2:45) — ★ 데모 임팩트 정점.
 *
 * 실시간 Solar Pro 호출 (lib/upstage/client.ts).
 * BFS 화살표 애니메이션으로 TARGET → LEAF-1 역추적 시각화.
 * NCIC 인용 형광 highlight.
 */

import { diagnoseAttempt } from "@/lib/demo/diagnose"
import { DiagnoseView } from "../_components/DiagnoseView"
import { getTargetItemId } from "@/lib/demo/data-loader"
import { getOcrResult } from "@/lib/demo/ocr-store"

type Props = {
  searchParams: Promise<{
    itemId?: string
    attempt?: string
    stepsKey?: string
  }>
}

export default async function DiagnoseScreen({ searchParams }: Props) {
  const {
    itemId = getTargetItemId(),
    attempt = "wrong",
    stepsKey,
  } = await searchParams

  // ③ OCR pipeline 결과가 있으면 그걸 학생 풀이로 사용.
  // 없으면 diagnose.ts 내부 STUB_WRONG_ATTEMPT 가 fallback.
  const ocr = stepsKey ? getOcrResult(stepsKey) : null

  const diagnosis = await diagnoseAttempt({
    itemId,
    attemptKey: attempt,
    studentSteps: ocr?.steps.map((s) => s.latex),
    studentAnswer: ocr?.studentAnswer,
  })

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-8 pt-6">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-[#DA1E28] mb-2">
          STEP 4 / 6 · 결손 역추적
        </div>
        <h2 className="text-2xl font-bold">
          진짜 결손은 <span className="text-[#DA1E28]">{diagnosis.candidate.label}</span>
        </h2>
      </div>

      <DiagnoseView diagnosis={diagnosis} />
    </div>
  )
}
