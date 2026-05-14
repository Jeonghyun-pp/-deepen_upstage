"""Option A v4 — split each page into left/right columns before IE.

수능 문제지는 2단 레이아웃이라 페이지 전체를 통째로 보내면
작은 인라인 수식이 모델 비전 토큰의 1/4 미만 크기로 들어가서
인식 정확도가 떨어진다. 컬럼 단위로 자르면 같은 수식이
2배 큰 영역을 차지하게 되어 인식이 개선될 것으로 기대.
"""

import base64
import json
import os
import sys
import time
from pathlib import Path

import fitz
from PIL import Image
import requests
from dotenv import load_dotenv

ENDPOINT = "https://api.upstage.ai/v1/information-extraction"
PDF_NAME = "2026_수능수학_미적분_3pages.pdf"
DPI = 600
MODEL = "information-extract"
COLUMN_OVERLAP_PX = 100  # slight overlap to avoid losing text on the seam

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent / "option_a_v4_out"

SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "math_problems_column",
        "schema": {
            "type": "object",
            "description": (
                "대학수학능력시험 수학 영역 문제지의 한 컬럼(반쪽). "
                "이 이미지에 명확히 보이는 모든 수학 문항을 추출. "
                "페이지 헤더('홀수형', '제 2 교시', 페이지 번호)·푸터·저작권 문구는 제외. "
                "**중요: 이미지에서 명확히 보이는 내용만 추출. "
                "불분명하거나 안 보이는 부분을 추측해서 채워 넣지 말 것. "
                "'(이하 생략)', '...' 같은 placeholder 절대 사용 금지. "
                "확실치 않으면 빈 문자열로 두거나 보수적인 표기만 사용. "
                "문제가 컬럼 경계에서 잘렸으면 보이는 부분만."
            ),
            "properties": {
                "problems": {
                    "type": "array",
                    "description": "이 컬럼의 모든 수학 문항(번호 오름차순).",
                    "items": {
                        "type": "object",
                        "properties": {
                            "number": {"type": "integer", "description": "문항 번호."},
                            "points": {
                                "type": "integer",
                                "description": "배점. 본문 끝 [2점]/[3점]/[4점]에서 추출. 없으면 0.",
                            },
                            "problem_type": {
                                "type": "string",
                                "description": "'multiple_choice' 또는 'short_answer'.",
                            },
                            "question": {
                                "type": "string",
                                "description": (
                                    "문항 본문. 모든 수식은 LaTeX로 정확히 표기. "
                                    "인라인 $...$, 블록 $$...$$. "
                                    "지수 $a^{b}$ (예: $9^{\\frac{1}{4}}$, $3^{-\\frac{1}{2}}$), "
                                    "분수 $\\frac{a}{b}$, "
                                    "시그마 $\\sum_{k=1}^{n}$ (상하한 누락 금지), "
                                    "적분 $\\int_{a}^{b}$, 극한 $\\lim_{x \\to a}$, 로그 $\\log_{a} b$, "
                                    "조각함수 $$f(x)=\\begin{cases} 식 & 조건 \\\\ ... \\end{cases}$$. "
                                    "[N점] 표기는 본문에 포함 금지."
                                ),
                            },
                            "choices": {
                                "type": "array",
                                "description": (
                                    "5지선다 선택지 5개. ①②③④⑤ 마커 제외, 내용만, 수식 LaTeX. "
                                    "단답형이면 빈 배열. 보이지 않는 선택지는 추측해 넣지 말 것."
                                ),
                                "items": {"type": "string"},
                            },
                        },
                        "required": ["number", "points", "problem_type", "question", "choices"],
                    },
                }
            },
            "required": ["problems"],
        },
    },
}


def render_pages(pdf_path: Path, out_dir: Path, dpi: int) -> list[Path]:
    doc = fitz.open(pdf_path)
    paths = []
    mat = fitz.Matrix(dpi / 72, dpi / 72)
    for i, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        p = out_dir / f"page_{i}.png"
        pix.save(p)
        paths.append(p)
    doc.close()
    return paths


def split_columns(page_path: Path, out_dir: Path) -> list[Path]:
    """Split page image into left and right columns with a small overlap."""
    img = Image.open(page_path)
    w, h = img.size
    mid = w // 2
    left = img.crop((0, 0, mid + COLUMN_OVERLAP_PX, h))
    right = img.crop((mid - COLUMN_OVERLAP_PX, 0, w, h))
    stem = page_path.stem
    lp = out_dir / f"{stem}_L.png"
    rp = out_dir / f"{stem}_R.png"
    left.save(lp)
    right.save(rp)
    return [lp, rp]


