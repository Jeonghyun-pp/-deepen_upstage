"""
37 평가원 문제 → 4 페르소나 × 5문제 = 20문제 풀 큐레이션.

입력
  data/source/problem-mapping.json   37문제 × {최종_id, 선행_및_추가_id, 문제, 해설}
  data/source/concepts.json          133노드 prereq 그래프

출력
  data/source/_curated_pool.json     20문제 + 페르소나 매핑 + 사용 노드 목록 (검토용)
  → 사람 검토 후 scripts/curate/build_demo_data.py 가 data/demo/*.json 으로 변환

선별 기준
  1. 페르소나별 결손 노드가 prereq 또는 최종_id 에 포함된 문제만 후보
  2. 표면 단원 다양성 최대화 (같은 시험·단원·번호 중복 피함)
  3. 해설 길이 ~600자 이하 우선 (stub 풀이 만들기 쉬움)
  4. 난이도 2점·3점·4점 골고루
"""

import json
import re
import sys
import io
from pathlib import Path
from collections import defaultdict, Counter

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8")

ROOT = Path(__file__).resolve().parents[2]
SRC = ROOT / "data" / "source"

with open(SRC / "problem-mapping.json", encoding="utf-8-sig") as f:
    mapping = json.load(f)
with open(SRC / "concepts.json", encoding="utf-8-sig") as f:
    concepts_data = json.load(f)

# 단답형은 build 단계에서 5지선다 자동 변환되므로 큐레이션은 전체 37문제 후보.
problems = mapping["문제목록"]
concept_by_id = {c["id"]: c for c in concepts_data["concepts"]}


# ── 4 페르소나 정의 (drama 분석 Top 결과) ────────────────────────────
PERSONAS = {
    "A": {
        "label": "이차방정식·판별식 결손",
        "deficit_nodes": ["h1-이차방정식-함수", "h1-복소수-이차방정식"],
        "tldr": "판별식 D = b² - 4ac 의 부호 분석 단계에서 막힘",
    },
    "B": {
        "label": "미분계수 결손",
        "deficit_nodes": ["c1-미분계수"],
        "tldr": "미분계수의 정의 f'(a) = lim(h→0) [f(a+h)-f(a)]/h 를 못 적용",
    },
    "C": {
        "label": "인수분해 결손",
        "deficit_nodes": ["h1-인수분해"],
        "tldr": "고등 인수분해 (삼차·치환·인수정리) 단계에서 막힘",
    },
    "D": {
        "label": "도함수 결손",
        "deficit_nodes": ["c1-도함수"],
        "tldr": "다항함수 미분 자체를 못 함 (xⁿ → nx^(n-1) 규칙)",
    },
}


import re

POINT_RE = re.compile(r"\[(\d)점\]")


def parse_points(problem):
    """문제 본문 [N점] 파싱. 못 찾으면 3점 가정."""
    m = POINT_RE.search(problem.get("문제", ""))
    return int(m.group(1)) if m else 3


def get_extra_score(problem, deficit_nodes):
    """선별 점수 — coverage + 난이도 가중 + brevity 보너스."""
    pid_set = set(problem["최종_id"]) | set(problem["선행_및_추가_id"])
    coverage = len(set(deficit_nodes) & pid_set)
    points = parse_points(problem)
    # 어려운 문제 가중 (2점=0, 3점=2, 4점=4)
    difficulty_bonus = (points - 2) * 2
    # brevity 보너스 (4점 문제는 길어도 패널티 X — 그냥 bonus 작음)
    solution_len = len(problem.get("해설", ""))
    brevity = max(0, 1200 - solution_len) / 1200
    return coverage * 10 + difficulty_bonus + brevity


def diversify(problems_list, k=5, used_across_personas=None):
    """
    표면 단원·시험 다양성 + 페르소나간 cross-penalty 까지 고려한 그리디 선별.
    used_across_personas: { problem_id → 다른 페르소나에서 이미 선택된 횟수 }
    """
    used_across_personas = used_across_personas or {}
    if len(problems_list) <= k:
        return list(problems_list)
    picked = []
    remaining = list(problems_list)
    while len(picked) < k and remaining:
        best = None
        best_score = -1e9
        seen_units = Counter(p["단원"] for p in picked)
        seen_exams = Counter(p["시험"] for p in picked)
        seen_points = Counter(parse_points(p) for p in picked)
        seen_nums = set(p["번호"] for p in picked)
        for p in remaining:
            cross = used_across_personas.get(p["id"], 0)
            penalty = (
                seen_units[p["단원"]] * 3
                + seen_exams[p["시험"]] * 2
                + seen_points[parse_points(p)] * 2  # ← 점수 분포도 다양하게
                + (1 if p["번호"] in seen_nums else 0)
                + cross * 6  # ← 다른 페르소나가 이미 골랐으면 큰 페널티
            )
            score = p["_extra_score"] - penalty
            if score > best_score:
                best_score = score
                best = p
        picked.append(best)
        remaining.remove(best)
    return picked


