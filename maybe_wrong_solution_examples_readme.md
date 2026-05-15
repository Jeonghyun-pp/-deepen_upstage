deepen_solar_wrong_solution_examples_refined.json

{
  dataset_meta: 데이터셋 설명, 추천 투입 순서
  error_type_dictionary: 오류 유형 답안지
  problem_type_dictionary: 문제 유형 설명
  examples: 실제 오류 예시 6개
  solar_prompt_pack: Solar에 넣을 때 쓸 입력 템플릿
}

이 파일은 Solar LLM에 넣을 학생 오답 진단용 few-shot 데이터셋입니다.
JSON 파일에는 오류 유형 사전, 문제 유형 사전, 예시 6개, 각 예시의 expected_diagnosis가 들어 있습니다.
expected_diagnosis는 정답지 역할입니다.
JSONL 파일은 같은 예시를 한 줄에 하나씩 정리한 버전이라 배치 테스트용으로 쓰면 됩니다.

E01_product_rule_simple
- 문제 유형: 곱의 미분법
- 오류 유형: product_rule_missing_term
- 핵심 오류: (xf(x))'에서 f(x) 항 누락

E04_tangent_slope_confusion
- 문제 유형: 접선의 방정식
- 오류 유형: tangent_slope_confusion
- 핵심 오류: f(3)을 접선 기울기로 착각

E05_position_velocity_confusion
- 문제 유형: 위치·속도·가속도
- 오류 유형: position_velocity_confusion
- 핵심 오류: 위치를 물었는데 v(1)을 계산

E03_distance_displacement_confusion
- 문제 유형: 속도 함수와 움직인 거리
- 오류 유형: distance_displacement_confusion
- 핵심 오류: 움직인 거리를 ∫v(t)dt로 계산

E06_case_split_missing
- 문제 유형: 극한 존재 조건과 매개변수
- 오류 유형: case_split_missing
- 핵심 오류: k=6 특수 케이스 누락

E02_product_rule_complex_propagation
- 문제 유형: 곱의 미분법·접선·넓이 복합형
- 오류 유형: product_rule_missing_term
- 핵심 오류: g'(x)에서 곱의 미분법 한 항 누락 후 접선/넓이까지 전파