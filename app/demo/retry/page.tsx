/**
 * ⑥ 재시도 — solve 페이지 mode=retry 로 redirect.
 */

import { redirect } from "next/navigation"
import { getTargetItemId } from "@/lib/demo/data-loader"

export default function RetryRedirect() {
  redirect(`/demo/solve?itemId=${getTargetItemId()}&mode=retry`)
}