# ── 페르소나별 후보 풀 ─────────────────────────────────────────────
# 후보 풀이 작은 페르소나부터 처리 → cross-penalty 효과 극대화
persona_order = sorted(
    PERSONAS.keys(),
    key=lambda k: sum(
        1
        for p in problems
        if set(PERSONAS[k]["deficit_nodes"])
        & (set(p["최종_id"]) | set(p["선행_및_추가_id"]))
    ),
)

used_across = Counter()
persona_picks = {}
for key in persona_order:
    persona = PERSONAS[key]
    deficits = set(persona["deficit_nodes"])
    cands = []
    for p in problems:
        pid_set = set(p["최종_id"]) | set(p["선행_및_추가_id"])
        if deficits & pid_set:
            p2 = dict(p)
            p2["_extra_score"] = get_extra_score(p, persona["deficit_nodes"])
            cands.append(p2)
    cands.sort(key=lambda x: -x["_extra_score"])
    picked = diversify(cands, k=5, used_across_personas=used_across)
    for p in picked:
        used_across[p["id"]] += 1
    persona_picks[key] = {
        "label": persona["label"],
        "deficit_nodes": persona["deficit_nodes"],
        "tldr": persona["tldr"],
        "candidate_count": len(cands),
        "picked_ids": [p["id"] for p in picked],
        "picked": [
            {
                "id": p["id"],
                "시험": p["시험"],
                "단원": p["단원"],
                "번호": p["번호"],
                "점수": parse_points(p),
                "최종_id": p["최종_id"],
                "해설_길이": len(p.get("해설", "")),
                "score": p["_extra_score"],
            }
            for p in picked
        ],
    }

# ── 풀 통합 (중복 제거) ────────────────────────────────────────────
all_ids = set()
for v in persona_picks.values():
    all_ids.update(v["picked_ids"])

pool_problems = [p for p in problems if p["id"] in all_ids]


# ── 사용 노드 추출 (그래프 12~14노드 후보) ─────────────────────────
node_usage = Counter()
for p in pool_problems:
    for nid in p["최종_id"]:
        node_usage[nid] += 3  # 최종 노드는 가중치
    for nid in p["선행_및_추가_id"]:
        node_usage[nid] += 1

# 중학교/초등 단계는 제외 (그래프 너무 깊어짐)
def is_demo_relevant(node_id):
    return not (node_id.startswith("m-") or node_id.startswith("e"))


graph_nodes_ranked = [
    (nid, cnt) for nid, cnt in node_usage.most_common() if is_demo_relevant(nid)
]
graph_nodes_top = graph_nodes_ranked[:14]


# ── 출력 ──────────────────────────────────────────────────────────
print(f"=== 페르소나별 큐레이션 결과 ===")
for key, v in persona_picks.items():
    print(f"\n[페르소나 {key}] {v['label']}")
    print(f"  결손 노드: {v['deficit_nodes']}")
    print(f"  후보 풀: {v['candidate_count']}문제 → 5개 선별")
    pt_dist = Counter(p["점수"] for p in v["picked"])
    print(f"  점수분포: {dict(pt_dist)}")
    for p in v["picked"]:
        finals = ",".join(p["최종_id"])
        print(
            f"    · {p['id']:30s} {p['시험'][:9]:9s} {p['단원']:5s} {p['번호']:2d}번 "
            f"[{p['점수']}점] ({finals}) 해설{p['해설_길이']:4d}자"
        )

print(f"\n=== 통합 풀 ===")
print(f"  중복 합쳐 {len(all_ids)}문제 (목표 ~20)")

print(f"\n=== 그래프 사용 노드 (Top 14, 중학교 이하 제외) ===")
for nid, cnt in graph_nodes_top:
    c = concept_by_id.get(nid, {})
    print(f"  {nid:28s} {c.get('이름','?'):25s} {c.get('학년','?'):12s} usage={cnt}")


# ── _curated_pool.json 저장 ────────────────────────────────────────
out = {
    "personas": persona_picks,
    "pool_problem_ids": sorted(all_ids),
    "pool_size": len(all_ids),
    "graph_nodes_top": [
        {
            "id": nid,
            "이름": concept_by_id.get(nid, {}).get("이름"),
            "학년": concept_by_id.get(nid, {}).get("학년"),
            "과목": concept_by_id.get(nid, {}).get("과목"),
            "선행개념": concept_by_id.get(nid, {}).get("선행개념", []),
            "usage": cnt,
        }
        for nid, cnt in graph_nodes_top
    ],
}
out_path = SRC / "_curated_pool.json"
with open(out_path, "w", encoding="utf-8") as f:
    json.dump(out, f, ensure_ascii=False, indent=2)
print(f"\n→ 저장: {out_path}")
