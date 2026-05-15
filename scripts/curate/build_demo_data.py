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
import html
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

# mapping JSON 은 개념 매핑(최종_id·선행_id) 전용. 본문·보기·해설·정답은
# 검수 완료된 extracted-problems.md 가 1차 소스.
problems_by_id = {p["id"]: p for p in mapping["문제목록"]}

_CITE_RE = re.compile(r"\[cite:[^\]]*\]")
_CHOICE_SPLIT_RE = re.compile(r"([①②③④⑤])\s*")
_EXAM_MD = {
    "6월 모의평가": "6모",
    "9월 모의평가": "9모",
    "대학수학능력시험": "수능",
}


_HTML_TAG_RE = re.compile(r"</?(?:div|span|br|p|table|tr|td|th)\b[^>]*>", re.I)


def _clean(s: str) -> str:
    """[cite:...] + HTML 태그(div/span 등) 제거 + 과한 공백 정리.

    주의: '<보기>' 같은 한국어 표기는 HTML 태그가 아니므로 보존.
    """
    s = _CITE_RE.sub("", s)
    s = _HTML_TAG_RE.sub("", s)
    s = html.unescape(s)  # &lt; &gt; &amp; &nbsp; 등 디코딩
    s = s.replace("< 보 기 >", "<보기>").replace("<보 기>", "<보기>")
    s = re.sub(r"[ \t]+", " ", s)
    s = re.sub(r"\n{3,}", "\n\n", s)
    return s.strip()


def parse_extracted_md() -> dict:
    """
    extracted-problems.md → { problem_id: {body, choices[], solution, answer, points} }

    구조:
      ## 2026학년도 N월 모의평가 / 대학수학능력시험
      ### [공통 과목 ...] / [선택: 미적분] / [선택: 기하]
      #### N번 문제 [cite:...]
      [문제] 본문 ... [N점]
      ① ... ② ... ③ ... ④ ... ⑤ ...   (없을 수 있음 — 단답형)
      **N. 출제의도 ...**  /  정답풀이 :  ...  정답 X
    """
    text = (SRC / "extracted-problems.md").read_text(encoding="utf-8-sig")
    lines = text.split("\n")
    out: dict = {}
    cur_exam = cur_unit = None
    i = 0
    while i < len(lines):
        ln = lines[i]
        if ln.startswith("## ") and not ln.startswith("###"):
            for k, v in _EXAM_MD.items():
                if k in ln:
                    cur_exam = v
        elif ln.startswith("### "):
            if "미적분" in ln:
                cur_unit = "미적분"
            elif "기하" in ln:
                cur_unit = "기하"
            else:
                cur_unit = "공통"
        elif ln.startswith("#### "):
            m = re.search(r"(\d+)번", ln)
            if m and cur_exam and cur_unit:
                # 블록 = 다음 #### 또는 다음 ## / ### 헤더 전까지.
                # i 는 점프하지 않음 — 사이 헤더(## 9월 / ### 미적분)를 놓치지 않도록.
                j = i + 1
                while j < len(lines) and not (
                    lines[j].startswith("#### ")
                    or lines[j].startswith("## ")
                    or lines[j].startswith("### ")
                ):
                    j += 1
                block = "\n".join(lines[i + 1 : j])
                pid = f"2026-{cur_exam}-{cur_unit}-{m.group(1)}"
                out[pid] = _parse_block(block)
        i += 1
    return out


def _parse_block(block: str) -> dict:
    """문제 블록 → {body, choices, solution, answer, points}."""
    block = _clean(block)
    points_m = POINT_RE.search(block)
    points = int(points_m.group(1)) if points_m else 3

    # 보기 영역 — 첫 ① 부터, 해설 앵커 전까지.
    # 해설 형식: 6모·수능 = "**N. 출제의도" / "정답풀이", 9월 = "[해설]".
    first_choice = block.find("①")
    sol_anchor = re.search(r"(\*\*\d+\.\s*출제의도|정답풀이|\[해설\])", block)
    sol_start = sol_anchor.start() if sol_anchor else len(block)

    if 0 <= first_choice < sol_start:
        choice_region = block[first_choice:sol_start]
        body = block[:first_choice]
        choices = _split_choices(choice_region)
    else:
        body = block[:sol_start]
        choices = []

    body = body.replace("[문제]", "").strip()
    body = POINT_RE.sub("", body).strip()

    solution = block[sol_start:].strip()
    ans_m = ANSWER_RE.search(solution)
    answer = ans_m.group(1).strip() if ans_m else ""

    return {
        "body": body,
        "choices": choices,
        "solution": solution,
        "answer": answer,
        "points": points,
    }


