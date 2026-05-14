#!/usr/bin/env python3
"""
Spec validator for editable-ppt.

Validates a deck.json against the schema defined in
references/json-spec-schema.md. Run before build to catch errors early.

Usage:
    python validate_spec.py [deck.json]

Exit codes:
    0  spec is valid (warnings may print)
    1  errors found
"""

import json
import re
import sys
from pathlib import Path

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

# Text metrics for overflow detection. Optional — degrades gracefully if PIL missing.
try:
    from text_metrics import overflow_check as _measure_fit
    METRICS_AVAILABLE = True
except Exception:
    METRICS_AVAILABLE = False


# Default type_scale (used when spec.tokens doesn't override and we need font sizes).
# Keep in sync with themes.json's "clean" preset; close enough for measurement.
DEFAULT_TYPE_SCALE = {
    "overline":   {"size": 12, "weight": 700},
    "title":      {"size": 34, "weight": 700},
    "body":       {"size": 19, "weight": 400},
    "card_title": {"size": 20, "weight": 600},
    "card_body":  {"size": 16, "weight": 400},
    "hero":       {"size": 96, "weight": 800},
    "caption":    {"size": 11, "weight": 400},
    "source":     {"size": 9,  "weight": 400},
}
DEFAULT_FONTS = {"display": "Pretendard", "body": "Pretendard", "mono": "JetBrains Mono"}

CANVAS_W = 1920
CANVAS_H = 1080

KNOWN_THEMES = {"clean", "bold", "editorial", "pastel", "dark-tech", "custom"}
KNOWN_LANGUAGES = {"ko", "en", "ko-en"}
KNOWN_LAYOUTS = {"title", "content", "section", "closing", "appendix"}
KNOWN_BLOCK_TYPES = {
    "text", "shape", "image", "icon",
    "chart", "table", "quote", "stat_grid",
    "two_column", "divider",
}
IMPLEMENTED = set(KNOWN_BLOCK_TYPES)  # All 10 block types now implemented (M3 complete)

REQUIRED_BLOCK_FIELDS = {
    "text":      ["value"],
    "shape":     ["shape_kind"],
    "image":     ["src"],
    "icon":      [],
    "chart":     ["chart_kind", "data"],
    "table":     ["headers", "rows"],
    "quote":     ["text"],
    "stat_grid": ["items", "cols", "rows"],
    "two_column":["left", "right"],
    "divider":   [],
}

KNOWN_SHAPE_KINDS = {"rect", "oval", "line", "triangle", "arrow_right", "arrow_down", "chevron_right"}

HEX_RE = re.compile(r"^#[0-9A-Fa-f]{6}$")
TOKEN_COLOR_KEYS = {
    "bg", "surface", "text", "text_muted",
    "accent", "accent_alt", "border",
    "success", "warning", "danger",
}
TOKEN_FONT_ROLES = {"display", "body", "mono"}
TOKEN_ROLES = {
    "overline", "title", "body", "card_title", "card_body",
    "hero", "caption", "source",
}


class Issues:
    def __init__(self):
        self.errors = []
        self.warnings = []

    def err(self, msg):
        self.errors.append(msg)

    def warn(self, msg):
        self.warnings.append(msg)


def is_token_color(value):
    if not isinstance(value, str):
        return False
    return value in TOKEN_COLOR_KEYS


def is_hex_color(value):
    if not isinstance(value, str):
        return False
    return bool(HEX_RE.match(value))


def validate_color(value, where, issues, *, allow_hex=True):
    if value is None:
        return
    if is_token_color(value):
        return
    if allow_hex and is_hex_color(value):
        issues.warn(f"{where}: uses hex literal '{value}' — prefer a token reference ({sorted(TOKEN_COLOR_KEYS)})")
        return
    issues.err(f"{where}: invalid color reference '{value}'")


