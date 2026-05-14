"use client"

import Link from "next/link"
import { usePathname, useRouter } from "next/navigation"
import { RotateCcw } from "lucide-react"

const STEPS = [
  { path: "/demo", label: "① 랜딩" },
  { path: "/demo/graph", label: "② 그래프" },
  { path: "/demo/solve", label: "③ 풀이" },
  { path: "/demo/diagnose", label: "④ 진단" },
  { path: "/demo/recap", label: "⑤ 리캡" },
  { path: "/demo/retry", label: "⑥ 재시도" },
]

export function DemoChrome({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const currentIdx = STEPS.findIndex((s) => s.path === pathname)

  return (
    <div className="min-h-screen flex flex-col bg-[#FAFAF8] text-[#1A1A2E]">
      <header className="flex items-center justify-between px-8 py-4 border-b border-black/5">
        <Link
          href="/demo"
          className="font-extrabold tracking-[0.18em] text-xs"
        >
          DEEPEN<span className="opacity-40">.DEMO</span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-[10px] tracking-[0.18em] font-bold opacity-50">
            예시 데이터셋
          </span>
          <button
            onClick={() => router.push("/demo")}
            className="flex items-center gap-1 text-xs font-medium px-3 py-1.5 rounded-md hover:bg-black/5 transition"
            title="다음 방문자용 리셋"
          >
            <RotateCcw size={14} />
            다시 시작
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col">{children}</main>

      <footer className="border-t border-black/5 px-8 py-3">
        <div className="flex items-center gap-2 text-[11px]">
          {STEPS.map((s, i) => {
            const active = i === currentIdx
            const done = currentIdx > i
            return (
              <div key={s.path} className="flex items-center gap-2">
                <div
                  className={`px-2 py-1 rounded ${
                    active
                      ? "bg-[#15803D] text-white font-bold"
                      : done
                        ? "text-[#15803D]"
                        : "text-black/30"
                  }`}
                >
                  {s.label}
                </div>
                {i < STEPS.length - 1 && (
                  <div className="text-black/20">›</div>
                )}
              </div>
            )
          })}
        </div>
      </footer>
    </div>
  )
}