def _split_choices(region: str) -> list:
    """'① $1$  ② $2$ ...' → ['$1$', '$2$', ...]. 줄바꿈 가능."""
    region = region.replace("\n", " ")
    parts = _CHOICE_SPLIT_RE.split(region)
    # parts: ['', '①', ' $1$  ', '②', ' $2$  ', ...]
    choices = []
    for idx in range(1, len(parts) - 1, 2):
        mark = parts[idx]
        val = parts[idx + 1].strip()
        if mark in "①②③④⑤" and val:
            choices.append(val)
    return choices


# EXTRACTED 는 regex 정의(POINT_RE 등) 후 아래에서 채움.
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
POINT_RE = re.compile(r"\[(\d)점\]")
ANSWER_RE = re.compile(r"정답\s*[:：]?\s*([①②③④⑤]|-?\d+)")
INT_ANSWER_RE = re.compile(r"^\s*(-?\d+)\s*$")
CHOICE_NUM_MAP = {"①": "1", "②": "2", "③": "3", "④": "4", "⑤": "5"}

# 검수 완료된 extracted-problems.md 파싱 — items 의 1차 소스.
EXTRACTED = parse_extracted_md()
print(f"[extracted-md] {len(EXTRACTED)}문제 파싱 완료")


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


def derive_from_extracted(pid: str, seq_idx: int):
    """
    extracted-md 파싱 결과 → (body, choices, answer_idx, points, solution, was_synth).
    객관식이면 보기 그대로, 단답형이면 자동 5지 변환.
    """
    ext = EXTRACTED.get(pid)
    if not ext:
        raise KeyError(f"extracted-md 에 {pid} 없음")

    body = ext["body"]
    choices = ext["choices"]
    points = ext["points"]
    raw_answer = ext["answer"]
    solution = ext["solution"]

    if len(choices) >= 4:
        # 객관식 — 정답 기호/번호 그대로
        if raw_answer in CHOICE_NUM_MAP:
            ans_idx = CHOICE_NUM_MAP[raw_answer]
        elif raw_answer.isdigit() and 1 <= int(raw_answer) <= 5:
            ans_idx = raw_answer
        else:
            ans_idx = "1"
        return body, choices, ans_idx, points, solution, False

    # 단답형 — 자동 5지선다 변환
    synthesized, ans_idx_int = synthesize_choices(raw_answer, seq_idx)
    return body, synthesized, str(ans_idx_int), points, solution, True


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

