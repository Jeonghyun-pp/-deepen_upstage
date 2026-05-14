# 해커톤 D-2 팀 회의 아젠다

## 개요
- **목적**: 사내 보고 / 팀 회의 운영 자료 (5명 팀원 사전 정렬용)
- **청중**: Deepen 팀 5인 (연세대 산공 학부생)
- **내러티브**: D-2까지 검증·알고리즘·UX·RNR가 모두 미확정 (S) → LLM 교체 ≠ 알고리즘 교체, 그대로 빌드 들어가면 본행사에서 무너짐 (C) → 90~120분 회의에서 4개 결정을 픽스하고 4트랙으로 분배 (R)
- **슬라이드 수**: 8
- **언어**: ko
- **테마 프리셋**: `clean` — 정보 밀도 높은 의사결정 자료, 가독성 우선
- **폰트 임베드**: ON
- **출력**: deck.pptx (편집 가능한 네이티브 PPT)

## 리서치 요약

리서치 미수행 — 회의 아젠다 콘텐츠는 직전 대화에서 합의된 내용으로 충분.

## 디자인 방향
- **톤**: McKinsey-style 컨설팅 의사결정 슬라이드. 여백 적당, 표·셀 강조, 색상은 IBM blue로 핵심만.
- **디스플레이 폰트**: Pretendard 700 — 한국어 헤드라인 기본
- **본문 폰트**: Pretendard 400
- **색상 토큰**:
  - bg: `#FFFFFF` | text: `#0A0A0A` | text_muted: `#525252`
  - accent: `#0F62FE` (IBM blue, 결정·강조) | accent_alt: `#161616` (보조)
  - surface: `#F5F5F5` (카드·표 배경) | border: `#E5E5E5`
  - warning: `#DA1E28` (실패·리스크 표시용)
- **공간 시그니처**: 12컬럼 + 80px outer margin. 좌우 분할(60/40 또는 50/50) 친화. 모든 결정 슬라이드에 좌(맥락) 우(액션) 패턴.
- **블록 사용 경향**: 결정 슬롯마다 stat_grid(시간/owner/PASS기준) + table(결정 사항) + callout(리스크/가드)
- **차별화 요소**: 각 아젠다 슬라이드 좌측 상단에 "AGENDA N / NN 분" overline 배지 — 진행 상황 즉시 확인 가능

## 슬라이드 계획

### 슬라이드 1 — Cover (Situation)
- **슬라이드 ID**: `s1-cover`
- **레이아웃**: `title`
- **액션 타이틀**: "해커톤 D-2 회의 — 4개 결정을 오늘 픽스한다"
- **본문**: "2026-05-14 (목) · 90~120분 · 5/16 본행사까지 D-2"
- **블록 구성**:

  | # | type | id | x, y, w, h | role/내용 |
  |---|------|----|-----|----|
  | 1 | text | overline | 80, 100, 1760, 40 | overline / "DEEPEN × UPSTAGE HACKATHON · 팀 회의" |
  | 2 | shape | divider | 80, 160, 200, 6 | rect / accent fill |
  | 3 | text | title | 80, 200, 1760, 240 | title 96pt / "해커톤 D-2 회의\n4개 결정을 오늘 픽스한다" |
  | 4 | text | subtitle | 80, 500, 1760, 60 | subtitle 28pt muted / "2026-05-14 (목) · 90~120분 · 본행사까지 D-2" |
  | 5 | stat_grid | meta | 80, 640, 1760, 200 | 4-col / "📅 회의일 2026-05-14 / ⏱ 예상 시간 120분 / 👥 참여 5인 / 🎯 산출물 4개 결정 + RNR" |
  | 6 | text | footer | 80, 1020, 1760, 30 | source / "Deepen Team · D2SF v2 deck 후속" |

- **주요 콘텐츠**:
  - 팀: 박정현·남건우·남궁현종·문형서·한원석
  - 마감: 5/15(금) 23:59 발표 장표 + GitHub 레포 / 5/16(토) 본행사
  - 본 회의 목적: 빌드 들어가기 전 4개 결정 픽스

- **비고**: 타이틀은 strong 강조, 부제는 muted. Hero number 없음 (cover slide 면제).

