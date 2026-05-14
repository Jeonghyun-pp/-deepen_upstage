# 해커톤 D-2 팀 회의 아젠다

> 연고전 AI 해커톤 Business Track · 2026-05-14 (목) · 90~120분 · 본행사 5/16까지 D-2
> 박정현 · 남건우 · 남궁현종 · 문형서 · 한원석

## 왜 이 회의가 필요한가

1p 기획서는 제출됐다 (5/13). 그러나 **검증 · 알고리즘 · UX · RNR이 모두 미확정**이다. 이대로 빌드에 들어가면 5명이 다른 그림을 그린다.

### 핵심 가드라인 3개

1. **LLM 교체 ≠ 알고리즘 교체** — Document Parse · Information Extract는 출력 형태와 작업 단위 자체가 다르다.
2. **Upstage 마케팅 수치를 그대로 인용 X** — KIEval 78.32, TEDS 94.48은 자체 데이터셋 기준. 자체 측정 수치만 슬라이드에 박는다.
3. **데모 5분 = 평가의 절반** — 피어 투자가 평가 50%. 슬라이드보다 만져볼 수 있는 데모가 표를 모은다.

### 회의 산출물 4개

① 고정 데이터셋 (Context 1 + 8문제)
② 알고리즘 깊이 (Upstage 부품 vs 자체 코드 경계선)
③ 부스 시연 5분 시나리오
④ RNR + 일정

---

## 1. 데이터

### Prerequisite 체인

```
중3 판별식 → 고1 이차방정식 → 고1 이차함수 → 고2 곡선 밖 접선
```

### Context 문서 (택1)

- **A (추천)** 「2022 개정 수학과 교육과정」 (NCIC) 발췌 5~8p — 정부 공식 문서, prerequisite 체인이 학년별 성취기준으로 명시되어 있음
- **B** EBSi 무료 공개 강의 자료
- **C** 평가원 출제의도 · 해설집 묶음

### 8문제 출처 (모두 공공저작물)

| # | 출처 | 라벨 | 키워드 |
|---|---|---|---|
| Q1 | 중3 학업성취도 / 고1 3월 교육청 | LEAF-1 | 판별식 단독 |
| Q2 | 고1 교육청 (3·6·9월) | LEAF-2 | 이차함수 x축 교점 |
| Q3 | 고1 교육청 11월 | MID-1 | 이차함수 + 직선 위치관계 |
| Q4 | 고2 교육청 / 평가원 수1 | LEAF-3 | 미분계수 = 접선 기울기 |
| Q5 | 평가원 6·9평 미적분 | MID-2 | 곡선 위 접선 |
| **Q6** | **평가원 수능·모평 미적분** | **TARGET** | **곡선 밖 접선 개수** |
| Q7 | 평가원 미적분 고난도 | TARGET+ | 접선 + 모수 |
| Q8 | 평가원 함수 극한 | NEGATIVE | distractor |

### 라벨링 약속

각 문제마다 1~2줄로 기록 → `docs/hackathon-2026/fixed-dataset.md`

- 정답
- 필요한 prerequisite 노드 ID 셋 (LEAF-1, MID-2, TARGET …)
- 학생이 막힐 만한 지점 (예: Q6 → "두 접선 위치 → 이차방정식 → 판별식"의 마지막에서 실패)

저작권 출처: 평가원(kice.re.kr) · EBSi(ebsi.co.kr) · NCIC(ncic.re.kr) — 전부 공공저작물.

---

## 2. 검증

**원칙**: 이전 도메인 precision 60.5/74.3% 같은 수치는 노이즈. **고정 데이터셋 8문제 셋으로 binary PASS/FAIL 7개**만 본다. 결과는 `docs/hackathon-2026/validation-2026-05-14.md`에 한 줄씩 기록.

### 검증 항목 7개

| # | 테스트 | Baseline | Upstage / 자체 | PASS 기준 |
|---|---|---|---|---|
| **T1** | Context 파싱 | unpdf | Document Parse | 수식이 LaTeX/MathML로 살아 있음 (수동 확인) |
| **T2** | Entity 추출 | gpt-4o-mini | Information Extract | LEAF/MID/TARGET 노드가 의미상 다 존재 |
| **T3** | Prerequisite 엣지 | gpt-4o-mini | A2 (자체) | 핵심 엣지 4개 중 3개 이상 |
| **T4** | Chunk-mapping | placeholder `[]` | Information Extract | Q6 → TARGET conf ≥ 0.7 |
| **T5** ★ | **결손 역추적 (데모 핵심)** | (없음) | A3 (자체) | Q6 오답 입력 → LEAF-1 (판별식) 지목 |
| **T6** | Distractor 거부 | (없음) | A3 | Q8 오답에 LEAF-1을 잘못 지목하지 않음 |
| **T7** | 한국어 retrieval (선택) | OpenAI emb | Upstage emb | recall@5가 OpenAI 대비 +5%p |

### 🚨 Fallback 시나리오 (회의에서 미리 픽스)

