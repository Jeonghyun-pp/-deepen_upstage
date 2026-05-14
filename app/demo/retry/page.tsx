/**
 * ⑥ 재시도 — solve 페이지 mode=retry 로 redirect.
 */

import { redirect } from "next/navigation"
import { DEMO_TARGET_ITEM_ID } from "@/lib/demo/constants"

export default function RetryRedirect() {
  redirect(`/demo/solve?itemId=${DEMO_TARGET_ITEM_ID}&mode=retry`)
}