### 슬라이드 2 — Why this meeting (Complication)
- **슬라이드 ID**: `s2-why`
- **레이아웃**: `content`
- **액션 타이틀**: "지금 결정하지 않으면 5/16 본행사에서 무너진다"
- **본문**: "1p 기획서는 제출됐다 (5/13). 그러나 검증·알고리즘·UX·RNR 모두 미확정이다. 이대로 빌드에 들어가면 5명이 다른 그림을 그린다."
- **블록 구성**:

  | # | type | id | x, y, w, h | role/내용 |
  |---|------|----|-----|----|
  | 1 | text | overline | 80, 100, 1760, 30 | overline / "왜 이 회의가 필요한가" |
  | 2 | text | title | 80, 150, 1760, 160 | title / "지금 결정하지 않으면\n5/16 본행사에서 무너진다" |
  | 3 | text | body | 80, 340, 1100, 120 | body / "1p 기획서는 제출됐다 (5/13). 그러나 검증·알고리즘·UX·RNR이 모두 미확정이다. 이대로 빌드에 들어가면 5명이 다른 그림을 그린다." |
  | 4 | stat_grid | timeline | 80, 500, 1100, 200 | 4-col / "5/13 ✅ 1p 제출 / 5/14 ❓ 회의 / 5/15 ❓ 빌드 / 5/16 ❓ 본행사" |
  | 5 | shape | guard_card | 1240, 340, 600, 460 | rect / surface fill / 핵심 가드라인 |
  | 6 | text | guard_title | 1280, 380, 520, 40 | h2 / "🛑 핵심 가드라인" |
  | 7 | text | guard_body | 1280, 440, 520, 340 | body / 가드 3개 |
  | 8 | shape | output_strip | 80, 760, 1760, 200 | rect / accent fill alpha / "회의 산출물 4개" |
  | 9 | stat_grid | outputs | 100, 800, 1720, 160 | 4-col / 산출물 4개 |
  | 10 | text | source | 80, 1030, 1760, 20 | source / "Source: 1p 기획서 (docs/hackathon-2026/plan-1p.md), upstage-mapping.md" |

- **주요 콘텐츠**:
  - 타임라인:
    - 5/13 (수) ✅ 1p 기획서 제출 완료
    - 5/14 (목) ❓ 오늘 — 검증 + 회의
    - 5/15 (금) ❓ 빌드 + 23:59 장표·레포 제출
    - 5/16 (토) ❓ 본행사 (15:30 피치 + 17:30 부스)
  - 핵심 가드라인 (Why card):
    1. **LLM 교체 ≠ 알고리즘 교체** — Document Parse·Information Extract는 출력 형태·작업 단위가 다르다
    2. **Upstage 마케팅 수치를 그대로 인용하지 않는다** — KIEval 78.32, TEDS 94.48은 자체 데이터셋. 우리가 직접 측정한 수치만 슬라이드에 박는다
    3. **데모 5분 = 평가의 절반** — 피어 투자가 평가 50%. 슬라이드보다 만져볼 수 있는 데모가 표를 모은다
  - 회의 산출물 4개:
    1. 고정 데이터셋 (Context 1 + 8 문제)
    2. 알고리즘 깊이 (Upstage 부품 vs 자체 코드)
    3. 부스 시연 5분 시나리오
    4. RNR + 일정

- **출처**: `docs/hackathon-2026/plan-1p.md`, `docs/hackathon-2026/upstage-mapping.md`

