"""
_curated_pool.json + mapping/concepts → data/demo/{items,patterns,edges,chunks,recap-cards}.json

자동 처리
  items.json     : 19문제 본문에서 5지선다·정답·점수·해설 추출 + UUID 생성
  patterns.json  : 결손 후보 5개 hard-include + 학습 노드 9개 + force-directed 자동 레이아웃
  edges.json     : concepts.json 선행개념에서 14노드간 prereq 관계 추출
  chunks.json    : 결손 후보 5개 + 핵심 학습 노드 5개에 대해 짧은 NCIC 정의 chunk
  recap-cards.json: 4 페르소나 × 메인 카드 1장 + Q6 호환 fallback 1장

이 스크립트가 끝나면 data/demo/*.json 5종이 새 데이터로 교체됨.
seed-demo.ts 재실행 시 DB도 새 데이터로 채워짐.
"""

import json
import re
import sys
import io
import math
import uuid
import hashlib
from pathlib import Path
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "source"
DEMO = ROOT / "data" / "demo"


def stable_uuid(seed: str) -> str:
    """seed string → 결정론적 UUID v4 (테스트·재실행 안정)."""
    h = hashlib.sha256(seed.encode("utf-8")).hexdigest()
    return f"{h[:8]}-{h[8:12]}-4{h[13:16]}-8{h[17:20]}-{h[20:32]}"


with open(SRC / "_curated_pool.json", encoding="utf-8") as f:
    pool = json.load(f)
with open(SRC / "problem-mapping.json", encoding="utf-8-sig") as f:
    mapping = json.load(f)
with open(SRC / "concepts.json", encoding="utf-8-sig") as f:
    concepts_data = json.load(f)

problems_by_id = {p["id"]: p for p in mapping["문제목록"]}
concept_by_id = {c["id"]: c for c in concepts_data["concepts"]}


# ── 1) patterns.json: 결손 후보 5개 hard-include + 학습 노드 9개 ──────
DEFICIT_NODES = [
    "h1-이차방정식-이차함수",
    "h1-복소수-이차방정식",
    "c1-미분계수",
    "c1-도함수",
    "h1-인수분해",
]

# usage Top 9 학습 노드 (결손 노드 제외)
learning_nodes_ranked = [
    n["id"] for n in pool["graph_nodes_top"] if n["id"] not in DEFICIT_NODES
][:9]

graph_node_ids = DEFICIT_NODES + learning_nodes_ranked
print(f"graph nodes: {len(graph_node_ids)}")

# 자동 레이아웃 — concentric circles by 학년/과목 깊이
def grade_layer(grade: str) -> int:
    if "공통" in (grade or ""):
        return 0
    if "일반선택" in (grade or ""):
        return 1
    if "진로선택" in (grade or ""):
        return 2
    return -1


layer_groups = defaultdict(list)
for nid in graph_node_ids:
    g = concept_by_id.get(nid, {}).get("학년", "")
    layer_groups[grade_layer(g)].append(nid)

# 각 layer를 동심원에 배치
CENTER = (500, 400)
RADII = {-1: 100, 0: 250, 1: 400, 2: 550}
positions = {}
for layer, ids in layer_groups.items():
    r = RADII.get(layer, 100)
    n = len(ids)
    for i, nid in enumerate(ids):
        angle = (2 * math.pi * i / max(n, 1)) - math.pi / 2
        x = CENTER[0] + r * math.cos(angle)
        y = CENTER[1] + r * math.sin(angle)
        positions[nid] = {"x": round(x, 1), "y": round(y, 1)}


