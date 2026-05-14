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
          5분이면<br />
          <span className="text-[#15803D]">5분의 격차</span>를 메운다
        </h1>
        <p className="text-lg md:text-xl text-black/60 leading-relaxed mb-12 max-w-xl">
          평가원 기출 한 문제. 학생이 못 풀면, 진짜 결손이 어디인지 — Deepen이 그래프를 거꾸로 짚는다.
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