### 슬라이드 3 — 아젠다 1: 고정 데이터셋 (Resolution Part 1)
- **슬라이드 ID**: `s3-agenda-1-dataset`
- **레이아웃**: `content`
- **액션 타이틀**: "교육과정 문서 1개 + 평가원·교육청 8문제로 데이터를 고정한다"
- **본문**: "특정 문제/문서 단위로 성능을 측정하기로 합의. 저작권 클리어한 공공 출제물만 사용. prerequisite 체인이 명시된 단일 도메인으로 한정."
- **블록 구성**:

  | # | type | id | x, y, w, h | role/내용 |
  |---|------|----|-----|----|
  | 1 | text | overline | 80, 100, 800, 30 | overline / "AGENDA 1 / 15 MIN" |
  | 2 | shape | badge | 1640, 95, 200, 50 | rect / accent fill / "결정 2개" |
  | 3 | text | title | 80, 150, 1760, 160 | title / "교육과정 문서 1개 + 평가원·교육청 8문제로\n데이터를 고정한다" |
  | 4 | text | body | 80, 340, 1100, 100 | body / "특정 문제/문서 단위 측정으로 합의. 공공 출제물만 사용. prerequisite 체인이 명시된 단일 도메인으로 한정." |
  | 5 | shape | chain_card | 80, 460, 1100, 200 | rect / surface fill / prerequisite 체인 시각화 |
  | 6 | text | chain_label | 100, 480, 1060, 30 | label / "PREREQUISITE 체인" |
  | 7 | text | chain_text | 100, 520, 1060, 130 | h3 / "중3 판별식 → 고1 이차방정식 근 존재 → 고1 이차함수 그래프 → 고2 곡선 밖 접선" |
  | 8 | shape | context_card | 80, 700, 530, 260 | rect / border / "결정 ①: Context 문서" |
  | 9 | text | context_title | 100, 720, 490, 30 | label / "결정 ① · CONTEXT 문서" |
  | 10 | text | context_options | 100, 760, 490, 190 | body / 옵션 A/B/C |
  | 11 | shape | problems_card | 650, 700, 530, 260 | rect / border / "결정 ②: 8문제 출처" |
  | 12 | text | problems_title | 670, 720, 490, 30 | label / "결정 ② · 8문제 출처" |
  | 13 | text | problems_table | 670, 760, 490, 190 | body / 학년별 출처 |
  | 14 | shape | risk_callout | 1240, 460, 600, 500 | rect / accent_alt fill / "📌 라벨링 약속" |
  | 15 | text | risk_title | 1280, 490, 520, 40 | h2 white / "📌 라벨링 약속" |
  | 16 | text | risk_body | 1280, 550, 520, 380 | body white / 각 문제 라벨 |
  | 17 | text | source | 80, 1030, 1760, 20 | source / "출처: 평가원(kice.re.kr), EBSi, NCIC(ncic.re.kr) — 모두 공공저작물" |

- **주요 콘텐츠**:
  - Prerequisite 체인:
    ```
    중3 판별식 → 고1 이차방정식 근 존재 → 고1 이차함수 그래프 → 고2 곡선 밖 접선
    ```
  - 결정 ① Context 문서 (택1):
    - **A (추천)** 「2022 개정 수학과 교육과정」 (NCIC) 발췌 5-8p
    - B EBSi 무료 공개 강의 자료
    - C 평가원 출제의도/해설집 묶음
  - 결정 ② 8문제 출처:

    | # | 학년/시험 | 라벨 | 키워드 |
    |---|---|---|---|
    | Q1 | 중3 학업성취도/고1 3월 | LEAF-1 | 판별식 단독 |
    | Q2 | 고1 교육청 3·6·9월 | LEAF-2 | 이차함수 x축 교점 |
    | Q3 | 고1 교육청 11월 | MID-1 | 이차함수 + 직선 위치관계 |
    | Q4 | 고2 교육청/평가원 수1 | LEAF-3 | 미분계수 = 접선 기울기 |
    | Q5 | 평가원 6·9평 미적분 | MID-2 | 곡선 위 접선 |
    | Q6 | **평가원 수능·모평** | **TARGET** | **곡선 밖 접선 개수** |
    | Q7 | 평가원 미적분 고난도 | TARGET+ | 접선 + 모수 |
    | Q8 | 평가원 함수 극한 | NEGATIVE | distractor |
  - 라벨링 약속:
    - 정답
    - 필요한 prerequisite 노드 ID 셋
    - 학생이 막힐 만한 지점 (예: Q6 → "두 접선 위치 → 이차방정식 → 판별식"의 마지막에서 실패)
    - 1문제당 1~2줄, `docs/hackathon-2026/fixed-dataset.md`에 저장

- **출처**: 평가원(kice.re.kr), EBSi(ebsi.co.kr), NCIC(ncic.re.kr)