def _resolve_text_props(style: dict, type_scale: dict, fonts: dict):
    """Resolve font_size, font_name, weight, line_height from a style dict."""
    role = style.get("role") or "body"
    role_defaults = type_scale.get(role, DEFAULT_TYPE_SCALE.get(role, {"size": 18, "weight": 400}))
    size = style.get("font_size", role_defaults.get("size", 18))
    weight = style.get("font_weight", role_defaults.get("weight", 400))
    bold = weight >= 600
    font_key = style.get("font", "body")
    font_name = fonts.get(font_key, font_key) if isinstance(font_key, str) else "Pretendard"
    line_height = style.get("line_height", 1.4)
    return size, font_name, bold, line_height


def _check_text_fit(value: str, w_px: float, h_px: float, padding,
                     style: dict, type_scale: dict, fonts: dict,
                     where: str, issues):
    """Estimate text dimensions and emit warning if it overflows the container."""
    if not METRICS_AVAILABLE or not value:
        return
    size, font_name, bold, line_height = _resolve_text_props(style, type_scale, fonts)
    # Subtract padding from available area
    pad_t, pad_r, pad_b, pad_l = padding or (0, 0, 0, 0)
    avail_w = max(1, w_px - pad_l - pad_r)
    avail_h = max(1, h_px - pad_t - pad_b)
    result = _measure_fit(str(value), font_name, size, avail_w, avail_h,
                          line_height=line_height, bold=bold,
                          tolerance=0.08)
    if not result["fits"]:
        sev = result["severity"]
        if sev == "wrap":
            msg = (f"text wraps to {result['lines_needed']} lines, but box only fits "
                   f"{result['lines_fit']} at {size}pt")
        elif sev == "width":
            msg = (f"single line ({result['width_used']:.0f}px) exceeds box width "
                   f"({result['width_avail']:.0f}px) at {size}pt")
        else:
            msg = (f"text needs ~{result['height_used']:.0f}px in {avail_h:.0f}px box "
                   f"({result['lines_needed']} lines @ {size}pt)")
        issues.warn(
            f"{where}: {msg}. "
            f"Fix: raise h to ≥{int(result['height_used']+8)}px, lower font_size, or shorten text."
        )


def _check_block_text_overflow(block, type_scale, fonts, where, issues):
    """Run text-fit checks for a single block (text or shape with nested text)."""
    btype = block.get("type")
    style = block.get("style") or {}
    if btype == "text":
        value = block.get("value", "")
        padding = style.get("padding", [0, 0, 0, 0])
        _check_text_fit(value, block["w"], block["h"], padding, style, type_scale, fonts, where, issues)
    elif btype == "shape":
        nested = block.get("text")
        if nested:
            nested_style = nested.get("style") or {}
            padding = nested_style.get("padding", [0, 0, 0, 0])
            _check_text_fit(nested.get("value", ""), block["w"], block["h"], padding,
                            nested_style, type_scale, fonts, where + " (nested text)", issues)
    elif btype == "quote":
        text_size = style.get("font_size", 36)
        text_style = {"font": style.get("font", "display"), "font_size": text_size, "line_height": 1.3}
        text_h = block["h"] - 80 - 40
        _check_text_fit(block.get("text", ""), block["w"], text_h, [0, 0, 0, 0],
                        text_style, type_scale, fonts, where + " (quote body)", issues)
    elif btype == "stat_grid":
        # Approximate per-cell value text bounds and check fit.
        cols = block.get("cols", 1)
        rows = block.get("rows", 1)
        items = block.get("items", []) or []
        gutter = style.get("gutter", 24)
        if cols > 0 and rows > 0:
            cell_w = (block["w"] - (cols - 1) * gutter) / cols
            cell_h = (block["h"] - (rows - 1) * gutter) / rows
            value_size = style.get("value_size", 64)
            value_style = {"font": "display", "font_size": value_size, "font_weight": 800, "line_height": 1.0}
            for i, item in enumerate(items[:cols * rows]):
                _check_text_fit(str(item.get("value", "")), cell_w, cell_h * 0.6, [0, 0, 0, 0],
                                value_style, type_scale, fonts,
                                where + f" (stat_grid value [{i}])", issues)


