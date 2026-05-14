"""Option A v5 — ultra-tight crop around problem 1 alone.

If the IE model reads this small region correctly when it fills the frame,
the bottleneck is relative size of inline math in the input. We then
adopt per-problem tight crops as the production strategy.
"""

import base64
import json
import os
import sys
import time
from pathlib import Path

from PIL import Image
import requests
from dotenv import load_dotenv

ENDPOINT = "https://api.upstage.ai/v1/information-extraction"
MODEL = "information-extract"

ROOT = Path(__file__).resolve().parents[2]
SRC_IMG = Path(__file__).resolve().parent / "option_a_v4_out" / "page_1.png"
OUT_DIR = Path(__file__).resolve().parent / "option_a_v5_out"

SCHEMA = {
    "type": "json_schema",
    "json_schema": {
        "name": "single_problem",
        "schema": {
            "type": "object",
            "description": (
                "이 이미지에는 수능 수학 문항 한 문제와 그 선택지가 들어있다. "
                "이미지에서 명확히 보이는 내용만 추출. 추측·환각 금지. "
                "수식은 LaTeX. 인라인 $...$, 블록 $$...$$. "
                "지수 $a^{b}$, 분수 $\\frac{a}{b}$ 형태로 정확히."
            ),
            "properties": {
                "number": {"type": "integer", "description": "문항 번호."},
                "points": {"type": "integer", "description": "배점 (2/3/4). 없으면 0."},
                "question": {
                    "type": "string",
                    "description": (
                        "문항 본문. 모든 수식 LaTeX. "
                        "예시: '$9^{\\frac{1}{4}} \\times 3^{-\\frac{1}{2}}$의 값은?'. "
                        "[N점] 표기는 본문에 포함 금지."
                    ),
                },
                "choices": {
                    "type": "array",
                    "description": "5지선다 5개. ①②③④⑤ 마커 제외, 내용만 LaTeX.",
                    "items": {"type": "string"},
                },
            },
            "required": ["number", "points", "question", "choices"],
        },
    },
}


def call_ie(api_key: str, image_path: Path) -> dict:
    b64 = base64.b64encode(image_path.read_bytes()).decode("ascii")
    payload = {
        "model": MODEL,
        "messages": [{
            "role": "user",
            "content": [{
                "type": "image_url",
                "image_url": {"url": f"data:application/octet-stream;base64,{b64}"},
            }],
        }],
        "response_format": SCHEMA,
    }
    backoff = 15
    for attempt in range(5):
        resp = requests.post(
            ENDPOINT,
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json=payload, timeout=600,
        )
        if resp.status_code == 429:
            print(f"  429, sleep {backoff}s")
            time.sleep(backoff); backoff *= 2; continue
        if not resp.ok:
            print(f"  HTTP {resp.status_code}: {resp.text[:800]}")
            resp.raise_for_status()
        return resp.json()
    raise RuntimeError("retries exhausted")


def main() -> None:
    load_dotenv(ROOT / ".env")
    api_key = (os.environ.get("UPSTAGE_API_KEY") or "").strip().strip("'\"")
    OUT_DIR.mkdir(parents=True, exist_ok=True)

    img = Image.open(SRC_IMG)
    w, h = img.size
    # Problem 1 region (visually confirmed from problem_1_crop.png):
    # roughly y=0.18~0.28h, x=0.0~0.55w of page 1.
    crop_box = (
        int(w * 0.02),
        int(h * 0.16),
        int(w * 0.55),
        int(h * 0.28),
    )
    tight = img.crop(crop_box)
    tight_path = OUT_DIR / "problem_1_tight.png"
    tight.save(tight_path)
    print(f"crop size: {tight.size}, saved → {tight_path.name}")

    print("\n→ IE call")
    t0 = time.time()
    data = call_ie(api_key, tight_path)
    elapsed = time.time() - t0

    (OUT_DIR / "raw.json").write_text(
        json.dumps(data, ensure_ascii=False, indent=2), encoding="utf-8"
    )
    content = data["choices"][0]["message"]["content"]
    parsed = json.loads(content)
    (OUT_DIR / "parsed.json").write_text(
        json.dumps(parsed, ensure_ascii=False, indent=2), encoding="utf-8"
    )

    usage = data.get("usage", {})
    print(f"  elapsed: {elapsed:.1f}s, tokens: {usage.get('total_tokens', '?')}")
    print(f"\n--- result ---")
    print(f"  number:   {parsed.get('number')}")
    print(f"  points:   {parsed.get('points')}")
    print(f"  question: {parsed.get('question')}")
    for i, c in enumerate(parsed.get("choices") or []):
        print(f"  ({i+1}) {c}")


if __name__ == "__main__":
    main()