### 슬라이드 4 — 아젠다 2-a: 알고리즘 설계 (Resolution Part 2)
- **슬라이드 ID**: `s4-agenda-2a-algorithm`
- **레이아웃**: `content`
- **액션 타이틀**: "Upstage는 부품 — 차별점은 우리가 짜는 4개 알고리즘이다"
- **본문**: "Document Parse·Information Extract는 출력 형태와 작업 단위 자체가 다르다. 단순 endpoint 교체로는 절반도 못 간다. 4개 자체 알고리즘이 차별점."
- **블록 구성**:

  | # | type | id | x, y, w, h | role/내용 |
  |---|------|----|-----|----|
  | 1 | text | overline | 80, 100, 800, 30 | overline / "AGENDA 2-A / 30 MIN" |
  | 2 | shape | badge | 1640, 95, 200, 50 | rect / accent fill / "결정 3개" |
  | 3 | text | title | 80, 150, 1760, 160 | title / "Upstage는 부품 — 차별점은\n우리가 짜는 4개 알고리즘이다" |
  | 4 | text | body | 80, 340, 1760, 80 | body / "Document Parse·Information Extract는 출력 형태와 작업 단위 자체가 다르다. 단순 endpoint 교체로는 절반도 못 간다." |
  | 5 | shape | upstage_card | 80, 460, 850, 500 | rect / surface fill / "Upstage 부품" |
  | 6 | text | upstage_title | 100, 480, 810, 40 | label accent / "🧩 UPSTAGE가 들어갈 곳 (2개)" |
  | 7 | text | upstage_list | 100, 540, 810, 400 | body / 부품 2개 + 보조 |
  | 8 | shape | algo_card | 950, 460, 890, 500 | rect / accent fill / "자체 알고리즘 (차별점)" |
  | 9 | text | algo_title | 970, 480, 850, 40 | label white / "⚙️ 우리가 짜는 알고리즘 (차별점)" |
  | 10 | text | algo_list | 970, 540, 850, 400 | body white / 알고리즘 4개 |
  | 11 | shape | decisions_strip | 80, 980, 1760, 60 | rect / border / "오늘 결정해야 할 3가지" |
  | 12 | text | decisions | 100, 990, 1740, 40 | label / "결정: ① Upstage/자체 경계선 / ② T5 결손 역추적 의사코드 / ③ chunking·confidence 정책" |

- **주요 콘텐츠**:
  - 🧩 Upstage 부품 (확실한 카드 2개):
    - **Document Parse** → `lib/pipeline/parse-pdf.ts:98` (`unpdf` 대체)
      - TEDS 94.48 / 3.79s/page (Upstage 주장 — 우리가 D1으로 재측정)
      - 표·수식·도표 보존
    - **Information Extract** → `lib/pipeline/extract-nodes.ts:14` (`gpt-4o-mini` 대체)
      - 한국어 강의안 entity 추출
      - 단, **prerequisite 엣지 추출은 IE의 강점 아님**
    - 보조: Upstage Embedding (선택, 한국어 retrieval)
  - ⚙️ 자체 알고리즘 (4개):
    - **A1. Layout-aware chunker** — `<table>` 통째 1 chunk, 수식 블록 보존, heading 트리로 섹션 path 부여
    - **A2. 2-stage prerequisite 엣지 추출** — Stage 1: IE로 entity만, Stage 2: Solar Pro 2/3 structured CoT로 관계 + 인용
    - **A3. 결손 역추적 (T5, 데모 핵심)** — 학생 풀이 분석 → 그래프 BFS prereq 후보 → LLM scoring → top-K + 인용
    - **A4. Confidence 정책** — IE confidence + justification quote fuzzy match → ≥0.7 auto / 0.4~0.7 review / <0.4 drop
  - 결정 3개:
    - ① Upstage 부품 vs 자체 코드 경계선 (위 그림으로 확정)
    - ② T5 결손 역추적 의사코드 합의 (회의에서 화이트보드 1장)
    - ③ chunking 단위 + confidence threshold 숫자

- **출처**: `docs/hackathon-2026/upstage-mapping.md`, 직전 대화

### 슬라이드 5 — 아젠다 2-b: 검증 + Fallback (Resolution Part 3)
- **슬라이드 ID**: `s5-agenda-2b-validation`
- **레이아웃**: `content`
- **액션 타이틀**: "검증 PASS/FAIL 기준을 미리 정해야 fallback이 가능하다"
- **본문**: "이전 도메인 precision 60.5%/74.3%는 노이즈. 8문제 셋으로 binary PASS/FAIL 7개만 본다. 실패 시 plan B를 회의에서 미리 픽스."
- **블록 구성**:

  | # | type | id | x, y, w, h | role/내용 |
  |---|------|----|-----|----|
  | 1 | text | overline | 80, 100, 800, 30 | overline / "AGENDA 2-B / 20 MIN" |
  | 2 | shape | badge | 1640, 95, 200, 50 | rect / accent fill / "결정 2개" |
  | 3 | text | title | 80, 150, 1760, 160 | title / "검증 PASS/FAIL 기준을 미리 정해야\nfallback이 가능하다" |
  | 4 | text | body | 80, 340, 1760, 80 | body / "이전 도메인 precision 수치는 노이즈. 8문제 셋으로 binary PASS/FAIL 7개만 본다." |
  | 5 | table | test_table | 80, 460, 1160, 500 | table 7행 / 테스트 표 |
  | 6 | shape | fallback_card | 1280, 460, 560, 500 | rect / warning fill alpha / "Fallback 시나리오" |
  | 7 | text | fb_title | 1300, 490, 520, 40 | label warning / "🚨 FALLBACK 시나리오" |
  | 8 | text | fb_body | 1300, 550, 520, 380 | body / 실패 케이스 3개 |
  | 9 | text | source | 80, 1030, 1760, 20 | source / "D-1 오전 4시간 안에 T1~T5 측정. 결과는 docs/hackathon-2026/validation-2026-05-14.md" |

