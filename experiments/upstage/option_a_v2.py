"""Option A v2 — IE with higher DPI, nightly model, and explicit prompt.

Combines:
  (1) DPI 300 → 600 for crisper inline math
  (2) Explicit user text instructing accurate LaTeX
  (3) information-extract-nightly model
"""

import base64
import json
import os
import sys
import time
from pathlib import Path

import fitz
import requests
from dotenv import load_dotenv

ENDPOINT = "https://api.upstage.ai/v1/information-extraction"
PDF_NAME = "2026_수능수학_미적분_3pages.pdf"
DPI = 600
MODEL = "information-extract"

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent / "option_a_v3_out"

SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "math_problems_page",
        "schema": {
            "type": "object",
            "description": (
                "대학수학능력시험 수학 영역 문제지 1페이지. "
                "페이지에 포함된 모든 수학 문항을 추출. "
                "페이지 헤더('홀수형', '제 2 교시', 페이지 번호)·푸터·저작권 문구는 제외. "
                "페이지 경계에서 문제가 잘렸으면 보이는 부분만 추출. "
                "**중요: 이미지에서 명확히 보이는 내용만 추출할 것. "
                "불분명하거나 안 보이는 부분을 추측해서 채워 넣지 말 것. "
                "'(이하 생략)', '...' 같은 placeholder를 절대 사용하지 말 것. "
                "확실치 않으면 해당 부분을 빈 문자열로 두거나 가장 보수적인 표기만 사용."
            ),
            "properties": {
                "problems": {
                    "type": "array",
                    "description": "이 페이지의 모든 수학 문항(번호 오름차순).",
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
                                "description": "'multiple_choice' (5지선다) 또는 'short_answer' (단답형).",
                            },
                            "question": {
                                "type": "string",
                                "description": (
                                    "문항 본문. 모든 수식은 반드시 LaTeX로 정확히 표기. "
                                    "인라인 수식은 $...$, 블록 수식은 $$...$$. "
                                    "지수는 $a^{b}$ (예: $9^{\\frac{1}{4}}$, $3^{-\\frac{1}{2}}$), "
                                    "분수는 $\\frac{a}{b}$, "
                                    "시그마는 $\\sum_{k=1}^{n} a_k$ (상한·하한 절대 누락 금지), "
                                    "적분은 $\\int_{a}^{b} f(x)\\,dx$, "
                                    "극한은 $\\lim_{x \\to a} f(x)$, "
                                    "로그는 $\\log_{a} b$, "
                                    "조각함수는 $$f(x)=\\begin{cases} 식1 & 조건1 \\\\ 식2 & 조건2 \\end{cases}$$ 형태로 빠짐없이. "
                                    "조각함수·시그마·적분 같은 큰 블록 수식은 누락 절대 금지. "
                                    "[N점] 표기는 본문에 포함하지 말 것 (points 필드에만)."
                                ),
                            },
                            "choices": {
                                "type": "array",
                                "description": (
                                    "5지선다 선택지. 정확히 ①②③④⑤ 순서로 5개. "
                                    "①②③④⑤ 마커는 제외하고 내용만, 수식은 LaTeX로. "
                                    "단답형이면 빈 배열."
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
        size_kb = p.stat().st_size / 1024
        print(f"  page {i}: {pix.width}x{pix.height}, {size_kb:.0f} KB")
    doc.close()
    return paths


def call_ie(api_key: str, image_path: Path, max_retries: int = 4) -> dict:
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
                    },
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
            print(f"  429 rate-limited, sleep {backoff}s (attempt {attempt}/{max_retries})")
            time.sleep(backoff)
            backoff *= 2
            continue
        if not resp.ok:
            print(f"  HTTP {resp.status_code}: {resp.text[:1500]}")
            resp.raise_for_status()
        return resp.json()
    raise RuntimeError("exceeded retries on 429")


def reconstruct_markdown(problems: list[dict]) -> str:
    lines = []
    for p in problems:
        n = p.get("number", "?")
        pts = p.get("points", 0)
        pts_str = f" [{pts}점]" if pts else ""
        lines.append(f"## {n}.{pts_str}")
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

    print(f"rendering pages at {DPI} DPI…")
    page_paths = render_pages(pdf_path, OUT_DIR, DPI)

    all_problems: list[dict] = []
    total_tokens = 0
    for i, p in enumerate(page_paths, start=1):
        if i > 1:
            time.sleep(8)  # space out calls to avoid 429
        print(f"\n→ IE call: page {i} (model={MODEL})")
        t0 = time.time()
        try:
            data = call_ie(api_key, p)
        except Exception as e:
            print(f"  ERROR: {e}")
            continue
        elapsed = time.time() - t0
        (OUT_DIR / f"page_{i}_raw.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        try:
            content = data["choices"][0]["message"]["content"]
            page_problems = json.loads(content).get("problems", [])
        except Exception as e:
            print(f"  parse failed: {e}")
            page_problems = []
        usage = data.get("usage", {})
        total_tokens += usage.get("total_tokens", 0)
        print(f"  elapsed: {elapsed:.1f}s, problems: {len(page_problems)}, "
              f"tokens: {usage.get('total_tokens', '?')}")
        for prob in page_problems:
            print(f"    [{prob.get('number')}] pts={prob.get('points')} "
                  f"type={prob.get('problem_type')} "
                  f"choices={len(prob.get('choices') or [])}")
        all_problems.extend(page_problems)

    seen: dict[int, dict] = {}
    for p in all_problems:
        n = p.get("number")
        if n not in seen:
            seen[n] = p
    merged = [seen[k] for k in sorted(seen.keys())]

    (OUT_DIR / "problems.json").write_text(
        json.dumps(merged, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    (OUT_DIR / "reconstructed.md").write_text(
        reconstruct_markdown(merged), encoding="utf-8"
    )

    print(f"\n=== summary ===")
    print(f"  numbers: {[p.get('number') for p in merged]}")
    print(f"  total tokens: {total_tokens}")
    p1 = next((p for p in merged if p.get("number") == 1), None)
    if p1:
        print(f"\n--- problem 1 ---")
        print(f"  question: {p1.get('question')}")
        for i, c in enumerate(p1.get("choices") or []):
            print(f"  ({i+1}) {c}")


if __name__ == "__main__":
    main()