- **T1 FAIL** → 해커톤 전략 전면 재검토 (가장 큰 한방 상실)
- **T2 FAIL** → gpt-4o-mini 유지 + Solar Pro 2를 한국어 리캡 생성기로 강등
- **T3 FAIL** → A2 Stage 2를 GPT-4o로 시도. 그래도 안 되면 Q6용 그래프 하드코딩
- **T5 FAIL** → 데모 시나리오를 "결손 후보 top-3 제안"으로 약화 (학생이 선택하는 UX)

측정 일정: 회의 직후 4시간 안에 T1·T2·T3·T5 끝낸다. **T1·T5가 두 게이트**.

---

## 3. 알고리즘

**핵심 메시지**: Upstage는 부품, **차별점은 우리가 짜는 4개 알고리즘**이다. Document Parse · Information Extract는 출력 형태와 작업 단위 자체가 다르므로 단순 endpoint 교체로는 절반도 못 간다.

### 🧩 Upstage가 들어갈 곳 (2 + 1)

| 우선순위 | 제품 | 위치 | 역할 |
|---|---|---|---|
| **P0** | Document Parse | `lib/pipeline/parse-pdf.ts:98` | `unpdf` 대체. 표·수식·도표 보존, layout-aware HTML/Markdown 출력 |
| **P0** | Information Extract | `lib/pipeline/extract-nodes.ts:14` | gpt-4o-mini 대체. 한국어 entity 추출 (스키마 기반). *prerequisite 엣지 추출은 강점 아님* |
| 옵션 | Upstage Embedding | retrieval 단 | OpenAI text-embedding 대체. 한국어 의미 검색 |

### ⚙️ 자체 알고리즘 — 차별점 (4개)

#### A1. Layout-aware chunker

- `<table>` 통째 1 chunk, 수식 블록 보존
- Document Parse heading 트리를 활용해 각 chunk에 **섹션 path** 부여
- chunk type 분리 (정의문 / 풀이 / 표) — 다운스트림 노드 추출기에 신호 전달

#### A2. 2-stage prerequisite 엣지 추출

- Stage 1 — Information Extract로 Concept/Pattern **entity만** 추출 (잘 하는 영역)
- Stage 2 — 각 entity 쌍 후보에 대해 Solar Pro 2/3 structured CoT 호출: "A를 이해하려면 B가 선수 지식인가? 본문 인용으로 근거"
- justification quote 검증 + confidence threshold 필터

#### A3. 결손 역추적 (T5 = 데모 핵심)

```
INPUT: 학생 풀이 (LaTeX 단계) + 학생 답 + 정답 + 문제 노드(Q6)

1. Solar Pro 2/3: 풀이가 어디서 막혔는지 판단 → 실패 단계(s_fail)
2. 그래프: Q6 → prerequisite 노드들 BFS, 깊이 2~3
3. 각 후보 prereq에 대해 LLM scoring: "s_fail이 이 노드 결손과 일치?"
4. confidence top-K 노드 반환 + 본문 인용

OUTPUT: missing_prerequisite + justification
```

#### A4. Confidence 정책

- IE confidence + justification quote **본문 fuzzy match 검증**
- ≥ 0.7 → auto-confirm (그래프 즉시 반영)
- 0.4 ~ 0.7 → 어드민 review 큐 (시연용 슬라이더로 노출)
- < 0.4 → drop

### 오늘 결정 3개

1. **Upstage / 자체 경계선** (위 그림으로 확정)
2. **T5 의사코드 합의** (회의에서 화이트보드 1장)
3. **chunking 단위 + confidence threshold 숫자**

---

## 4. UX (부스 시연 5분)

**원칙**: 피어 투자가 평가 50%. 슬라이드보다 **만져볼 수 있는 데모**가 표를 모은다. 노트북 1대 + 큰 화면. 모바일 시연 안 함.

### 5분 시나리오 (6단계)

| 시간 | 화면 | 입력 / 액션 | 시스템 응답 | Owner |
|---|---|---|---|---|
| 0:00~0:30 | 업로드 | Context PDF + 8문제 드래그앤드롭 | 분류 + 파싱 진행바 | Backend |
| 0:30~1:30 | 그래프 | (자동) | Concept-Pattern-Item 그래프 30초 내 렌더 | Frontend |
| 1:30~2:30 | Q6 캔버스 | 펜으로 풀이 (의도적 오답) | LaTeX 단계 자동 인식 | Frontend |
| 2:30~3:30 | 진단 | (자동) | "진짜 결손은 LEAF-1 (판별식)" + 인용 하이라이트 | 알고리즘 |
| 3:30~4:30 | 리캡 카드 | 카드 클릭 | 2분짜리 한국어 리캡 + Q1 (LEAF-1) 풀이 | 알고리즘 |
| 4:30~5:00 | 복귀 | Q6 재시도 | 정답 + 그래프에서 LEAF-1·TARGET 둘 다 highlight | Frontend |

### 🎯 데모 임팩트 체크리스트