def _check_block_overlaps(blocks, slide_id, issues):
    """Detect coordinate overlap between text blocks (and text-bearing shapes)."""
    text_bearing = []
    for i, b in enumerate(blocks):
        btype = b.get("type")
        if btype == "text" and b.get("value"):
            text_bearing.append((i, b, "text"))
        elif btype == "shape" and b.get("text") and not b.get("text", {}).get("value", "").strip() == "":
            # A shape with nested text — treat its text bounds as the whole shape
            text_bearing.append((i, b, "shape+text"))

    def rect(b):
        return (b["x"], b["y"], b["x"] + b["w"], b["y"] + b["h"])

    def area_overlap(a, b):
        ax1, ay1, ax2, ay2 = rect(a)
        bx1, by1, bx2, by2 = rect(b)
        iw = max(0, min(ax2, bx2) - max(ax1, bx1))
        ih = max(0, min(ay2, by2) - max(ay1, by1))
        return iw * ih

    seen_pairs = set()
    for i, (ia, a, kind_a) in enumerate(text_bearing):
        for j in range(i + 1, len(text_bearing)):
            ib, b, kind_b = text_bearing[j]
            # Explicit z-order means intentional
            if a.get("z") is not None and b.get("z") is not None and a["z"] != b["z"]:
                continue
            area = area_overlap(a, b)
            if area > 100:  # > ~10×10 px
                # Allow text-INSIDE-shape pattern when shape is large and text is small
                if kind_a == "shape+text" and kind_b == "text":
                    # Likely intentional: text on a card. Skip if text fits inside the shape.
                    if (b["x"] >= a["x"] and b["y"] >= a["y"]
                        and b["x"] + b["w"] <= a["x"] + a["w"]
                        and b["y"] + b["h"] <= a["y"] + a["h"]):
                        continue
                if kind_b == "shape+text" and kind_a == "text":
                    if (a["x"] >= b["x"] and a["y"] >= b["y"]
                        and a["x"] + a["w"] <= b["x"] + b["w"]
                        and a["y"] + a["h"] <= b["y"] + b["h"]):
                        continue
                pair_key = (slide_id, ia, ib)
                if pair_key in seen_pairs:
                    continue
                seen_pairs.add(pair_key)
                issues.warn(
                    f"slide '{slide_id}' blocks [{ia}] and [{ib}]: "
                    f"text-bearing blocks overlap by ~{area:.0f}px². "
                    f"Adjust coords or set explicit 'z' to z-order intentionally."
                )


