"""Option A — Upstage Information Extraction with vision.

Renders each PDF page to PNG, calls IE with a schema that forces LaTeX
output for math, and aggregates problems across pages.

Output:
    experiments/upstage/option_a_out/
        page_N.png                  rendered page image
        page_N_raw.json             full IE response
        problems.json               aggregated problems list
        reconstructed.md            human-readable view
"""

import base64
import json
import os
import sys
import time
from pathlib import Path

import fitz  # PyMuPDF
import requests
from dotenv import load_dotenv

ENDPOINT = "https://api.upstage.ai/v1/information-extraction"
PDF_NAME = "2026_수능수학_미적분_3pages.pdf"
DPI = 300

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent / "option_a_out"

SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "math_problems_page",
        "schema": {
            "type": "object",
            "properties": {
                "problems": {
                    "type": "array",
                    "description": (
                        "이 페이지에 등장하는 모든 수능 수학 문항. "
                        "페이지 헤더/푸터/저작권 문구는 제외. "
                        "문항이 페이지에 일부만 보이면 보이는 만큼만 추출."
                    ),
                    "items": {
                        "type": "object",
                        "properties": {
                            "number": {
                                "type": "integer",
                                "description": "문항 번호. 예: 1, 2, 3...",
                            },
                            "points": {
                                "type": "integer",
                                "description": "배점. 본문 끝 [2점]/[3점]/[4점]에서 추출. 표기 없으면 0.",
                            },
                            "problem_type": {
                                "type": "string",
                                "description": "'multiple_choice' (5지선다) 또는 'short_answer' (단답형).",
                            },
                            "question": {
                                "type": "string",
                                "description": (
                                    "문항 본문(발문). 모든 수식은 LaTeX로 표기. "
                                    "인라인 수식은 $...$, 블록/조건식은 $$...$$. "
                                    "예: '$9^{1/4} \\\\times 3^{-1/2}$의 값은?'. "
                                    "한글 텍스트와 LaTeX를 자연스럽게 섞어서 쓸 것. "
                                    "마지막의 [N점] 표기는 제외."
                                ),
                            },
                            "choices": {
                                "type": "array",
                                "description": (
                                    "5지선다 선택지. ①②③④⑤ 순서대로 5개. "
                                    "마커(①② 등)는 제외하고 내용만, 수식은 LaTeX로. "
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


def render_pages(pdf_path: Path, out_dir: Path, dpi: int = DPI) -> list[Path]:
    doc = fitz.open(pdf_path)
    paths = []
    zoom = dpi / 72
    mat = fitz.Matrix(zoom, zoom)
    for i, page in enumerate(doc, start=1):
        pix = page.get_pixmap(matrix=mat, alpha=False)
        p = out_dir / f"page_{i}.png"
        pix.save(p)
        paths.append(p)
        print(f"  rendered page {i} → {p.name} ({pix.width}x{pix.height})")
    doc.close()
    return paths


def call_ie(api_key: str, image_path: Path) -> dict:
    b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    payload = {
        "model": "information-extract",
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
    resp = requests.post(
        ENDPOINT,
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json=payload,
        timeout=300,
    )
    if not resp.ok:
        print(f"  HTTP {resp.status_code}: {resp.text[:1000]}")
        resp.raise_for_status()
    return resp.json()


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
    if not pdf_path.exists():
        sys.exit(f"PDF not found: {pdf_path}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print("rendering pages…")
    page_paths = render_pages(pdf_path, OUT_DIR)

    all_problems: list[dict] = []
    total_tokens = 0
    for i, p in enumerate(page_paths, start=1):
        print(f"\n→ IE call: page {i}")
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
            content_str = data["choices"][0]["message"]["content"]
            parsed = json.loads(content_str)
            page_problems = parsed.get("problems", [])
        except (KeyError, json.JSONDecodeError) as e:
            print(f"  parse failed: {e}")
            page_problems = []

        usage = data.get("usage", {})
        total_tokens += usage.get("total_tokens", 0)

        print(f"  elapsed: {elapsed:.1f}s, problems on page: {len(page_problems)}, "
              f"tokens: {usage.get('total_tokens', '?')}")
        for prob in page_problems:
            print(f"    [{prob.get('number')}] pts={prob.get('points')} "
                  f"type={prob.get('problem_type')} "
                  f"choices={len(prob.get('choices') or [])}")
        all_problems.extend(page_problems)

    # Dedupe by number, keep the first occurrence (handles cross-page partials)
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
    print(f"  problems extracted: {len(merged)} (numbers: {[p.get('number') for p in merged]})")
    print(f"  total tokens used: {total_tokens}")
    print(f"  artifacts → {OUT_DIR.relative_to(ROOT)}")

    # Highlight problem 1 for verification
    p1 = next((p for p in merged if p.get("number") == 1), None)
    if p1:
        print(f"\n--- problem 1 ---")
        print(f"  question: {p1.get('question')}")
        print(f"  points:   {p1.get('points')}")
        print(f"  type:     {p1.get('problem_type')}")
        for i, c in enumerate(p1.get("choices") or []):
            print(f"  choice {i+1}: {c}")


if __name__ == "__main__":
    main()