- **주요 콘텐츠**:
  - 검증 항목 (7개, binary):

    | # | 테스트 | Baseline | Upstage 또는 자체 | PASS 기준 |
    |---|---|---|---|---|
    | T1 | Context 파싱 | unpdf | Document Parse | 수식 LaTeX로 살아 있음 |
    | T2 | Entity 추출 | gpt-4o-mini | Information Extract | LEAF/MID/TARGET 노드 의미상 다 존재 |
    | T3 | Prerequisite 엣지 | gpt-4o-mini | A2 (자체) | 핵심 엣지 4개 중 3개+ |
    | T4 | Chunk-mapping | placeholder `[]` | Information Extract | Q6 → TARGET conf≥0.7 |
    | **T5** | **결손 역추적** | **(없음)** | **A3 (자체)** | **Q6 오답 → LEAF-1 지목** |
    | T6 | Distractor 거부 | (없음) | A3 | Q8 → LEAF-1 잘못 지목 안 함 |
    | T7 | 한국어 retrieval | OpenAI emb | Upstage emb | recall@5 +5%p (선택) |

  - 🚨 Fallback 시나리오 (회의에서 합의):
    - **T1 FAIL** → 해커톤 전략 전면 재검토 (가장 큰 한방 상실)
    - **T2 FAIL** → gpt-4o-mini 유지 + Solar Pro 2를 한국어 리캡 생성기로 강등
    - **T3 FAIL** → A2 알고리즘에서 Stage 2를 GPT-4o로 시도. 그래도 안 되면 Q6용 그래프 하드코딩
    - **T5 FAIL** → 데모 시나리오를 "결손 후보 top-3 제안"으로 약하게 (대신 학생이 선택)
  - 결정 2개:
    - ① 각 테스트 PASS 기준 (위 표 합의)
    - ② Fallback 시나리오 픽스 (특히 T1·T5 — 두 게이트)

- **출처**: validation 결과는 `docs/hackathon-2026/validation-2026-05-14.md`에 binary로 저장

### 슬라이드 6 — 아젠다 3: 부스 시연 5분 시나리오 (Resolution Part 4)
- **슬라이드 ID**: `s6-agenda-3-demo`
- **레이아웃**: `content`
- **액션 타이틀**: "심사위원이 보는 5분을 한 컷씩 픽스한다"
- **본문**: "피어 투자가 평가 50%. 슬라이드보다 만져볼 수 있는 데모가 표를 모은다. 화면별 owner와 인터랙션 단위를 미리 합의한다."
- **블록 구성**:

  | # | type | id | x, y, w, h | role/내용 |
  |---|------|----|-----|----|
  | 1 | text | overline | 80, 100, 800, 30 | overline / "AGENDA 3 / 20 MIN" |
  | 2 | shape | badge | 1640, 95, 200, 50 | rect / accent fill / "결정 1개" |
  | 3 | text | title | 80, 150, 1760, 160 | title / "심사위원이 보는 5분을\n한 컷씩 픽스한다" |
  | 4 | text | body | 80, 340, 1100, 80 | body / "피어 투자가 평가 50%. 슬라이드보다 만져볼 수 있는 데모가 표를 모은다." |
  | 5 | table | scenario_table | 80, 440, 1160, 520 | table 6행 / 5분 시나리오 |
  | 6 | shape | impact_card | 1280, 440, 560, 520 | rect / accent fill / "데모 임팩트 체크리스트" |
  | 7 | text | impact_title | 1300, 470, 520, 40 | label white / "🎯 5분 안에 보여야 할 것" |
  | 8 | text | impact_body | 1300, 530, 520, 410 | body white / 임팩트 5개 |
  | 9 | text | source | 80, 1030, 1760, 20 | source / "Source: 1p 기획서 「데모 시나리오 (5분)」 + Business Track OT 「만져볼 수 있는 데모」 가이드" |

