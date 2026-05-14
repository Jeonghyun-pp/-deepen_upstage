# Upstage API 수능 수학 PDF 추출 실험

수능 수학(미적분) 문제지 PDF에서 문항 본문과 수식을 구조화된 JSON으로 추출하는 파이프라인을 찾기 위한 일련의 실험.  
대상 파일: `2026_수능수학_미적분_3pages.pdf` (1~3페이지, 약 9문항)

---

## 실험 일람

### Exp 0 — Document Parse 기본 테스트
**스크립트:** `parse_pdf.py`  
**출력:** `out/`

Upstage Document Parse API(`/v1/document-digitization`)에 PDF를 직접 전송하는 베이스라인.  
`ocr=auto`, `model=document-parse`, HTML/Markdown/Text 3가지 포맷 동시 요청.

**결과:** 수식 영역이 PUA 문자(U+E000~U+F8FF) 또는 깨진 글자로 출력됨. LaTeX 변환 없음.

---

### Exp 1 — Document Parse 파라미터 스윕
**스크립트:** `sweep_params.py`  
**출력:** `sweep_out/`

`ocr` × `mode` 6가지 조합(ocr: auto/force, mode: standard/enhanced/auto)을 전수 탐색.  
평가 기준: 문제 1번 수식 `9^(1/4) × 3^(-1/2)` 내 `9`, `3`, `1/4`, `1/2`, 수학 연산자 포함 여부.

**결과 요약:**

| tag | 9 | 3 | 1/4 | 1/2 | math_op | pua | len | sec |
|---|---|---|---|---|---|---|---|---|
| ocr-auto_mode-standard | ✗ | ✓ | ✗ | ✗ | ✗ | 53 | 153 | 5.3 |
| ocr-auto_mode-enhanced | ✓ | ✓ | ✗ | ✗ | ✗ | 0 | 119 | 6.9 |
| ocr-auto_mode-auto | ✓ | ✓ | ✗ | ✗ | ✗ | 0 | 119 | 7.3 |
| ocr-force_mode-standard | ✓ | ✓ | ✗ | ✗ | ✗ | 0 | 119 | 2.7 |
| ocr-force_mode-enhanced | ✓ | ✓ | ✗ | ✗ | ✗ | 0 | 119 | 4.5 |
| ocr-force_mode-auto | ✓ | ✓ | ✗ | ✗ | ✗ | 0 | 119 | 5.2 |

**결론:** 6가지 조합 모두 분수·지수 인식 실패. Document Parse는 수학 수식 추출에 근본적으로 부적합.

---

### Exp 2 — Information Extraction + 비전 (Option A v1)
**스크립트:** `option_a_ie.py`  
**출력:** `option_a_out/`

Document Parse 포기. 대신 PDF를 PyMuPDF로 페이지별 PNG(DPI 300)로 렌더링 후  
Upstage IE API(`/v1/information-extraction`)에 비전 모델로 전송.  
JSON Schema로 `number`, `points`, `problem_type`, `question`(LaTeX), `choices` 출력 강제.

**결과:** 수식이 LaTeX로 인식되기 시작하나 지수·분수 표기 정확도 불안정.

---

### Exp 3 — IE + DPI 600 + 강화 프롬프트 (Option A v2/v3)
**스크립트:** `option_a_v2.py`  
**출력:** `option_a_v3_out/`

두 가지 개선 동시 적용:
1. **DPI 300 → 600**: 인라인 수식이 비전 토큰 내 더 큰 픽셀 영역 차지
2. **LaTeX 지시 강화**: `$9^{\frac{1}{4}}$`, `$\sum_{k=1}^{n}$`, `$\int_{a}^{b}$`, `\begin{cases}` 등 구체적 예시 포함  

Rate limit(HTTP 429) 대응 exponential backoff 추가.

---

### Exp 4 — 컬럼 분할 후 IE (Option A v4)
**스크립트:** `option_a_v4_crop.py`  
**출력:** `option_a_v4_out/`

수능 문제지가 2단(좌/우 컬럼) 레이아웃이라는 점 활용.  
각 페이지를 L/R 두 컬럼으로 분할(100px overlap) 후 각각 IE 호출.  
같은 문항이 L·R 양쪽에서 추출되면 `question` 문자열이 더 긴 버전을 채택 (컬럼 경계 잘림 대응).

**기대 효과:** 동일 DPI에서 수식이 비전 토큰 대비 ~2배 큰 영역 차지 → 인식 정확도 향상.  
`variants.json`에 L/R 원본 응답 모두 보존.

---

### 보조 — 문제 1번 crop 시각 확인
**스크립트:** `crop_problem_1.py`  
**출력:** `problem_1_crop.png`

v4·v5의 crop box 좌표를 결정하기 위한 시각 확인용 유틸리티.  
page_1.png의 상단 좌측 25% 영역(헤더 제외)을 잘라 저장.

---

### Exp 5 — 문제 단위 초밀착 crop ablation (Option A v5)
**스크립트:** `option_a_v5_tight.py`  
**출력:** `option_a_v5_out/`

"인라인 수식의 **상대적 크기**가 핵심 bottleneck인가?"를 검증하는 ablation.  
v4 page_1.png에서 문제 1번 영역만 (`x: 2%~55%`, `y: 16%~28%`) ultra-tight crop 후 IE 호출.  
이 crop이 올바로 인식되면 문제별 tight crop을 production 전략으로 채택.

---

## 디렉터리 구조

```
experiments/upstage/
├── parse_pdf.py             # Exp 0: Document Parse 기본
├── sweep_params.py          # Exp 1: 파라미터 스윕
├── option_a_ie.py           # Exp 2: IE + DPI 300
├── option_a_v2.py           # Exp 3: IE + DPI 600 + 강화 프롬프트
├── option_a_v4_crop.py      # Exp 4: 컬럼 분할
├── crop_problem_1.py        # 보조: crop 좌표 확인
├── option_a_v5_tight.py     # Exp 5: 문제 단위 tight crop ablation
│
├── out/                     # Exp 0 결과
├── sweep_out/               # Exp 1 결과 (6 subdirs + summary.json)
├── option_a_out/            # Exp 2 결과
├── option_a_v2_out/         # (중간 실험 결과)
├── option_a_v3_out/         # Exp 3 결과
├── option_a_v4_out/         # Exp 4 결과 (L/R 컬럼 이미지·JSON 포함)
├── option_a_v5_out/         # Exp 5 결과
└── problem_1_crop.png       # 보조 시각 확인 이미지
```

## 핵심 교훈

- **Document Parse는 수식 불가**: 모든 파라미터 조합에서 LaTeX 미출력
- **IE + 비전이 유일한 실용 경로**: 수식을 LaTeX로 강제 추출 가능
- **DPI와 crop 크기가 정확도를 결정**: 수식이 비전 토큰 내 차지하는 면적이 클수록 정확
- **2단 레이아웃 대응 필수**: 페이지 전체를 그대로 보내면 컬럼 분리 실패 위험
