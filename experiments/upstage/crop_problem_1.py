"""Crop the problem-1 region from page 1 for visual inspection."""

from pathlib import Path
from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
SRC = Path(__file__).resolve().parent / "option_a_v4_out" / "page_1.png"
OUT = Path(__file__).resolve().parent / "problem_1_crop.png"

img = Image.open(SRC)
w, h = img.size
# Top-left region — problem 1 is typically in the top-left corner of page 1
# below the header. Use top ~25% of left column.
crop = img.crop((0, int(h * 0.10), w // 2 + 100, int(h * 0.30)))
crop.save(OUT)
print(f"saved {OUT} ({crop.size[0]}x{crop.size[1]})")
