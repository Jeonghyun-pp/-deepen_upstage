"""Upstage Document Parse — quick test on a sliced 수능수학 PDF.

Usage:
    python experiments/upstage/parse_pdf.py [pdf_path]

Output:
    experiments/upstage/out/raw.json     — full API response
    experiments/upstage/out/content.md   — aggregated markdown
    experiments/upstage/out/content.html — aggregated html
    experiments/upstage/out/summary.txt  — element category counts
"""

import json
import os
import sys
from collections import Counter
from pathlib import Path

import requests
from dotenv import load_dotenv

ENDPOINT = "https://api.upstage.ai/v1/document-digitization"
DEFAULT_PDF = "2026_수능수학_미적분_3pages.pdf"

ROOT = Path(__file__).resolve().parents[2]
OUT_DIR = Path(__file__).resolve().parent / "out"


def main() -> None:
    load_dotenv(ROOT / ".env")
    api_key = (os.environ.get("UPSTAGE_API_KEY") or "").strip().strip("'\"")
    if not api_key:
        sys.exit("UPSTAGE_API_KEY not set in .env")

    pdf_path = ROOT / (sys.argv[1] if len(sys.argv) > 1 else DEFAULT_PDF)
    if not pdf_path.exists():
        sys.exit(f"PDF not found: {pdf_path}")

    OUT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"→ POST {ENDPOINT}")
    print(f"  document: {pdf_path.name}")
    with pdf_path.open("rb") as f:
        resp = requests.post(
            ENDPOINT,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"document": (pdf_path.name, f, "application/pdf")},
            data={
                "model": "document-parse",
                "ocr": "auto",
                "coordinates": "true",
                "chart_recognition": "true",
                "output_formats": json.dumps(["html", "markdown", "text"]),
            },
            timeout=300,
        )

    if not resp.ok:
        print(f"HTTP {resp.status_code}")
        print(resp.text[:2000])
        resp.raise_for_status()

    data = resp.json()

    (OUT_DIR / "raw.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    content = data.get("content", {})
    if content.get("markdown"):
        (OUT_DIR / "content.md").write_text(content["markdown"], encoding="utf-8")
    if content.get("html"):
        (OUT_DIR / "content.html").write_text(content["html"], encoding="utf-8")

    elements = data.get("elements", [])
    cats = Counter(e.get("category") for e in elements)
    pages = data.get("usage", {}).get("pages")

    summary = [
        f"model: {data.get('model')}",
        f"apiVersion: {data.get('apiVersion')}",
        f"billed pages: {pages}",
        f"elements: {len(elements)}",
        "categories:",
        *[f"  {c}: {n}" for c, n in cats.most_common()],
    ]
    text = "\n".join(summary)
    (OUT_DIR / "summary.txt").write_text(text, encoding="utf-8")
    print()
    print(text)
    print(f"\nartifacts → {OUT_DIR.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
