# Deepen × Upstage — 해커톤 데모

> 연고전 AI 해커톤 Business Track (2026-05-16) 부스 시연용.
> 5분 안에 "곡선 밖 접선을 못 푼 학생의 진짜 결손은 중3 판별식"을 그래프로 짚어낸다.

## 데모 흐름 (6단계)

```
① 랜딩 → ② 그래프 → ③ Q6 풀이 → ④ 결손 역추적 ★ → ⑤ 리캡 → ⑥ 재시도
        (캐시)        (실시간 OCR)    (실시간 Solar Pro)   (정적)    (재시도)
```

데모 전용 route `/demo` 외 모든 경로는 `proxy.ts`에서 `/demo`로 redirect.

## 핵심 파일

| 위치 | 역할 |
|---|---|
| `app/demo/` | 6단계 화면 + 공통 chrome (헤더·진행도바·리셋) |
| `lib/demo/queries.ts` | DB에서 데모 그래프·문제·인용 chunk fetch |
| `lib/demo/diagnose.ts` | ④ 결손 역추적 — Solar Pro 호출 + heuristic fallback |
| `lib/demo/recap-cards.ts` | LEAF-1·2·3 · MID-1·2 정적 카드 5개 |
| `lib/upstage/client.ts` | Solar Pro chat completions (OpenAI 호환) |
| `lib/db/schema.ts` | drizzle 전체 스키마 (nodes/edges/chunks/...) |
| `scripts/seed-demo.ts` | 데모 데이터 (Pattern 6 + Item 8 + 인용 5) seed |
| `proxy.ts` | 부스 모드 — `/demo` 외 redirect |

## Upstage 통합 지점

- **Solar Pro 2** → `lib/recap/diagnose.ts` 의 `scorePrereqMatch()` — 학생 풀이 + 후보 prereq + Context chunk → score + 본문 인용
- 옵션 (V2): Information Extract Vision — 손글씨 LaTeX 인식 (현재 V1 데모는 5지선다)

## 실행

```bash
# 1. env 채우기
cp .env.example .env.local   # (또는 직접 작성)
# NEXT_PUBLIC_SUPABASE_URL, ANON_KEY, SERVICE_ROLE_KEY
# DATABASE_URL (Transaction pooler)
# DEV_AUTH_BYPASS_USER_ID, EMAIL
# UPSTAGE_API_KEY, UPSTAGE_SOLAR_MODEL=solar-pro2

# 2. 의존성
npm install

# 3. DB
npm run db:migrate

# 4. 데모 데이터
npm run seed:demo

# 5. dev
npm run dev
# → http://localhost:3000  (자동으로 /demo 로 redirect)
```

## 데이터 모델

```
Pattern (6)        Item (8)
─────────────      ─────────────
LEAF-1 판별식      Q1 판별식 단독
LEAF-2 근존재      Q2 이차함수 x축
LEAF-3 미분=접선   Q3 이차함수+직선
MID-1  위치관계    Q4 미분계수
MID-2  곡선위접선  Q5 곡선위접선
TARGET 곡선밖접선  Q6 ★ TARGET (곡선 밖 접선)
                   Q7 TARGET+ 응용
                   Q8 (distractor 함수극한)

Edges
─────
LEAF-1 ─prereq→ LEAF-2, MID-1, TARGET
LEAF-3 ─prereq→ MID-2 ─prereq→ TARGET
MID-1  ─prereq→ TARGET
Pattern ─contains→ Item (Q8 제외)

Context chunks (NCIC 교육과정 발췌 5개)
  C1 (판별식)        → LEAF-1
  C2 (근존재)        → LEAF-2, MID-1
  C3 (미분계수)      → LEAF-3
  C4 (접선 방정식)   → MID-2
  C5 (곡선 밖 접선)  → TARGET
```

## 팀

박정현 · 남건우 · 남궁현종 · 문형서 · 한원석
(연세대 산업공학과)
