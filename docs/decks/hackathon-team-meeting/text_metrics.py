#!/usr/bin/env python3
"""
Text dimension estimator using PIL with system fonts.

Used by validate_spec.py (pre-build warnings) and check_pptx.py (post-build
verification) to detect text that would overflow its container.

Coordinate system: returns dimensions in **canvas pixels** (1920×1080).
At our canvas DPI (~144), 1pt ≈ 2px.
"""

import math
import sys
from pathlib import Path
from typing import Optional, Tuple

try:
    from PIL import Image, ImageDraw, ImageFont
    PIL_AVAILABLE = True
except ImportError:
    PIL_AVAILABLE = False

# Font search paths (Windows-centric; extend for Mac/Linux if needed)
FONT_DIRS = [
    Path("C:/Windows/Fonts"),
    Path.home() / "AppData/Local/Microsoft/Windows/Fonts",
    Path("/Library/Fonts"),
    Path("/System/Library/Fonts"),
    Path.home() / "Library/Fonts",
    Path("/usr/share/fonts"),
    Path.home() / ".fonts",
]

# Logical font name → list of substrings to search in font filenames.
# Order = preference. First matching file wins.
FONT_ALIASES = {
    "pretendard":          ["pretendard", "malgun", "notosanskr", "notosans-", "arial"],
    "inter":               ["inter", "notosans-", "arial"],
    "geist":               ["geist", "inter", "notosans-", "arial"],
    "geist mono":          ["geistmono", "geist mono", "jetbrainsmono", "ibmplexmono", "consola"],
    "outfit":              ["outfit", "inter", "notosans-", "arial"],
    "manrope":             ["manrope", "inter", "notosans-", "arial"],
    "plus jakarta sans":   ["jakarta", "inter", "notosans-", "arial"],
    "figtree":             ["figtree", "inter", "notosans-", "arial"],
    "work sans":           ["worksans", "work sans", "inter", "notosans-", "arial"],
    "noto sans":           ["notosans-", "arial"],
    "noto sans kr":        ["notosanskr", "malgun", "notosans-", "arial"],
    "noto serif kr":       ["notoserifkr", "notoserif", "times"],
    "libre baskerville":   ["librebaskerville", "baskerville", "georgia", "times"],
    "libre franklin":      ["librefranklin", "franklin", "arial"],
    "crimson pro":         ["crimsonpro", "crimson", "georgia", "times"],
    "ibm plex mono":       ["ibmplexmono", "plexmono", "consola", "courier"],
    "jetbrains mono":      ["jetbrainsmono", "ibmplexmono", "consola", "courier"],
    "bebas neue":          ["bebasneue", "bebas", "impact", "arialbd"],
    "anton":               ["anton", "impact", "arialbd"],
    "archivo black":       ["archivoblack", "arial black", "impact", "arialbd"],
    "playfair display":    ["playfair", "georgia", "times"],
    "cormorant garamond":  ["cormorant", "garamond", "georgia", "times"],
    "jost":                ["jost", "inter", "notosans-", "arial"],
    "lora":                ["lora", "georgia", "times"],
    "merriweather":        ["merriweather", "georgia", "times"],
    "malgun gothic":       ["malgun", "notosanskr", "arial"],
    "suit":                ["suit", "pretendard", "malgun", "notosanskr", "arial"],
}

# Generic fallbacks if nothing matches
GENERIC_FALLBACKS = ["arial", "notosans-", "malgun"]

_FONT_CACHE: dict = {}


def _normalize(name: str) -> str:
    return name.lower().strip().replace("-", "").replace("_", "").replace(" ", "")


def _scan_fonts() -> dict:
    """Return {normalized_filename_stem: full_path_str} for all .ttf/.otf in known dirs."""
    if "_INDEX" in _FONT_CACHE:
        return _FONT_CACHE["_INDEX"]
    index = {}
    for d in FONT_DIRS:
        if not d.exists():
            continue
        for ext in ("*.ttf", "*.TTF", "*.otf", "*.OTF"):
            for f in d.glob(ext):
                key = _normalize(f.stem)
                if key not in index:
                    index[key] = str(f)
    _FONT_CACHE["_INDEX"] = index
    return index


