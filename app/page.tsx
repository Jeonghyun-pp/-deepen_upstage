/**
 * 루트 / → /demo redirect.
 * 부스 시연 시 어떤 URL로 들어와도 데모로 떨어지게.
 */

import { redirect } from "next/navigation"

export default function RootRedirect() {
  redirect("/demo")
}
