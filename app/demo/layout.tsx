/**
 * 데모 전용 layout — 부스 시연용 격리된 routing.
 *
 * 디자인 원칙:
 *   - 한 화면당 1 결정/액션
 *   - 진행도 bar 항상 하단
 *   - 우상단 리셋 버튼 → /demo
 *   - 인증 우회 (DEV_AUTH_BYPASS_USER_ID 로 작동)
 */

import { DemoChrome } from "./_components/DemoChrome"

export const metadata = {
  title: "Deepen — 데모",
  description: "해커톤 부스 시연용 5분 데모",
}

export default function DemoLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <DemoChrome>{children}</DemoChrome>
  )
}