def call_ie(api_key: str, image_path: Path, max_retries: int = 5) -> dict:
    b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    payload = {
        "model": MODEL,
        "messages": [
            {
                "role": "user",
                "content": [
                    {
                        "type": "image_url",
                        "image_url": {
                            "url": f"data:application/octet-stream;base64,{b64}"
                        },
                    }
                ],
            }
        ],
        "response_format": SCHEMA,
    }
    backoff = 15
    for attempt in range(1, max_retries + 1):
        resp = requests.post(
            ENDPOINT,
            headers={
                "Authorization": f"Bearer {api_key}",
                "Content-Type": "application/json",
            },
            json=payload,
            timeout=600,
        )
        if resp.status_code == 429:
            print(f"    429, sleep {backoff}s ({attempt}/{max_retries})")
            time.sleep(backoff)
            backoff *= 2
            continue
        if not resp.ok:
            print(f"    HTTP {resp.status_code}: {resp.text[:1000]}")
            resp.raise_for_status()
        return resp.json()
    raise RuntimeError("max retries hit")


def reconstruct_markdown(problems: list[dict]) -> str:
    lines = []
    for p in problems:
        n = p.get("number", "?")
        pts = p.get("points", 0)
        lines.append(f"## {n}. [{pts}점]" if pts else f"## {n}.")
        lines.append("")
        lines.append(p.get("question", ""))
        choices = p.get("choices") or []
        if choices:
            lines.append("")
            markers = "①②③④⑤"
            for i, c in enumerate(choices):
                m = markers[i] if i < len(markers) else f"({i+1})"
                lines.append(f"- {m} {c}")
        lines.append("")
    return "\n".join(lines)


def main() -> None:
    load_dotenv(ROOT / ".env")
    api_key = (os.environ.get("UPSTAGE_API_KEY") or "").strip().strip("'\"")
    if not api_key:
        sys.exit("UPSTAGE_API_KEY not set")
    pdf_path = ROOT / PDF_NAME
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("rendering pages…")
    page_paths = render_pages(pdf_path, OUT_DIR, DPI)

    all_problems: list[dict] = []
    by_problem: dict[int, list[dict]] = {}  # number → list of variants (from L/R)
    total_tokens = 0

    for page_idx, page_path in enumerate(page_paths, start=1):
        print(f"\npage {page_idx}: splitting into columns")
        column_paths = split_columns(page_path, OUT_DIR)
        for col_idx, col_path in enumerate(column_paths, start=1):
            label = "L" if col_idx == 1 else "R"
            if len(all_problems) > 0 or page_idx > 1 or col_idx > 1:
                time.sleep(10)
            print(f"  → IE: page {page_idx} col {label} ({col_path.name})")
            t0 = time.time()
            try:
                data = call_ie(api_key, col_path)
            except Exception as e:
                print(f"    ERROR: {e}")
                continue
            elapsed = time.time() - t0
            (OUT_DIR / f"page_{page_idx}_{label}_raw.json").write_text(
                json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
            )
            try:
                content = data["choices"][0]["message"]["content"]
                problems = json.loads(content).get("problems", [])
            except Exception as e:
                print(f"    parse failed: {e}")
                problems = []
            usage = data.get("usage", {})
            total_tokens += usage.get("total_tokens", 0)
            print(f"    elapsed {elapsed:.1f}s, problems: {len(problems)}, "
                  f"tokens: {usage.get('total_tokens', '?')}")
            for prob in problems:
                n = prob.get("number")
                print(f"      [{n}] pts={prob.get('points')} "
                      f"type={prob.get('problem_type')} "
                      f"q_len={len(prob.get('question') or '')} "
                      f"choices={len(prob.get('choices') or [])}")
                by_problem.setdefault(n, []).append({
                    **prob,
                    "_source": f"page{page_idx}_{label}",
                })
            all_problems.extend(problems)

    # Pick best variant per problem: prefer the one with longer question text
    # (assuming truncated/border-cropped versions are shorter)
    merged: list[dict] = []
    for n in sorted(by_problem.keys()):
        variants = by_problem[n]
        best = max(variants, key=lambda v: len(v.get("question") or ""))
        merged.append(best)

    (OUT_DIR / "problems.json").write_text(
        json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "reconstructed.md").write_text(
        reconstruct_markdown(merged), encoding="utf-8"
    )
    (OUT_DIR / "variants.json").write_text(
        json.dumps(by_problem, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    print(f"\n=== summary ===")
    print(f"  numbers: {[p.get('number') for p in merged]}")
    print(f"  total tokens: {total_tokens}")
    p1 = next((p for p in merged if p.get("number") == 1), None)
    if p1:
        print(f"\n--- problem 1 (source: {p1.get('_source')}) ---")
        print(f"  question: {p1.get('question')}")
        for i, c in enumerate(p1.get("choices") or []):
            print(f"  ({i+1}) {c}")


if __name__ == "__main__":
    main()