- **주요 콘텐츠**:
  - 5분 시나리오 (6단계):

    | 시간 | 화면 | 입력/액션 | 시스템 응답 | Owner |
    |---|---|---|---|---|
    | 0:00~0:30 | 업로드 | Context PDF + 8문제 드래그앤드롭 | 분류 + 파싱 진행바 | Backend |
    | 0:30~1:30 | 그래프 화면 | (자동) | Concept-Pattern-Item 그래프 30초 내 렌더 | Frontend |
    | 1:30~2:30 | 문제 캔버스 (Q6) | 펜으로 풀이 (의도적 오답) | LaTeX 단계 자동 인식 | Frontend |
    | 2:30~3:30 | 진단 화면 | (자동) | "진짜 결손은 LEAF-1 (판별식)" + 인용 하이라이트 | 알고리즘 |
    | 3:30~4:30 | 리캡 카드 | 카드 클릭 | 2분 짜리 한국어 리캡 + Q1 (LEAF-1) 풀이 | 알고리즘 |
    | 4:30~5:00 | 복귀 | Q6 재시도 | 정답 + 그래프에서 LEAF-1·TARGET 둘 다 highlight | Frontend |

  - 🎯 데모 임팩트 체크리스트:
    1. **30초 룰**: 업로드 후 30초 안에 그래프가 나와야 한다 (대기 화면이 길면 부스에서 사람이 떠남)
    2. **인용 가시화**: "진짜 결손" 카드에 Context 문서 인용을 형광색으로 표시 (환각 아님을 증명)
    3. **그래프 인터랙션**: 다른 팀이 노드 클릭해서 prereq 따라가볼 수 있어야 한다
    4. **5분 후 재시작 버튼**: 부스에서 반복 시연 가능하도록
    5. **모바일 폴백 X**: 노트북 1대 + 큰 화면. 모바일 시연은 시도하지 않음
  - 결정 1개: 6단계 화면 흐름 + 화면별 owner 확정

- **출처**: `docs/hackathon-2026/plan-1p.md` 데모 시나리오, Business Track OT 가이드

### 슬라이드 7 — 아젠다 4: RNR + 일정 (Resolution Part 5)
- **슬라이드 ID**: `s7-agenda-4-rnr`
- **레이아웃**: `content`
- **액션 타이틀**: "4개 트랙으로 5명 × 남은 2일을 분배한다"
- **본문**: "D-1(5/15 금) 빌드 + 23:59 제출, D-day(5/16 토) 본행사. 트랙은 미리 그리고, 슬라이드 4 알고리즘 결정에 따라 인원을 옮긴다."
- **블록 구성**:

  | # | type | id | x, y, w, h | role/내용 |
  |---|------|----|-----|----|
  | 1 | text | overline | 80, 100, 800, 30 | overline / "AGENDA 4 / 20 MIN" |
  | 2 | shape | badge | 1640, 95, 200, 50 | rect / accent fill / "결정 2개" |
  | 3 | text | title | 80, 150, 1760, 160 | title / "4개 트랙으로 5명 × 남은 2일을\n분배한다" |
  | 4 | text | body | 80, 340, 1760, 80 | body / "D-1(금) 빌드 + 23:59 제출, D-day(토) 본행사. 트랙은 미리 그리고, 알고리즘 결정에 따라 인원을 옮긴다." |
  | 5 | table | track_table | 80, 440, 1160, 380 | table 4트랙 |
  | 6 | shape | timeline_card | 1280, 440, 560, 380 | rect / surface fill / "남은 일정" |
  | 7 | text | timeline_title | 1300, 470, 520, 40 | label / "📅 남은 일정" |
  | 8 | text | timeline_body | 1300, 530, 520, 270 | body / 일정 |
  | 9 | shape | deliverable_strip | 80, 860, 1760, 140 | rect / accent fill alpha / "제출물 owner" |
  | 10 | text | del_title | 100, 880, 1720, 30 | label accent / "📦 제출물 OWNER" |
  | 11 | text | del_body | 100, 920, 1720, 70 | body / 제출물 4개 |
  | 12 | text | source | 80, 1030, 1760, 20 | source / "마감: 5/15(금) 23:59 — 장표 PDF + GitHub 레포 / 5/16(토) 15:30 피치 7분 + 17:30 부스 데모" |

