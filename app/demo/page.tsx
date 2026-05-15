/**
 * ① 랜딩 (0:00 ~ 0:20).
 * 부스 방문자가 "한번 만져볼래요?" 권유받고 진입하는 페이지.
 */

import Link from "next/link"
import { ArrowRight } from "lucide-react"

export default function DemoLanding() {
  return (
    <div className="flex-1 flex items-center justify-center px-8">
      <div className="max-w-3xl">
        <div className="text-[11px] tracking-[0.25em] font-bold uppercase text-[#15803D] mb-6">
          Deepen × Upstage · Hackathon Demo
        </div>
        <h1 className="text-5xl md:text-7xl font-extrabold leading-[1.1] mb-8">
          5분 5문제로<br />
          <span className="text-[#15803D]">진짜 결손</span>을 찾는다
        </h1>
        <p className="text-lg md:text-xl text-black/60 leading-relaxed mb-12 max-w-xl">
          평가원 기출 5문제. 표면 단원은 달라도 같은 결손에서 막힌다면 — Deepen 그래프가 빨갛게 가리킨다.
        </p>
        <Link
          href="/demo/graph"
          className="inline-flex items-center gap-2 px-6 py-3 bg-[#15803D] text-white font-bold rounded-md hover:bg-[#0F6A30] transition"
        >
          데모 시작
          <ArrowRight size={18} />
        </Link>
        <div className="mt-16 text-xs text-black/40">
          1) 그래프 자동 생성 · 2) 펜으로 풀이 · 3) 결손 역추적 · 4) 2분 리캡 · 5) 재시도
        </div>
      </div>
    </div>
  )
}