def find_font_file(logical_name: str, bold: bool = False) -> Optional[str]:
    """Find a .ttf/.otf file for the given logical font name. Walks the alias chain."""
    index = _scan_fonts()
    candidates = FONT_ALIASES.get(logical_name.lower().strip(), [logical_name.lower().strip()])
    for cand in list(candidates) + GENERIC_FALLBACKS:
        cand_norm = _normalize(cand)
        # First pass: prefer bold variant if requested
        if bold:
            for key, path in index.items():
                if cand_norm in key and ("bold" in key or "bd" in key or "heavy" in key or "black" in key):
                    return path
        # Second pass: regular variant
        for key, path in index.items():
            if cand_norm in key and not any(s in key for s in ("bold", "italic", "oblique", "light", "thin")):
                return path
        # Third pass: any matching
        for key, path in index.items():
            if cand_norm in key:
                return path
    return None


# Canvas DPI calibration:
#   1920 px wide on a 13.333" slide ≈ 144 DPI.
#   At 72 pt = 1 inch, 1 pt = 2 px on our canvas.
PX_PER_PT = 2.0


def _get_pil_font(font_name: str, size_pt: float, bold: bool = False):
    cache_key = (font_name.lower(), int(size_pt * 10), bold)
    if cache_key in _FONT_CACHE:
        return _FONT_CACHE[cache_key]
    if not PIL_AVAILABLE:
        return None
    path = find_font_file(font_name, bold=bold)
    if path is None:
        font = ImageFont.load_default()
    else:
        try:
            font = ImageFont.truetype(path, int(round(size_pt * PX_PER_PT)))
        except Exception:
            font = ImageFont.load_default()
    _FONT_CACHE[cache_key] = font
    return font


def measure_line_px(text: str, font_name: str, size_pt: float, bold: bool = False) -> float:
    """Width in canvas-px of a single line of text."""
    if not text:
        return 0.0
    if not PIL_AVAILABLE:
        return _fallback_line_width(text, size_pt)
    font = _get_pil_font(font_name, size_pt, bold)
    img = Image.new("RGB", (1, 1))
    draw = ImageDraw.Draw(img)
    try:
        bbox = draw.textbbox((0, 0), text, font=font)
        return float(bbox[2] - bbox[0])
    except Exception:
        return _fallback_line_width(text, size_pt)


def _fallback_line_width(text: str, size_pt: float) -> float:
    """Heuristic char-count width when PIL/font unavailable."""
    # CJK chars ≈ 1.0 em, Latin ≈ 0.55 em
    em_px = size_pt * PX_PER_PT
    width = 0.0
    for ch in text:
        if "　" <= ch <= "鿿" or "가" <= ch <= "힯":
            width += em_px  # CJK full-width
        else:
            width += em_px * 0.55
    return width


def wrap_simulate(text: str, font_name: str, size_pt: float, max_width_px: float, bold: bool = False) -> int:
    """
    Conservative line-count simulation. Returns number of visual lines needed for `text`
    when wrapped to `max_width_px`. Counts explicit \\n + auto-wrap by greedy char fit.

    Korean text uses CJK char-based wrapping (each char is a wrap point). English uses
    word-based wrapping.
    """
    if not text:
        return 1

    explicit_lines = str(text).split("\n")
    total_lines = 0
    em_px_estimate = size_pt * PX_PER_PT * 0.6  # rough mean char width
    for line in explicit_lines:
        if not line:
            total_lines += 1
            continue
        # Skip wrap if line clearly fits
        line_w = measure_line_px(line, font_name, size_pt, bold)
        if line_w <= max_width_px:
            total_lines += 1
            continue
        # Need to wrap — simulate char-by-char (conservative)
        current_w = 0.0
        wraps = 1
        for ch in line:
            ch_w = measure_line_px(ch, font_name, size_pt, bold) or em_px_estimate
            if current_w + ch_w > max_width_px and current_w > 0:
                wraps += 1
                current_w = ch_w
            else:
                current_w += ch_w
        total_lines += wraps
    return total_lines