- **주요 콘텐츠**:
  - 4개 트랙:

    | 트랙 | 작업 | 인원 추정 | 의존성 |
    |---|---|---|---|
    | **A. Backend / Upstage** | Document Parse + IE wiring (T1·T2) | 1~2명 | API 키 확보 |
    | **B. 알고리즘 (차별점)** | A2 엣지 추출 + A3 결손 역추적 (T3·T5) | 1~2명 | A 트랙 출력 의존 |
    | **C. Frontend / 데모 UX** | 6단계 화면 polish + tldraw 캔버스 | 1명 | 시나리오 슬라이드 6 결정 |
    | **D. 발표/측정/제출** | 7분 피치 덱 + 측정 결과 슬라이드 + README + 1p PDF 최종 + GitHub 정리 | 1명 | 모든 트랙 결과 통합 |

  - 📅 남은 일정:
    - **5/14 (목) 오늘**: 회의 후 즉시 검증 4시간 (T1~T5) → 결과 보고
    - **5/15 (금)** 오전: 트랙별 빌드 / 오후: 통합 + 데모 리허설 / 23:59 장표·레포 제출
    - **5/16 (토)** 15:00 입장 / 15:30~17:30 피치 7분 / 17:30~18:30 부스 데모 (피어 투자) / 19:00 발표
  - 📦 제출물 owner (트랙 D):
    - 1p 기획서 PDF (이미 제출, 최종본 GitHub 업로드)
    - 발표 장표 PDF (7분 압축, ~10-12장)
    - GitHub README (서비스 개요·Upstage 제품·데모 접속법)
    - 데모 자료 (QR 코드, 데모 계정)
  - 결정 2개:
    - ① 5명 → 4트랙 배치 (트랙 D는 자동, 본인이 잡으면 측정 결과·메시지 일관성 유지)
    - ② 회의 직후 4시간 검증 시작 가능 여부

- **출처**: Business Track OT (배포용) — 마감 일정 / 자체 회의

### 슬라이드 8 — 회의 전 준비물 + 다음 단계 (Closing)
- **슬라이드 ID**: `s8-prep-and-next`
- **레이아웃**: `closing`
- **액션 타이틀**: "회의 전 5개 준비물 — 안 가져오면 회의가 굴러가지 않는다"
- **본문**: "오늘 회의는 빌드 가능 상태로 끝내는 게 목표. Owner가 사전 준비물을 못 가져오면 결정이 지연되고, D-2가 D-1.5가 된다."
- **블록 구성**:

  | # | type | id | x, y, w, h | role/내용 |
  |---|------|----|-----|----|
  | 1 | text | overline | 80, 100, 1760, 30 | overline / "CLOSING · 회의 전 / 회의 후" |
  | 2 | text | title | 80, 150, 1760, 160 | title / "회의 전 5개 준비물 —\n안 가져오면 회의가 굴러가지 않는다" |
  | 3 | text | body | 80, 340, 1760, 80 | body / "오늘 회의는 빌드 가능 상태로 끝내는 게 목표. Owner가 준비물을 못 가져오면 결정이 지연되고, D-2가 D-1.5가 된다." |
  | 4 | table | prep_table | 80, 440, 1160, 500 | table 5행 / 준비물 |
  | 5 | shape | next_card | 1280, 440, 560, 500 | rect / accent fill / "회의 직후 액션" |
  | 6 | text | next_title | 1300, 470, 520, 40 | label white / "🚀 회의 종료 직후" |
  | 7 | text | next_body | 1300, 530, 520, 400 | body white / 액션 5개 |
  | 8 | text | footer | 80, 1030, 1760, 30 | source / "Deepen × Upstage Hackathon · 2026-05-14 · 박정현·남건우·남궁현종·문형서·한원석" |