def validate_block(block, slide_id, idx, issues, *, has_data_visual_tracker):
    where = f"slide '{slide_id}' block[{idx}]"

    # Required common fields
    for f in ("type", "x", "y", "w", "h"):
        if f not in block:
            issues.err(f"{where}: missing required field '{f}'")
            return

    btype = block["type"]
    if btype not in KNOWN_BLOCK_TYPES:
        issues.err(f"{where}: unknown block type '{btype}'")
        return

    if btype not in IMPLEMENTED:
        issues.warn(f"{where}: type '{btype}' is reserved (not yet implemented).")

    # Type-specific required fields
    for f in REQUIRED_BLOCK_FIELDS.get(btype, []):
        if f not in block:
            issues.err(f"{where}: type '{btype}' requires field '{f}'")

    # shape_kind validation
    if btype == "shape":
        kind = block.get("shape_kind")
        if kind and kind not in KNOWN_SHAPE_KINDS:
            issues.err(f"{where}: unknown shape_kind '{kind}'. Allowed: {sorted(KNOWN_SHAPE_KINDS)}")

    # Bounds
    x, y, w, h = block.get("x", 0), block.get("y", 0), block.get("w", 0), block.get("h", 0)
    for name, value in (("x", x), ("y", y), ("w", w), ("h", h)):
        if not isinstance(value, (int, float)):
            issues.err(f"{where}: '{name}' must be a number, got {type(value).__name__}")
            return

    if x < 0 or y < 0:
        issues.err(f"{where}: negative coords (x={x}, y={y})")
    if w <= 0 or h <= 0:
        issues.err(f"{where}: non-positive size (w={w}, h={h})")
    if x + w > CANVAS_W:
        issues.err(f"{where}: extends past right edge (x+w={x+w} > {CANVAS_W})")
    if y + h > CANVAS_H:
        issues.err(f"{where}: extends past bottom edge (y+h={y+h} > {CANVAS_H})")

    # Style validation
    style = block.get("style") or {}
    if not isinstance(style, dict):
        issues.err(f"{where}: 'style' must be an object")
        style = {}

    # Color fields
    for color_field in ("fill", "stroke", "font_color", "value_color", "label_color", "mark_color", "color"):
        if color_field in style:
            validate_color(style[color_field], f"{where}.style.{color_field}", issues)

    # Font references
    if "font" in style and style["font"] not in TOKEN_FONT_ROLES:
        issues.err(f"{where}.style.font: must be one of {sorted(TOKEN_FONT_ROLES)}, got '{style['font']}'")

    # Role reference
    if "role" in style and style["role"] not in TOKEN_ROLES:
        issues.err(f"{where}.style.role: must be one of {sorted(TOKEN_ROLES)}, got '{style['role']}'")

    # Font size enforcement (only on text-bearing blocks)
    font_size = style.get("font_size")
    role = style.get("role")
    if btype == "text" and font_size is not None:
        if role == "title" and font_size < 30:
            issues.err(f"{where}: action title font_size={font_size}pt below minimum (30pt)")
        elif role in ("body", "card_body") and font_size < 16:
            issues.err(f"{where}: {role} font_size={font_size}pt below minimum (16pt)")
        elif role == "source" and font_size < 9:
            issues.err(f"{where}: source font_size={font_size}pt below minimum (9pt)")
        elif font_size < 9:
            issues.err(f"{where}: font_size={font_size}pt below absolute floor (9pt)")

    # Track data-visual blocks for hero-number warning later
    if btype in ("chart", "stat_grid", "table"):
        has_data_visual_tracker.append(True)
    if btype == "text" and (
        (font_size and font_size >= 72)
        or role == "hero"
    ):
        has_data_visual_tracker.append("hero")


def validate_slide(slide, idx, issues, type_scale, fonts):
    where = f"slide[{idx}]"
    if not isinstance(slide, dict):
        issues.err(f"{where}: must be an object")
        return

    sid = slide.get("id")
    if not sid:
        issues.err(f"{where}: missing 'id'")
        return
    if not re.match(r"^[a-z0-9][a-z0-9-]*$", sid):
        issues.warn(f"{where}: id '{sid}' is not kebab-case")

    layout = slide.get("layout")
    if layout not in KNOWN_LAYOUTS:
        issues.err(f"slide '{sid}': unknown layout '{layout}'. Allowed: {sorted(KNOWN_LAYOUTS)}")

    blocks = slide.get("blocks")
    if not isinstance(blocks, list) or len(blocks) == 0:
        issues.err(f"slide '{sid}': 'blocks' must be a non-empty list")
        return

    has_data_visual = []
    for bidx, block in enumerate(blocks):
        validate_block(block, sid, bidx, issues, has_data_visual_tracker=has_data_visual)
        # Text fit check
        _check_block_text_overflow(block, type_scale, fonts, f"slide '{sid}' block[{bidx}]", issues)

    # Coordinate overlap among text-bearing blocks
    _check_block_overlaps(blocks, sid, issues)

    # Density warnings (W1, W2)
    if layout == "content" and len(blocks) < 4:
        issues.warn(f"slide '{sid}': only {len(blocks)} blocks — content slides should have 4+ (density rule)")

    has_visual = any(v is True for v in has_data_visual)
    has_hero = any(v == "hero" for v in has_data_visual)
    has_stat_grid_hero = any(
        b.get("type") == "stat_grid" and (b.get("style") or {}).get("value_size", 64) >= 72
        for b in blocks
    )
    # A chart or table itself provides visual impact; the hero rule applies to slides
    # whose main visual is *only* a stat_grid or text.
    has_chart_or_table = any(b.get("type") in ("chart", "table") for b in blocks)
    if has_visual and not (has_hero or has_stat_grid_hero or has_chart_or_table):
        issues.warn(f"slide '{sid}': has stat_grid but no hero-sized text (≥72pt). Boost stat_grid.value_size or add a hero text block.")