def estimate_text_box(text: str, font_name: str, size_pt: float, max_width_px: float,
                       line_height: float = 1.4, bold: bool = False) -> Tuple[float, float]:
    """
    Returns (longest_line_width_px, required_height_px) for `text` rendered with the given
    font/size, wrapped to `max_width_px`.
    """
    if not text:
        return 0.0, 0.0
    lines = wrap_simulate(text, font_name, size_pt, max_width_px, bold)
    # Longest single line width (clamped by max_width_px)
    explicit_lines = str(text).split("\n")
    max_w = 0.0
    for line in explicit_lines:
        w = measure_line_px(line, font_name, size_pt, bold)
        if w > max_w:
            max_w = w
    line_h_px = size_pt * PX_PER_PT * line_height
    total_h = lines * line_h_px
    return min(max_w, max_width_px), total_h


def overflow_check(text: str, font_name: str, size_pt: float,
                   box_w_px: float, box_h_px: float,
                   line_height: float = 1.4, bold: bool = False,
                   tolerance: float = 0.05) -> dict:
    """
    Returns dict:
      { fits, severity, width_used, height_used, lines_needed, lines_fit, ratio_h }

    severity:
      "none"   — fits cleanly
      "soft"   — 1-line text slightly taller than box due to line-height padding;
                 visually OK because PPT vertical-anchors text
      "wrap"   — text actually wraps to more lines than the box can hold
      "width"  — single line wider than the box (will get truncated or wrap to 2)
    """
    width_used, height_used = estimate_text_box(text, font_name, size_pt, box_w_px,
                                                 line_height=line_height, bold=bold)
    lines_needed = wrap_simulate(text, font_name, size_pt, box_w_px, bold)
    line_h_px = size_pt * PX_PER_PT * line_height
    # How many lines actually fit in the box (rounded down, but allow a bit slack)
    lines_fit = max(1, int((box_h_px + line_h_px * 0.2) / line_h_px))

    if lines_needed > lines_fit:
        severity = "wrap"
        fits = False
    elif height_used > box_h_px * (1 + tolerance):
        severity = "soft"   # 1 logical line but line-height padding pushes beyond; PPT renders OK
        fits = True
    else:
        severity = "none"
        fits = True

    return {
        "fits": fits,
        "severity": severity,
        "width_used": width_used,
        "width_avail": box_w_px,
        "height_used": height_used,
        "height_avail": box_h_px,
        "lines_needed": lines_needed,
        "lines_fit": lines_fit,
        "ratio_h": height_used / max(box_h_px, 1e-6),
    }


# ─── CLI: quick test ────────────────────────────────────────────────────────
if __name__ == "__main__":
    try:
        sys.stdout.reconfigure(encoding="utf-8")
    except Exception:
        pass

    samples = [
        ("Pretendard", 34, 1760, 100,
         "Q4를 강력하게 마감했다. 매출은 가속, 유지율은 모든 세그먼트에서 개선됐다."),
        ("Pretendard", 26, 500, 80,
         "Usage-based + tier 혼합"),
        ("Pretendard", 16, 500, 200,
         "엔터프라이즈는 commit + overage, SMB는 flat tier 유지. A/B 테스트 2월부터."),
        ("Inter", 36, 1760, 100,
         "We've reached profitability for the first time in 8 quarters."),
    ]
    print(f"PIL available: {PIL_AVAILABLE}")
    print(f"Font index size: {len(_scan_fonts())}\n")
    for font, pt, w, h, text in samples:
        result = overflow_check(text, font, pt, w, h, line_height=1.4)
        path = find_font_file(font)
        print(f"[{font}@{pt}pt → resolved: {Path(path).name if path else 'fallback'}]")
        print(f"  text: {text[:60]!r}")
        print(f"  box:  {w}×{h}px")
        print(f"  used: {result['width_used']:.0f}×{result['height_used']:.0f}px ({result['lines']} lines)")
        print(f"  fits: {result['fits']}  (h ratio {result['ratio_h']:.2f})")
        print()