1. **30초 룰** — 업로드 후 30초 안에 그래프가 떠야 한다. 대기 화면이 길면 부스에서 사람이 떠남
2. **인용 가시화** — "진짜 결손" 카드에 Context 문서 인용을 **형광색으로 표시**. 환각이 아님을 증명하는 가장 강한 한 컷
3. **그래프 인터랙션** — 다른 팀이 노드를 클릭해서 prerequisite을 따라가볼 수 있어야 한다
4. **5분 후 재시작 버튼** — 부스 반복 시연 가능하도록
5. **노트북 1대 + 큰 화면** — 모바일 폴백 안 만든다

### 오늘 결정 1개

6단계 화면 흐름 + 화면별 owner 확정. 시간 배분 (특히 1:30~2:30 펜 풀이 1분) 현실성 검토.

---

## 5. RNR

### 4개 트랙

| 트랙 | 작업 | 인원 | 의존성 |
|---|---|---|---|
| **A. Backend / Upstage** | Document Parse + IE wiring (T1 · T2) | 1~2명 | API 키 확보 |
| **B. 알고리즘 (차별점)** | A2 엣지 추출 + A3 결손 역추적 (T3 · T5) | 1~2명 | A 트랙 출력 |
| **C. Frontend / 데모 UX** | 6단계 화면 polish + tldraw 단일 캔버스 마무리 | 1명 | UX 시나리오 결정 |
| **D. 발표 / 측정 / 제출** | 7분 피치 덱 + 측정 결과 슬라이드 + README + 1p PDF 최종 + GitHub 정리 | 1명 | 전 트랙 결과 통합 |

> 트랙 D를 한 명이 잡으면 측정 결과가 그대로 슬라이드로 떨어지고 피치 메시지와 일관성이 유지됨.

### 📅 남은 일정

**5/14 (목) — 오늘**
- 회의 후 즉시 검증 4시간 (T1 · T2 · T3 · T5)
- 결과 보고 + fallback 발동 여부 슬랙 공지

**5/15 (금)**
- 09:00 — 트랙별 첫 PR
- 오후 — 통합 + 데모 리허설
- 21:00 — 5분 시나리오 풀 런 1회
- **23:59 — 장표 PDF + GitHub 레포 제출 (절대 마감)**

**5/16 (토) — 본행사**
- 15:00 — 입장
- 15:30 ~ 17:30 — 피치 7분 + Q&A
- 17:30 ~ 18:30 — 부스 데모 (피어 투자)
- 19:00 — 결과 발표

### 📦 제출물 OWNER (트랙 D)

| 산출물 | 마감 | 형식 |
|---|---|---|
| 1p 기획서 PDF | ✅ 5/13 제출 완료, 최종본 GitHub 업로드 | PDF |
| 발표 장표 PDF | 5/15 23:59 | ~10-12장 (7분 압축) |
| GitHub README | 5/15 23:59 | 서비스 개요 · Upstage 제품 · 데모 접속법 |
| 데모 자료 | 5/16 부스 | QR 코드 · 데모 계정 |

### 오늘 결정 2개

1. **5명 → 4트랙 배치** (트랙 D는 가능한 한 본행사 발표자 본인이 잡기)
2. **회의 직후 4시간 검증 시작 가능 여부** 확인 (5명 모두 오늘 일정 비어 있는지)

---

## 회의 전 준비물 (안 가져오면 회의가 굴러가지 않음)

| # | 항목 | Owner | 산출물 |
|---|---|---|---|
| 1 | Context 문서 후보 PDF 3개 (NCIC · EBSi · 평가원 해설) | 1명 | 노트북에 다운로드 |
| 2 | 8문제 후보 PDF 셋 (Q1~Q8) | 1명 | 평가원·교육청 사이트 발췌 |
| 3 | 현재 코드 4파일 현황 브리핑 (`parse-pdf.ts` / `extract-nodes.ts` / `chunk-mapping.ts` / `upload/route.ts`) | 코드 잘 아는 사람 | 각 1분 |
| 4 | Upstage API 키 (`UPWAVE-YONSEI` redeem 끝낸 계정) | 1명 | $80 잔액 확인 |
| 5 | `upstage-mapping.md` 사전 읽기 | 전원 | 회의 전 10분 |

## 🚀 회의 종료 직후 액션

1. **4시간 검증 즉시 시작** — T1 · T2 · T3 · T5
2. **결과를 binary로 기록** — `docs/hackathon-2026/validation-2026-05-14.md`
3. **PASS / FAIL 슬랙 공지** — fallback 발동 여부 결정
4. **5/15 오전 작업 시작** — 트랙별 첫 PR 09:00까지
5. **5/15 21시 데모 리허설 1회** — 5분 시나리오 풀 런

---

## 관련 문서

- `docs/hackathon-2026/plan-1p.md` — 제출된 1p 기획서 (5/13)
- `docs/hackathon-2026/upstage-mapping.md` — Upstage 제품 ↔ 코드베이스 매핑
- `docs/hackathon-2026/fixed-dataset.md` — 본 회의에서 만들 라벨링 (예정)
- `docs/hackathon-2026/validation-2026-05-14.md` — 회의 직후 검증 결과 (예정)
- `docs/decks/hackathon-team-meeting/deck.pptx` — 본 아젠다의 PPT 버전