def short_tldr(node_id: str, name: str) -> str:
    """노드별 한 줄 요약 — 결손 진단 카드에 사용."""
    tldr_map = {
        "h1-이차방정식-이차함수": "이차방정식과 이차함수의 관계·위치관계",
        "h1-복소수-이차방정식": "판별식 D = b² - 4ac · 근과 계수",
        "c1-미분계수": "f'(a) = lim h→0 [f(a+h)-f(a)]/h",
        "c1-도함수": "다항함수 미분 — (xⁿ)' = nx^(n-1)",
        "h1-인수분해": "고등 인수분해 (삼차·치환·인수정리)",
    }
    return tldr_map.get(node_id, name)


def stable_key_for_node(node_id: str) -> str:
    return node_id.upper()


patterns_out = []
for nid in graph_node_ids:
    c = concept_by_id[nid]
    is_deficit = nid in DEFICIT_NODES
    patterns_out.append(
        {
            "stableKey": stable_key_for_node(nid),
            "uuid": stable_uuid(f"pattern::{nid}"),
            "displayLayer": "concept" if is_deficit else "pattern",
            "label": c["이름"],
            "content": f"{c['이름']} — {c['영역']} ({c['학년']})",
            "tldr": short_tldr(nid, c["이름"]),
            "grade": c["학년"],
            "signature": [c["이름"]],
            "isKiller": False,
            "isFallback": nid == "h1-복소수-이차방정식",
            "whiteboardPos": positions[nid],
        }
    )

