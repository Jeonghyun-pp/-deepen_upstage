"use client"

import { useRouter } from "next/navigation"
import { useState } from "react"
import { ArrowRight } from "lucide-react"
import { startSession, clearSession } from "@/lib/demo/session"

type PersonaInfo = {
  key: string
  title: string
  subtitle: string
  count: number
  /** 시퀀스 1번째 item.uuid — /demo/solve 진입용. */
  firstItemId: string
}

export function PersonaPicker({ personas }: { personas: PersonaInfo[] }) {
  const router = useRouter()
  const [picking, setPicking] = useState<string | null>(null)

  function handlePick(p: PersonaInfo) {
    setPicking(p.key)
    clearSession()
    startSession(p.key)
    router.push(`/demo/solve?itemId=${p.firstItemId}&persona=${p.key}&round=1`)
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-3">
      {personas.map((p) => (
        <button
          key={p.key}
          onClick={() => handlePick(p)}
          disabled={picking !== null}
          className={`text-left p-4 rounded-md border transition ${
            picking === p.key
              ? "border-[#15803D] bg-[#15803D]/10"
              : "border-black/10 bg-white hover:border-[#15803D] hover:bg-[#15803D]/5"
          } disabled:opacity-60`}
        >
          <div className="text-[10px] tracking-[0.18em] font-bold uppercase text-[#15803D] mb-1.5">
            페르소나 {p.key} · {p.count}문제
          </div>
          <div className="text-sm font-bold mb-1">{p.title}</div>
          <div className="text-xs text-black/50 leading-relaxed">
            {p.subtitle}
          </div>
          <div className="mt-3 flex items-center gap-1 text-[11px] font-bold text-[#15803D]">
            5문제 시작
            <ArrowRight size={12} />
          </div>
        </button>
      ))}
    </div>
  )
}
