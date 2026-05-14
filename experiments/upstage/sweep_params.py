"""Sweep Upstage Document Parse parameters and compare problem-1 extraction.

Tests all combinations of ocr × mode and reports which combination cleanly
extracts the inline math of problem 1: (9^(1/4)) × (3^(-1/2)).
"""

import itertools
import json
import os
import re
import sys
import time
from pathlib import Path

import requests
from dotenv import load_dotenv

ENDPOINT = "https://api.upstage.ai/v1/document-digitization"
PDF_NAME = "2026_수능수학_미적분_3pages.pdf"

OCR_OPTIONS = ["auto", "force"]
MODE_OPTIONS = ["standard", "enhanced", "auto"]

ROOT = Path(__file__).resolve().parents[2]
OUT_BASE = Path(__file__).resolve().parent / "sweep_out"


def call_api(api_key: str, pdf_path: Path, ocr: str, mode: str) -> dict:
    with pdf_path.open("rb") as f:
        resp = requests.post(
            ENDPOINT,
            headers={"Authorization": f"Bearer {api_key}"},
            files={"document": (pdf_path.name, f, "application/pdf")},
            data={
                "model": "document-parse",
                "ocr": ocr,
                "mode": mode,
                "coordinates": "true",
                "chart_recognition": "true",
                "output_formats": json.dumps(["html", "markdown", "text"]),
            },
            timeout=300,
        )
    if not resp.ok:
        raise RuntimeError(f"HTTP {resp.status_code}: {resp.text[:500]}")
    return resp.json()


def extract_problem_1(md: str) -> str:
    """Return text from the first '1.' marker through (but excluding) '2.'."""
    lines = md.splitlines()
    start = None
    end = len(lines)
    for i, line in enumerate(lines):
        stripped = line.lstrip("# ").lstrip()
        if start is None and re.match(r"^1\.\s", stripped):
            start = i
            continue
        if start is not None and re.match(r"^2\.\s", stripped):
            end = i
            break
    if start is None:
        return "(problem 1 not found)"
    return "\n".join(lines[start:end]).strip()


def score_problem_1(snippet: str) -> dict:
    """Heuristic scoring: does the snippet contain '9', '3', '1/4', '1/2', math?"""
    has_9 = "9" in snippet
    has_3 = "3" in snippet
    has_quarter = bool(re.search(r"(1/4|\\frac\{1\}\{4\}|\^\{?1/4\}?|\^{?1/4}?)", snippet))
    has_half = bool(re.search(r"(1/2|\\frac\{1\}\{2\}|\^\{?-?1/2\}?)", snippet))
    has_pow = bool(re.search(r"(\^|\\frac|sqrt|\\sqrt)", snippet))
    pua_chars = sum(1 for c in snippet if 0xE000 <= ord(c) <= 0xF8FF)
    replacement = snippet.count("�")
    return {
        "has_9": has_9,
        "has_3": has_3,
        "has_1/4": has_quarter,
        "has_1/2": has_half,
        "has_math_op": has_pow,
        "pua_chars": pua_chars,
        "replacement_chars": replacement,
        "length": len(snippet),
    }


def main() -> None:
    load_dotenv(ROOT / ".env")
    api_key = (os.environ.get("UPSTAGE_API_KEY") or "").strip().strip("'\"")
    if not api_key:
        sys.exit("UPSTAGE_API_KEY not set")

    pdf_path = ROOT / PDF_NAME
    if not pdf_path.exists():
        sys.exit(f"PDF not found: {pdf_path}")

    OUT_BASE.mkdir(parents=True, exist_ok=True)

    results = []
    for ocr, mode in itertools.product(OCR_OPTIONS, MODE_OPTIONS):
        tag = f"ocr-{ocr}_mode-{mode}"
        out_dir = OUT_BASE / tag
        out_dir.mkdir(exist_ok=True)
        print(f"\n=== {tag} ===")
        t0 = time.time()
        try:
            data = call_api(api_key, pdf_path, ocr, mode)
        except Exception as e:
            print(f"  ERROR: {e}")
            results.append({"tag": tag, "error": str(e)})
            continue
        elapsed = time.time() - t0

        md = data.get("content", {}).get("markdown", "")
        (out_dir / "raw.json").write_text(
            json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
        )
        (out_dir / "content.md").write_text(md, encoding="utf-8")

        prob1 = extract_problem_1(md)
        (out_dir / "problem_1.md").write_text(prob1, encoding="utf-8")

        score = score_problem_1(prob1)
        score["elapsed_s"] = round(elapsed, 1)
        score["tag"] = tag
        results.append(score)

        print(f"  elapsed: {elapsed:.1f}s")
        print(f"  problem 1 preview:")
        for line in prob1.splitlines()[:6]:
            print(f"    | {line}")
        print(f"  score: 9={score['has_9']} 3={score['has_3']} "
              f"1/4={score['has_1/4']} 1/2={score['has_1/2']} "
              f"math={score['has_math_op']} pua={score['pua_chars']}")

    # Summary
    print("\n\n========= SUMMARY =========")
    header = f"{'tag':<28} {'9':>3} {'3':>3} {'1/4':>4} {'1/2':>4} {'math':>5} {'pua':>4} {'len':>5} {'sec':>5}"
    print(header)
    print("-" * len(header))
    for r in results:
        if "error" in r:
            print(f"{r['tag']:<28} ERROR: {r['error'][:60]}")
            continue
        print(
            f"{r['tag']:<28} "
            f"{str(r['has_9']):>3} {str(r['has_3']):>3} "
            f"{str(r['has_1/4']):>4} {str(r['has_1/2']):>4} "
            f"{str(r['has_math_op']):>5} {r['pua_chars']:>4} "
            f"{r['length']:>5} {r['elapsed_s']:>5}"
        )

    (OUT_BASE / "summary.json").write_text(
        json.dumps(results, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    print(f"\nartifacts → {OUT_BASE.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