(DEMO / "patterns.json").write_text(
    json.dumps(patterns_out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"✓ patterns.json — {len(patterns_out)} nodes")


# ── 2) edges.json: 14노드간 prereq 관계 추출 ────────────────────────
node_id_set = set(graph_node_ids)
edges_out = []
for nid in graph_node_ids:
    c = concept_by_id[nid]
    for prereq_id in c.get("선행개념", []):
        if prereq_id in node_id_set:
            edges_out.append(
                {
                    "from": stable_key_for_node(prereq_id),
                    "to": stable_key_for_node(nid),
                    "weight": 0.9,
                }
            )

# concepts.json 의 직접 선행개념만으로는 일부 그래프 노드가 고립될 수 있음.
# 결손 후보 ↔ 학습 노드 간에 약한 연결 추가 (drama 시연용)
# 예: h1-복소수-이차방정식 → h1-이차방정식-이차함수
extra_edges = [
    ("h1-복소수-이차방정식", "h1-이차방정식-이차함수", 0.85),
    ("h1-인수분해", "h1-복소수-이차방정식", 0.7),
    ("h1-인수분해", "h1-이차방정식-이차함수", 0.7),
    ("c1-미분계수", "c1-도함수", 0.95),
]
existing = {(e["from"], e["to"]) for e in edges_out}
for f, t, w in extra_edges:
    if f in node_id_set and t in node_id_set:
        key = (stable_key_for_node(f), stable_key_for_node(t))
        if key not in existing:
            edges_out.append({"from": key[0], "to": key[1], "weight": w})

(DEMO / "edges.json").write_text(
    json.dumps({"prerequisite": edges_out}, ensure_ascii=False, indent=2),
    encoding="utf-8",
)
print(f"✓ edges.json — {len(edges_out)} prereq edges")


# ── 3) items.json: 19문제 본문에서 추출 ───────────────────────────────
CHOICE_RE = re.compile(r"([①②③④⑤])\s*([^①②③④⑤\n]+)")
POINT_RE = re.compile(r"\[(\d)점\]")
ANSWER_RE = re.compile(r"정답\s*([①②③④⑤\d]+)")
INT_ANSWER_RE = re.compile(r"^\s*(-?\d+)\s*$")
CHOICE_NUM_MAP = {"①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5"}


def parse_problem_body(text: str):
    """[문제] ... [N점]\n① ... ② ... 본문에서 본문/보기 분리."""
    body = text.replace("[문제]", "").strip()
    point_m = POINT_RE.search(body)
    points = int(point_m.group(1)) if point_m else 3
    choices = [m.group(2).strip() for m in CHOICE_RE.finditer(body)]
    first_choice = re.search(r"[①②③④⑤]", body)
    main = body[: first_choice.start()].strip() if first_choice else body.strip()
    main = POINT_RE.sub("", main).strip()
    return main, choices, points


def parse_answer(solution: str):
    m = ANSWER_RE.search(solution)
    if not m:
        return None
    return m.group(1).strip()


def synthesize_choices(answer_raw: str, seq_idx: int):
    """
    단답형 정답 → 5지선다 자동 변환.
    정답이 정수면 ±1~3 가짜 4개 + 정답 → 정렬 → 정답 위치 인덱스 반환.

    답이 정수가 아니면 [정답, "?", "?", "?", "?"] fallback (단답형 외).
    """
    int_m = INT_ANSWER_RE.match(answer_raw)
    if not int_m:
        return [answer_raw, "?", "?", "?", "?"], 1
    ans = int(int_m.group(1))
    # 정답 ± 1~3 후보 — 정답과 다르고 음수 정수 후보도 OK
    base_offsets = [-3, -2, -1, 1, 2, 3]
    picks = []
    for off in base_offsets:
        if len(picks) >= 4:
            break
        picks.append(ans + off)
    candidates = sorted({ans, *picks})[:5]
    if ans not in candidates:
        candidates = sorted({ans, *picks[:4]})
    # 정답 위치를 시퀀스마다 다르게 (변동성)
    target_idx = (seq_idx % 5)
    sorted_cands = sorted(candidates)
    # 정답을 target_idx 위치로 이동
    sorted_cands.remove(ans)
    sorted_cands.insert(target_idx, ans)
    return [str(c) for c in sorted_cands], target_idx + 1


def derive_choices_and_answer(problem, seq_idx: int):
    """문제 본문 파싱 + 단답형이면 자동 5지선다 변환."""
    main, choices, points = parse_problem_body(problem["문제"])
    raw_answer = parse_answer(problem["해설"]) or ""

    if len(choices) >= 4:
        # 객관식 — 정답 인덱스 그대로
        if raw_answer in CHOICE_NUM_MAP:
            ans_idx = CHOICE_NUM_MAP[raw_answer]
        elif raw_answer.isdigit() and 1 <= int(raw_answer) <= 5:
            ans_idx = raw_answer
        else:
            ans_idx = "1"
        return main, choices, ans_idx, points, False

    # 단답형 — 자동 5지선다 변환
    synthesized, ans_idx_int = synthesize_choices(raw_answer, seq_idx)
    return main, synthesized, str(ans_idx_int), points, True


# 페르소나별 시퀀스 → 문제별 어떤 페르소나에 어떤 순서로 들어가는지
problem_to_personas = defaultdict(list)
for pkey, persona in pool["personas"].items():
    for idx, pid in enumerate(persona["picked_ids"]):
        problem_to_personas[pid].append({"persona": pkey, "order": idx + 1})

# 페르소나 → 결손 노드 매핑 (item.patternKey 결정용)
PERSONA_TO_DEFICIT = {
    "A": "h1-복소수-이차방정식",  # 판별식 위주
    "B": "c1-미분계수",
    "C": "h1-인수분해",
    "D": "c1-도함수",
}

# ── distractor 수작업 라벨링 ──────────────────────────────────────
# 6개 정상 객관식만. 각 오답 보기 (1~5, 정답 제외) → 추정 결손 nodeKey[] 매핑.
# 그래프 14노드 안에 있는 patternKey 만 사용 (없으면 aggregate 가 무시).
MANUAL_DISTRACTORS: dict[str, dict[str, list[str]]] = {
    # Q1 — 운동/속도/가속도 <보기> 정답 ⑤(ㄴ,ㄷ)
    "2026-6모-공통-11": {
        "1": ["C1-도함수"],         # ㄱ만 → 위치 계산 + 미분 둘 다 혼동
        "2": ["C1-도함수활용"],     # ㄴ만 → 2계 미분(가속도) 결손
        "3": ["C1-미분계수"],       # ㄷ만 → 속도(미분계수) 결손
        "4": ["H1-다항식연산"],     # ㄱ,ㄷ → 위치 대입 실수
    },
    # Q3 — 미분계수 정의 lim h→0, 정답 ①(1)
    "2026-6모-공통-2": {
        "2": ["C1-도함수"],         # f'(x)=2x 만 적용 (-1 빠뜨림)
        "3": ["C1-도함수"],         # 미분 규칙 실수
        "4": ["C1-미분계수"],       # 정의 자체 혼동
        "5": ["C1-미분계수"],       # 정의 자체 혼동
    },
    # Q4 — 정적분 (기함수·우함수), 정답 ②(a=2)
    "2026-6모-공통-9": {
        "1": ["H1-다항식연산"],     # 18a=36 풀이 실수
        "3": ["C1-도함수"],         # 기함수 인식 실패
        "4": ["C1-도함수"],         # 적분 범위 실수
        "5": ["C1-도함수"],         # 계수 처리 실수
    },
    # Q5 — 포물선 접선, 정답 ④(a=4)
    "2026-6모-기하-24": {
        "1": ["C1-미분계수"],       # 접선 기울기 계산 오류
        "2": ["H1-다항식연산"],     # 점 좌표 대입 실수
        "3": ["C1-미분계수"],       # 미분 실수
        "5": ["H1-인수분해"],       # 부호 처리 실수
    },
    # Q6 — 역함수 미분, 정답 ②(12)
    "2026-6모-미적분-26": {
        "1": ["H1-인수분해"],       # e^b 인수분해 결손
        "3": ["C1-미분계수"],       # 부호 실수
        "4": ["C2-여러미분법"],     # 합성함수 미분 결손
        "5": ["C1-미분계수"],       # 계산 실수
    },
    # Q7 — 합성함수 미분·이계도, 정답 ①(-3e^(-4/3))
    "2026-6모-미적분-28": {
        "2": ["C2-여러미분법"],     # α 값 잘못 (합성 미분 실수)
        "3": ["H1-인수분해"],       # 부호 실수
        "4": ["C2-여러미분법"],     # 합성함수 미분 결손
        "5": ["C1-도함수활용"],     # 이계도함수 활용 결손
    },
}


items_out = []
seq_counter = 0
synthesized_count = 0
for pid in pool["pool_problem_ids"]:
    seq_counter += 1
    p = problems_by_id[pid]
    main, choices, answer, points, was_synth = derive_choices_and_answer(p, seq_counter)
    if was_synth:
        synthesized_count += 1

    personas = problem_to_personas.get(pid, [])
    if personas:
        pkey = personas[0]["persona"]
        deficit_node = PERSONA_TO_DEFICIT[pkey]
    else:
        deficit_node = p["최종_id"][0] if p["최종_id"] else "h1-인수분해"

    if deficit_node not in node_id_set:
        deficit_node = next(
            (fid for fid in p["최종_id"] if fid in node_id_set),
            "h1-인수분해",
        )

    # distractor 메타 — 정상 객관식 6개만 (수작업 라벨링).
    # 자동변환 단답형은 보기 의미 약해서 메타 X (그래프 전파만으로 진단).
    distractor_meanings: dict[str, list[str]] | None = None
    if not was_synth and pid in MANUAL_DISTRACTORS:
        distractor_meanings = MANUAL_DISTRACTORS[pid]

    item_record = {
        "stableKey": f"Q{seq_counter}",
        "uuid": stable_uuid(f"item::{pid}"),
        "label": f"Q{seq_counter}. {p['시험']} {p['단원']} {p['번호']}번",
        "content": main,
        "grade": "고등",
        "itemSource": pid,
        "itemChoices": choices,
        "itemAnswer": answer,
        "itemSolution": p["해설"][:1000],
        "itemDifficulty": (points - 1) / 4,
        "patternKey": stable_key_for_node(deficit_node),
        "metaLabel": f"P{seq_counter}",
        "personaMappings": personas,
        "examPoints": points,
        "wasSynthesizedChoices": was_synth,
    }
    if distractor_meanings:
        item_record["distractorMeanings"] = distractor_meanings
    items_out.append(item_record)

# isTarget 부여 — 4 페르소나 각 시퀀스 첫 문제(order=1) 모두 anchor.
# getTargetItem() 은 첫 anchor (= 페르소나 A 1번) 를 반환.
persona_first_ids = {
    pkey: persona["picked_ids"][0]
    for pkey, persona in pool["personas"].items()
}
for it in items_out:
    if it["itemSource"] in persona_first_ids.values():
        it["isTarget"] = True

(DEMO / "items.json").write_text(
    json.dumps(items_out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"✓ items.json — {len(items_out)} problems (단답형 자동변환 {synthesized_count}개)")


# ── 4) chunks.json: 결손 후보 5개 + 핵심 학습 노드 5개 짧은 NCIC 정의 ──
CHUNK_SOURCES = [
    {
        "node": "h1-복소수-이차방정식",
        "section": "고등(공통) · 복소수와 이차방정식",
        "content": "이차방정식 ax²+bx+c=0의 판별식 D=b²-4ac의 부호로 근의 개수를 판별한다. D>0이면 서로 다른 두 실근, D=0이면 중근, D<0이면 서로 다른 두 허근을 갖는다. [10공수1-02-04]",
    },
    {
        "node": "h1-이차방정식-이차함수",
        "section": "고등(공통) · 이차방정식과 이차함수",
        "content": "이차함수의 그래프와 직선의 위치 관계는 두 식을 연립하여 얻은 이차방정식의 판별식의 부호로 판단한다. 두 점에서 만나면 D>0, 접하면 D=0, 만나지 않으면 D<0이다. [10공수1-02-05]",
    },
    {
        "node": "c1-미분계수",
        "section": "고등(일반선택) · 미적분Ⅰ — 미분계수",
        "content": "함수 f(x)의 x=a에서의 미분계수는 f'(a) = lim_{h→0} [f(a+h)-f(a)]/h 로 정의되며, 이는 곡선 y=f(x) 위의 점 (a, f(a))에서의 접선의 기울기와 같다. [12미적Ⅰ-02-01]",
    },
    {
        "node": "c1-도함수",
        "section": "고등(일반선택) · 미적분Ⅰ — 다항함수의 도함수",
        "content": "다항함수 f(x) = xⁿ (n은 자연수)의 도함수는 f'(x) = nx^(n-1) 이다. 일반적으로 다항함수의 도함수는 각 항을 같은 규칙으로 미분하여 더해서 구한다. [12미적Ⅰ-02-04]",
    },
    {
        "node": "h1-인수분해",
        "section": "고등(공통) · 인수분해",
        "content": "고등 인수분해는 삼차식 a³±b³ = (a±b)(a²∓ab+b²), 완전제곱식, 치환, 인수정리(다항식 P(x)에 대하여 P(a)=0이면 (x-a)는 인수)를 활용한다. [10공수1-01-04]",
    },
    {
        "node": "c1-도함수활용",
        "section": "고등(일반선택) · 미적분Ⅰ — 도함수의 활용",
        "content": "도함수 f'(x)를 이용하여 접선의 방정식·증감·극값·그래프 개형·속도·가속도 등을 분석한다. f'(x)=0의 실근에서 극값 후보가 나오며, 부호 변화로 극대/극소를 판정한다. [12미적Ⅰ-02-06]",
    },
    {
        "node": "c1-함수극한",
        "section": "고등(일반선택) · 미적분Ⅰ — 함수의 극한",
        "content": "함수의 극한은 lim_{x→a} f(x) = L 로 표기하며, 좌극한과 우극한이 같을 때 극한이 존재한다. [12미적Ⅰ-01-01]",
    },
    {
        "node": "c1-함수연속",
        "section": "고등(일반선택) · 미적분Ⅰ — 함수의 연속",
        "content": "함수 f(x)가 x=a에서 연속이려면 lim_{x→a} f(x) = f(a)가 성립해야 한다. 다항함수는 모든 실수에서 연속이다. [12미적Ⅰ-01-04]",
    },
    {
        "node": "h1-다항식연산",
        "section": "고등(공통) · 다항식의 연산",
        "content": "다항식의 덧셈·뺄셈·곱셈·나눗셈을 수행한다. 곱셈공식 (a+b)³ = a³+3a²b+3ab²+b³, (a+b+c)² = a²+b²+c²+2ab+2bc+2ca 등이 자주 사용된다. [10공수1-01-02]",
    },
    {
        "node": "c2-여러미분법",
        "section": "고등(진로선택) · 미적분Ⅱ — 여러 가지 미분법",
        "content": "지수·로그·삼각함수의 미분, 몫의 미분, 합성함수의 미분(연쇄법칙), 매개변수·음함수·역함수의 미분을 다룬다. (gof)'(x) = g'(f(x))·f'(x). [12미적Ⅱ-02-05]",
    },
]

chunks_out = []
for i, src in enumerate(CHUNK_SOURCES, start=1):
    nid = src["node"]
    if nid not in node_id_set:
        continue  # 그래프 노드에 없으면 skip
    chunks_out.append(
        {
            "stableKey": f"NCIC-{i}",
            "uuid": stable_uuid(f"chunk::{nid}"),
            "ordinal": i,
            "sectionTitle": src["section"],
            "content": src["content"],
            "patternMappings": [
                {"patternKey": stable_key_for_node(nid), "confidence": 0.95},
            ],
        }
    )

(DEMO / "chunks.json").write_text(
    json.dumps(chunks_out, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"✓ chunks.json — {len(chunks_out)} NCIC chunks")


# ── 5) recap-cards.json: 페르소나별 메인 카드 4장 + 보조 학습 노드 2장 ──
RECAP_CARDS = [
    {
        "patternKey": stable_key_for_node("h1-복소수-이차방정식"),
        "title": "판별식 — 결손 채우기",
        "subtitle": "D = b² - 4ac 부호로 실근 개수를 판단한다",
        "body": "이차방정식 ax² + bx + c = 0 의 실근 개수는 판별식 D = b² - 4ac 의 부호로 결정된다.\n\n• D > 0  → 서로 다른 두 실근\n• D = 0  → 중근\n• D < 0  → 허근\n\n표면적으로 다른 단원의 문제(접선·이차곡선·도함수활용·지수로그)에서도 결국 마지막 단계는 이차방정식의 근 개수 분석으로 귀결된다.",
        "curriculumCode": "10공수1-02-04",
        "quickCheck": {
            "question": "이차방정식 x² + kx + 4 = 0 이 서로 다른 두 실근을 가질 때, 실수 k 의 범위는?",
            "answer": "k < -4 또는 k > 4",
            "explanation": "D = k² - 16 > 0 ⇔ k² > 16 ⇔ |k| > 4.",
        },
        "impact": {
            "label": "5문제 중 3문제 영향",
            "description": "판별식 결손은 접선·곡선 위치관계·도함수활용 등 광범위한 단원에서 동일하게 막힌다.",
        },
    },
    {
        "patternKey": stable_key_for_node("c1-미분계수"),
        "title": "미분계수 — 결손 채우기",
        "subtitle": "f'(a) = lim h→0 [f(a+h)-f(a)]/h",
        "body": "미분계수는 곡선 y=f(x) 위의 점 (a, f(a))에서의 접선의 기울기와 같다.\n\n• 정의: f'(a) = lim_{h→0} [f(a+h)-f(a)]/h\n• 기하적 의미: 접선의 기울기\n• 응용: 접선의 방정식 y - f(a) = f'(a)(x-a)\n\n이 정의를 정확히 적용하지 못하면 도함수·접선·극값 단원 전반에서 누적적으로 막힌다.",
        "curriculumCode": "12미적Ⅰ-02-01",
        "quickCheck": {
            "question": "f(x) = x²-x+1 일 때 lim_{h→0} [f(1+h)-f(1)]/h 의 값은?",
            "answer": "1",
            "explanation": "이 극한은 f'(1)이다. f'(x) = 2x-1 이므로 f'(1) = 1.",
        },
        "impact": {
            "label": "도함수·접선 전반 결손",
            "description": "미분계수 정의의 결손은 접선·극값·도함수활용 모두에 누적된다.",
        },
    },
    {
        "patternKey": stable_key_for_node("h1-인수분해"),
        "title": "인수분해 — 결손 채우기",
        "subtitle": "삼차·치환·인수정리",
        "body": "고등 인수분해는 곱셈공식의 역과 인수정리를 활용한다.\n\n• a³ ± b³ = (a±b)(a² ∓ ab + b²)\n• 인수정리: 다항식 P(x)에 대하여 P(a)=0 이면 (x-a)는 P(x)의 인수\n• 치환: 복잡한 식을 새 문자로 치환해 인수분해 후 되돌림\n\n인수분해 결손은 방정식 풀이·도함수 영점·접선 조건 등 거의 모든 미적분 풀이에서 막히는 원인이 된다.",
        "curriculumCode": "10공수1-01-04",
        "quickCheck": {
            "question": "x³ - 1 을 인수분해하시오.",
            "answer": "(x-1)(x²+x+1)",
            "explanation": "a³ - b³ = (a-b)(a²+ab+b²) 공식에서 b=1.",
        },
        "impact": {
            "label": "방정식·도함수 전반 결손",
            "description": "인수분해 결손은 표면적으로 다른 단원이라도 풀이의 마지막 단계에서 동일하게 막힌다.",
        },
    },
    {
        "patternKey": stable_key_for_node("c1-도함수"),
        "title": "다항함수의 도함수 — 결손 채우기",
        "subtitle": "(xⁿ)' = nx^(n-1)",
        "body": "다항함수의 도함수는 각 항을 동일한 규칙으로 미분한다.\n\n• (xⁿ)' = nx^(n-1)\n• (cf(x))' = c·f'(x)\n• (f(x) + g(x))' = f'(x) + g'(x)\n• 곱의 미분법: (f·g)' = f'g + fg'\n\n도함수 자체를 못 구하면 그 다음 단계인 접선·극값·증감 분석 모두 막힌다.",
        "curriculumCode": "12미적Ⅰ-02-04",
        "quickCheck": {
            "question": "f(x) = 3x³ - 9x² + 20 일 때 f'(x) 는?",
            "answer": "9x² - 18x",
            "explanation": "각 항을 미분: (3x³)' = 9x², (-9x²)' = -18x, (20)' = 0.",
        },
        "impact": {
            "label": "미적분 전반의 입구",
            "description": "도함수가 흔들리면 그 위의 모든 단원이 흔들린다.",
        },
    },
]

(DEMO / "recap-cards.json").write_text(
    json.dumps(RECAP_CARDS, ensure_ascii=False, indent=2), encoding="utf-8"
)
print(f"✓ recap-cards.json — {len(RECAP_CARDS)} cards")


# ── 요약 ──────────────────────────────────────────────────────────
print("\n=== 산출물 ===")
for name in ["patterns.json", "edges.json", "items.json", "chunks.json", "recap-cards.json"]:
    p = DEMO / name
    if p.exists():
        size = p.stat().st_size
        print(f"  {name:25s} {size:6d} bytes")
