# T5 측정 — Q6 오답 → LEAF-1 지목 binary

> 본 측정은 실제 /demo 한 바퀴 풀 런 후 기록. 빈칸은 측정 전.

## 풀 런 (1회차)

| 항목 | 결과 |
|---|---|
| 측정 시각 | — |
| 사용 모드 | upload / choice |
| ③ OCR source | live / sample / stub |
| ③ OCR 시간 (ms) |  |
| ④ Solar Pro 호출 수 | 후보 prereq 수 |
| ④ 병렬 max 시간 (ms) |  |
| ④ winner pattern | LEAF-1 / 기타 |
| ④ confidence | 0.00 ~ 1.00 |
| ④ justification chunk | C1 / C2 / null |
| 인용이 chunk substring 인가 | O / X |
| ② → ⑥ 총 시간 (s) |  |
| 30초 룰 통과 | O / X |

## 풀 런 (2회차) — 반복 안정성

| 항목 | 결과 |
|---|---|
| ④ winner pattern | LEAF-1 / 기타 |
| ④ confidence |  |

## 회귀 체크

- [ ] ② 그래프 6 Pattern + 8 Item 다 보임
- [ ] ③ 5지선다 모드에서도 ④ 진입 가능
- [ ] ④ BFS 경로 박스 두 개 + 화살표 표시
- [ ] ④ 인용 형광 marker 스타일 (yellow 진하게)
- [ ] ⑤ 교육과정 코드 박스 [9수03-02]
- [ ] ⑤ "이 결손의 영향 범위" 카드
- [ ] ⑥ Q6 정답 클릭 → /demo 리셋

## 알려진 위험

- sample 이미지 (`public/demo/q6-student-handwriting.png`) 미배치 시
  `source: "stub"` 로 자동 fallback. 데모 흐름은 작동.
- Document Parse 가 손글씨 quality 낮으면 Solar Pro 단계에서
  zod parse 실패 가능 → STUB_OCR_RESULT fallback.
- 프롬프트 팀의 EXAMPLES 없으면 system prompt 만으로 작동.
  품질은 떨어질 수 있으나 흐름은 작동.