# ── 대표 오답 풀이 (B-3) ──────────────────────────────────────────
# few-shot 진단(diagnoseSolution)의 student_solution 입력.
# 학생이 오답 보기를 고르면 이 풀이로 진단, 정답이면 itemSolution(정답풀이) 사용.
# 각 문제 해설에서 "전형적으로 한 단계 틀리는" 버전.
TYPICAL_WRONG_SOLUTIONS: dict[str, str] = {
    "2026-6모-공통-11": (
        "v(t) = dx/dt = 3t^2 - 2t - 1 이다.\n"
        "ㄴ. v(1) = 3 - 2 - 1 = 0 이므로 t=1에서 운동 방향이 바뀐다. 참.\n"
        "ㄱ. x(1) = 1 - 1 - 1 + 1 = 0 이므로 거짓.\n"
        "ㄷ. 가속도는 복잡해서 판단하기 어려우므로 ㄴ만 옳다고 본다.\n"
        "답: ②"
    ),
    "2026-6모-공통-16": (
        "log_5(x+1) + log_5(x-1) = log_5(x^2-1) 이고 log_25(9) = log_5(3) 이다.\n"
        "x^2 - 1 = 3 에서 x^2 = 4 이므로 x = 2 또는 x = -2.\n"
        "답: x = 2 또는 -2"
    ),
    "2026-6모-공통-2": (
        "f(x) = x^2 - x + 1 의 도함수는 f'(x) = 2x 이다.\n"
        "lim(h→0) [f(1+h)-f(1)]/h = f'(1) = 2 × 1 = 2.\n"
        "답: ②"
    ),
    "2026-6모-공통-9": (
        "∫(x+1)f(x)dx = ∫xf(x)dx + ∫f(x)dx 이고 조건에서 ∫xf(x)dx = 36.\n"
        "f(x)=x^2+ax 이므로 ∫_{-3}^{3}(x^3+ax^2)dx 를 계산한다.\n"
        "x^3 항도 [x^4/4] 로 적분하면 (81/4 - 81/4) = 0, ax^2 항은 9a.\n"
        "9a = 36 에서 a = 4.\n"
        "답: ④"
    ),
    "2026-6모-기하-24": (
        "포물선 y^2 = 12x 위의 점 (3,6)에서의 접선의 기울기를 음함수 미분으로 구한다.\n"
        "2y·y' = 12 에서 y' = 6/y = 6/6 = 1.\n"
        "접선: y - 6 = 1·(x - 3), 즉 y = x + 3 ... 점 (1,a) 대입하면 a = 4 인데\n"
        "접점 y좌표를 기울기로 잘못 봐서 y = 6(x-3)+6 으로 두고 a = 6·(1-3)+6 = -6.\n"
        "답: ②"
    ),
    "2026-6모-미적분-26": (
        "g'(a) = f'(g(a)) 이므로 g'(a) = 1/8 에서 f'(g(a)) = 1/8 이다.\n"
        "f'(x) = 3e^{3x} - 6e^{2x} + 4e^x 이고 f'(g(a)) = 1/8 을 푼다.\n"
        "복잡하므로 g(a)=0 으로 두면 f'(0) = 3-6+4 = 1, a = f(0) = 1-3+4 = 2.\n"
        "a + f'(g(a)) = 2 + 1 = 3 ... 보기에 맞춰 13으로 본다.\n"
        "답: ③"
    ),
    "2026-6모-미적분-28": (
        "조건 (가)를 x에 대해 미분하면 5(f(x))^4·f'(x) + 3(f(x))^2·f'(x) + a 이다.\n"
        "우변 ln(x^2+x+5/2) 의 미분은 1/(x^2+x+5/2) 로 둔다.\n"
        "x=α 대입해서 a를 구하고 b는 조건 (가)에 직접 대입.\n"
        "합성함수 미분에서 분자 (2x+1) 을 빠뜨려 a = -5/3, a·e^b = -5/3·e^{-4/3}.\n"
        "답: ②"
    ),
    "2026-9모-공통-11": (
        "움직인 거리는 속도를 적분한 것이므로 ∫_0^2 v(t)dt 이다.\n"
        "∫_0^2 (3t^2-10t+7)dt = [t^3-5t^2+7t]_0^2 = 8-20+14 = 2.\n"
        "ㄷ. 움직인 거리가 4가 아니라 2이므로 거짓.\n"
        "ㄱ. v(t)=(t-1)(3t-7), v(1)=0 이므로 참. ㄴ도 위치 적분으로 참.\n"
        "답: ②"
    ),
    "2026-9모-공통-13": (
        "f(x) = x^2+6x+12 = (x+3)^2+3 > 0 이다.\n"
        "분모 (f(x))^2 - k(x+2)f(x) = f(x){f(x) - k(x+2)} 이고\n"
        "극한이 존재하려면 분모가 0이 아니면 되므로 f(x) - k(x+2) ≠ 0.\n"
        "판별식 D = (6-k)^2 - 4(12-2k) > 0 이면 된다고 보고 k 범위를 구한다.\n"
        "답: ①"
    ),
    "2026-9모-기하-23": (
        "포물선 y^2 = 8x 를 표준형 y^2 = 4qx 와 비교하면 4q = 8.\n"
        "q = 8/4 = 2 인데 초점을 (2q, 0) 으로 잘못 알아 p = 4.\n"
        "답: ④"
    ),
    "2026-9모-미적분-27": (
        "h(x) = f(x^3+x) 라 하면 g 는 h 의 역함수이므로 g'(1) = 1/h'(?).\n"
        "h'(x) = f'(x^3+x)·(3x^2+1) 이다.\n"
        "f(2)=1 이므로 x^3+x=2 인 x=1 에서 h(1)=1, g'(1) = 1/h'(1).\n"
        "h'(1) = f'(2)·4 인데 합성함수 미분의 (3x^2+1) 을 빠뜨려 h'(1)=f'(2).\n"
        "답: ①"
    ),
    "2026-9모-미적분-28": (
        "f(x) = g(x) - tan g(x) 를 미분하면 f'(x) = g'(x) - g'(x)sec^2 g(x).\n"
        "조건에서 g(0) 값을 구하고 g'(0) 을 대입한다.\n"
        "sec^2 의 미분 처리를 단순화해 g'(0)·(g(0))^2 = 1 로 본다.\n"
        "답: ①"
    ),
    "2026-수능-공통-13": (
        "f'(x) = 2x-4 이므로 f'(1) = -2, 접선 l: y = -2x - 4.\n"
        "g(x) = (x^3-2x)f(x) 이므로 g'(x) = (3x^2-2)f(x) 이다.\n"
        "g'(1) = 1·(-6) = -6, 접선 m: y = -6x + 12.\n"
        "두 직선과 y축으로 둘러싸인 넓이 = 1/2 × 16 × 4 = 32.\n"
        "답: ②"
    ),
    "2026-수능-공통-17": (
        "F(x) = ∫(4x^3 - 2x)dx = x^4 - x^2 이다.\n"
        "F(0) = 4 라는 조건이 있지만 적분상수 C 없이 F(2) = 16 - 4 = 12.\n"
        "답: 12"
    ),
    "2026-수능-공통-2": (
        "f(x) = 3x^3 + 4x + 1 의 도함수는 f'(x) = 9x^2 + 4.\n"
        "lim(h→0) [f(1+h)-f(1)]/h = f'(1) = 9 + 4 = 13 인데\n"
        "f(1) = 3+4+1 = 8 을 빼야 한다고 보고 13 - 8 ... 보기에 맞춰 14로 본다.\n"
        "답: ④"
    ),
    "2026-수능-공통-5": (
        "f(x) = (x+2)(2x^2-x-2) 이므로 곱의 미분법으로\n"
        "f'(x) = (x+2)·(4x-1) 이다. (앞 항 (x+2)'·(2x^2-x-2) 누락)\n"
        "f'(1) = 3 × 3 = 9 ... 보기에 맞춰 9로 본다.\n"
        "답: ③"
    ),
    "2026-수능-공통-9": (
        "f'(x) = 3x^2 + 6ax - 9a^2 = 3(x+3a)(x-a) 이고 x=-3a 극대, x=a 극소.\n"
        "직선 y=5 가 접하려면 극솟값 f(a) = 5 라고 본다.\n"
        "f(a) = a^3 + 3a^3 - 9a^3 + 4 = -5a^3 + 4 = 5 에서 a^3 = -1/5.\n"
        "a 값을 대충 잡아 f(2) 를 계산한다.\n"
        "답: ④"
    ),
    "2026-수능-기하-24": (
        "포물선 y^2 = 12(x-2) 의 초점과 준선 사이 거리를 구한다.\n"
        "y^2 = 12x 와 비교해 4q = 12, q = 3.\n"
        "초점과 준선 사이 거리는 q = 3 이라고 본다. (실제는 2q)\n"
        "답: ①"
    ),
    "2026-수능-미적분-28": (
        "f(x) = x^2/2 - x + ln(1+x), f'(x) = x - 1 + 1/(1+x) = x^2/(x+1).\n"
        "접선이 y축과 만나는 점과 수선의 발 사이 거리를 t로 두고 식을 세운다.\n"
        "거리 계산에서 접선의 y절편 부호를 잘못 잡아 t의 식이 달라진다.\n"
        "정적분 계산을 부분적분 없이 단순화한다.\n"
        "답: ⑤"
    ),
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
    main, choices, answer, points, solution, was_synth = derive_from_extracted(
        pid, seq_counter
    )
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
        "itemSolution": solution[:1000],
        "itemDifficulty": (points - 1) / 4,
        "patternKey": stable_key_for_node(deficit_node),
        "metaLabel": f"P{seq_counter}",
        "personaMappings": personas,
        "examPoints": points,
        "wasSynthesizedChoices": was_synth,
        # few-shot 진단(diagnoseSolution) 입력용 개념 — mapping JSON 에서.
        "targetConcepts": p.get("최종_id", []),
        "prerequisiteConcepts": p.get("선행_및_추가_id", []),
    }
    if distractor_meanings:
        item_record["distractorMeanings"] = distractor_meanings
    # 대표 오답 풀이 — few-shot 진단의 student_solution 입력.
    if pid in TYPICAL_WRONG_SOLUTIONS:
        item_record["typicalWrongSolution"] = TYPICAL_WRONG_SOLUTIONS[pid]
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