def validate(spec):
    issues = Issues()

    # Top-level
    for key in ("meta", "tokens", "slides"):
        if key not in spec:
            issues.err(f"missing top-level key '{key}'")
    if issues.errors:
        return issues

    # meta
    meta = spec["meta"]
    if not isinstance(meta, dict):
        issues.err("'meta' must be an object")
        return issues
    if not meta.get("title"):
        issues.err("meta.title is required")
    if meta.get("theme") not in KNOWN_THEMES:
        issues.err(f"meta.theme '{meta.get('theme')}' is not a known preset. Allowed: {sorted(KNOWN_THEMES)}")
    if meta.get("language") not in KNOWN_LANGUAGES:
        issues.err(f"meta.language '{meta.get('language')}' invalid. Allowed: {sorted(KNOWN_LANGUAGES)}")

    size = meta.get("size", [CANVAS_W, CANVAS_H])
    if size != [CANVAS_W, CANVAS_H]:
        issues.warn(f"meta.size {size} is non-standard. Builder assumes 1920×1080.")

    # tokens (lenient: empty object is OK — preset defaults will fill in)
    tokens = spec["tokens"]
    if not isinstance(tokens, dict):
        issues.err("'tokens' must be an object")

    # slides
    slides = spec["slides"]
    if not isinstance(slides, list) or len(slides) == 0:
        issues.err("'slides' must be a non-empty list")
        return issues

    # Resolve effective type_scale + fonts for overflow checks
    type_scale = dict(DEFAULT_TYPE_SCALE)
    fonts = dict(DEFAULT_FONTS)
    spec_tokens = spec.get("tokens") or {}
    if isinstance(spec_tokens, dict):
        for k, v in (spec_tokens.get("type_scale") or {}).items():
            type_scale[k] = v
        for k, v in (spec_tokens.get("fonts") or {}).items():
            fonts[k] = v

    seen_ids = set()
    for i, slide in enumerate(slides):
        sid = slide.get("id") if isinstance(slide, dict) else None
        if sid and sid in seen_ids:
            issues.err(f"duplicate slide id '{sid}'")
        if sid:
            seen_ids.add(sid)
        validate_slide(slide, i, issues, type_scale, fonts)

    return issues


def main():
    path = Path(sys.argv[1]) if len(sys.argv) > 1 else Path("deck.json")
    if not path.exists():
        print(f"❌ Spec file not found: {path}")
        sys.exit(1)

    spec = json.loads(path.read_text(encoding="utf-8"))
    issues = validate(spec)

    for w in issues.warnings:
        print(f"⚠️  {w}")
    for e in issues.errors:
        print(f"❌ {e}")

    if issues.errors:
        print(f"\n✗ Validation failed: {len(issues.errors)} error(s), {len(issues.warnings)} warning(s)")
        sys.exit(1)

    print(f"\n✓ Spec is valid — {len(spec['slides'])} slide(s), {len(issues.warnings)} warning(s)")
    sys.exit(0)


if __name__ == "__main__":
    main()