- **주요 콘텐츠**:
  - 준비물 5개:

    | # | 항목 | Owner | 산출물 |
    |---|---|---|---|
    | 1 | Context 문서 후보 PDF 3개 (NCIC/EBSi/평가원 해설) | 1명 | 다운로드해서 회의 노트북에 |
    | 2 | 8문제 후보 PDF 셋 (Q1~Q8) | 1명 | 평가원·교육청 사이트에서 발췌 |
    | 3 | 현재 코드 4파일 현황 짧은 설명 | 코드 잘 아는 사람 | `parse-pdf.ts` / `extract-nodes.ts` / `chunk-mapping.ts` / `upload/route.ts` 1분씩 |
    | 4 | Upstage API 키 (크레딧 redeem 끝낸 계정) | 1명 | `UPWAVE-YONSEI` 적용한 계정, $80 잔액 확인 |
    | 5 | `upstage-mapping.md` 사전 읽기 | 전원 | 회의 전 10분 |

  - 🚀 회의 종료 직후 액션:
    1. 4시간 검증 즉시 시작 (T1·T2·T3·T5)
    2. 결과를 `docs/hackathon-2026/validation-2026-05-14.md`에 binary 기록
    3. PASS/FAIL에 따라 fallback 발동 여부 슬랙 공지
    4. 5/15 오전 작업 시작 — 트랙별 첫 PR 9시까지
    5. 5/15 21시 데모 리허설 1회

- **출처**: 본 회의록 (작성 후 `docs/hackathon-2026/meeting-2026-05-14.md`에 commit)

## 밀도 검증

| 슬라이드 | 본문 | 블록 수 | 블록 type 종류 | 서포팅 섹션 | Hero number | 출처 |
|---|---|---|---|---|---|---|
| s1-cover | ✅ | 6 | text + shape + stat_grid | stat_grid | 면제 (cover) | ✅ |
| s2-why | ✅ | 10 | text + shape + stat_grid | guard_card + output_strip | timeline에 날짜 강조 | ✅ |
| s3-agenda-1 | ✅ | 17 | text + shape + chain visual | risk_callout | "8 문제" 강조 (badge) | ✅ |
| s4-agenda-2a | ✅ | 12 | text + shape | algo_card (accent fill) | "4 알고리즘" 강조 | ✅ |
| s5-agenda-2b | ✅ | 9 | text + shape + table | fallback_card | "7" PASS 카운트 | ✅ |
| s6-agenda-3 | ✅ | 9 | text + shape + table | impact_card | "30초 룰" 강조 | ✅ |
| s7-agenda-4 | ✅ | 12 | text + shape + table | timeline_card + deliverable_strip | "4 트랙" / "2일" 강조 | ✅ |
| s8-closing | ✅ | 8 | text + shape + table | next_card | "5 준비물" 강조 | ✅ |

모든 슬라이드 ≥4 블록, 2가지 이상 type 혼합 ✅
모든 블록 좌표가 1920×1080 안에 있음 ✅
액션 타이틀 모두 동사 포함 + 15단어 이내 ✅
출처가 슬라이드마다 명시 ✅

## 편집성 검증
빌드 후 PowerPoint에서:
- [ ] 액션 타이틀 텍스트 더블클릭 → 편집 가능
- [ ] 표 셀 클릭 → 편집 가능 (각 결정마다 표가 핵심)
- [ ] 좌측 결정 표 / 우측 콜아웃 카드 분리됨 (그룹 미사용)
- [ ] accent 색상 일괄 변경 시 모든 badge/strip 같이 바뀜
- [ ] s3·s4의 prerequisite 체인 텍스트 — 단일 textbox로 편집 가능

## 스토리라인 테스트

1. 해커톤 D-2 회의 — 4개 결정을 오늘 픽스한다
2. 지금 결정하지 않으면 5/16 본행사에서 무너진다
3. 교육과정 문서 1개 + 평가원·교육청 8문제로 데이터를 고정한다
4. Upstage는 부품 — 차별점은 우리가 짜는 4개 알고리즘이다
5. 검증 PASS/FAIL 기준을 미리 정해야 fallback이 가능하다
6. 심사위원이 보는 5분을 한 컷씩 픽스한다
7. 4개 트랙으로 5명 × 남은 2일을 분배한다
8. 회의 전 5개 준비물 — 안 가져오면 회의가 굴러가지 않는다

**SCR 흐름**:
- S (1-2): 회의 목적 + 현재 상황의 위험
- C (2): 검증·알고리즘·UX·RNR 모두 미확정
- R (3-7): 4개 결정 + RNR 분배
- Closing (8): 준비물 + 직후 액션

스토리라인 일관성 ✅ — 각 슬라이드가 다음 슬라이드의 전제를 만든다 (데이터 → 알고리즘 → 검증 → UX → RNR).
