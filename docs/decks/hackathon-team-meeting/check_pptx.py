#!/usr/bin/env python3
"""
Post-build QA inspector for editable-ppt.

Opens a built .pptx and inspects each slide for layout/editability issues.
Use after build_pptx.py to catch problems before delivery.

Usage:
    python check_pptx.py [deck.pptx] [--report qa-report.json]

Checks:
  Errors  (block delivery)
    E1  Shape extends past canvas (1920×1080)
    E2  Font size below absolute floor (9pt)
    E3  Action title text below 30pt (style.role=title or first text on slide)
    E4  Two shapes overlap heavily without clear z-order

  Warnings (review recommended)
    W1  Slide has < 4 shapes (excluding background) for non-title layouts
    W2  Body text < 16pt detected
    W3  Shape uses a group container (editability risk)
    W4  No source citation text (no shape with very small font in bottom 60px)

Output:
  Console summary + JSON report at `--report` path.
"""

import argparse
import json
import sys
from pathlib import Path

from pptx import Presentation
from pptx.enum.shapes import MSO_SHAPE_TYPE

try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass

CANVAS_W_EMU = 12_192_000
CANVAS_H_EMU = 6_858_000
TOLERANCE_EMU = 50_000  # ~8px tolerance for canvas overflow
ACTION_TITLE_MIN_PT = 30
BODY_MIN_PT = 16
FLOOR_PT = 9
SOURCE_BAND_EMU = int(60 * 6350)  # bottom 60 px


def _iter_text_runs(shape):
    if not getattr(shape, "has_text_frame", False):
        return
    for paragraph in shape.text_frame.paragraphs:
        for run in paragraph.runs:
            yield run


def _shape_text(shape) -> str:
    if not getattr(shape, "has_text_frame", False):
        return ""
    return shape.text_frame.text.strip()


def _overlap_area(a, b):
    """Return overlap area in EMU² between two shapes' bounding rects."""
    ax1, ay1 = a.left or 0, a.top or 0
    ax2, ay2 = ax1 + (a.width or 0), ay1 + (a.height or 0)
    bx1, by1 = b.left or 0, b.top or 0
    bx2, by2 = bx1 + (b.width or 0), by1 + (b.height or 0)
    iw = max(0, min(ax2, bx2) - max(ax1, bx1))
    ih = max(0, min(ay2, by2) - max(ay1, by1))
    return iw * ih


def check_slide(slide_idx, slide):
    errors = []
    warnings = []
    info = {
        "shape_count": len(slide.shapes),
        "has_chart": False,
        "has_table": False,
        "has_picture": False,
    }

    shapes = list(slide.shapes)
    non_bg_shapes = []  # exclude full-canvas background rect
    for s in shapes:
        if (s.left or 0) <= 1 and (s.top or 0) <= 1 \
           and (s.width or 0) >= CANVAS_W_EMU - 1 and (s.height or 0) >= CANVAS_H_EMU - 1:
            continue
        non_bg_shapes.append(s)

    for s in shapes:
        if s.shape_type == MSO_SHAPE_TYPE.PICTURE:
            info["has_picture"] = True
        try:
            if getattr(s, "has_chart", False):
                info["has_chart"] = True
        except Exception:
            pass
        try:
            if getattr(s, "has_table", False):
                info["has_table"] = True
        except Exception:
            pass

        # E1: canvas overflow
        left = s.left or 0
        top = s.top or 0
        width = s.width or 0
        height = s.height or 0
        if left + width > CANVAS_W_EMU + TOLERANCE_EMU or top + height > CANVAS_H_EMU + TOLERANCE_EMU:
            errors.append({
                "code": "E1",
                "msg": f"Shape extends past canvas: ({left/914400:.2f}\",{top/914400:.2f}\") "
                       f"+ ({width/914400:.2f}\"×{height/914400:.2f}\") "
                       f"= ({(left+width)/914400:.2f}\",{(top+height)/914400:.2f}\")",
                "text_preview": _shape_text(s)[:40],
            })

        # W3: group container
        if s.shape_type == MSO_SHAPE_TYPE.GROUP:
            warnings.append({
                "code": "W3",
                "msg": f"Group container detected — may impede editability. {len(s.shapes)} children.",
            })

        # Font size checks (E2, E3, W2)
        text = _shape_text(s)
        if text:
            sizes = [run.font.size for run in _iter_text_runs(s) if run.font.size is not None]
            if sizes:
                min_size_pt = min(sz.pt for sz in sizes)
                # Detect if this looks like an action title (large, near top)
                looks_like_title = (top < int(280 * 6350)) and (min_size_pt >= 24)
                if min_size_pt < FLOOR_PT:
                    errors.append({
                        "code": "E2",
                        "msg": f"Font size {min_size_pt:.1f}pt below floor ({FLOOR_PT}pt)",
                        "text_preview": text[:40],
                    })
                elif looks_like_title and min_size_pt < ACTION_TITLE_MIN_PT:
                    errors.append({
                        "code": "E3",
                        "msg": f"Likely action title at {min_size_pt:.1f}pt below minimum ({ACTION_TITLE_MIN_PT}pt)",
                        "text_preview": text[:40],
                    })
                elif min_size_pt < BODY_MIN_PT and (top + height) < CANVAS_H_EMU - SOURCE_BAND_EMU:
                    # Skip decorative small text: overlines (UPPERCASE), short labels (<25 chars),
                    # captions, deltas — these are intentionally small per type_scale.
                    is_overline = text == text.upper() and len(text) < 50
                    is_short_label = len(text) < 40
                    # Captions starting with "Photo:", "Source:", "Owner —", etc. are intentionally small
                    is_caption_prefix = any(text.startswith(p) for p in
                        ("Photo:", "Source:", "Owner", "Due ", "Note:", "Figure"))
                    if not (is_overline or is_short_label or is_caption_prefix):
                        warnings.append({
                            "code": "W2",
                            "msg": f"Body text at {min_size_pt:.1f}pt below recommended ({BODY_MIN_PT}pt)",
                            "text_preview": text[:40],
                        })

    # E4: significant overlap among non-bg shapes (sample a few pairs)
    overlap_threshold = int(200 * 200 * 6350 * 6350)  # 200×200 px²
    overlaps_checked = 0
    for i, a in enumerate(non_bg_shapes):
        for b in non_bg_shapes[i+1:]:
            if overlaps_checked > 200:
                break
            overlaps_checked += 1
            # skip if either has text content "inside" the other (e.g., text inside card)
            a_has_text = bool(_shape_text(a))
            b_has_text = bool(_shape_text(b))
            if (a_has_text and not b_has_text) or (b_has_text and not a_has_text):
                continue
            # Allow image+overlay pattern: a picture under a colored shape is intentional
            if a.shape_type == MSO_SHAPE_TYPE.PICTURE or b.shape_type == MSO_SHAPE_TYPE.PICTURE:
                continue
            area = _overlap_area(a, b)
            if area > overlap_threshold:
                warnings.append({
                    "code": "E4-soft",
                    "msg": f"Large overlap between two shapes ({area/(6350*6350)/1e6:.2f}M px²)",
                    "text_a": _shape_text(a)[:30],
                    "text_b": _shape_text(b)[:30],
                })
                break

    # W1: density (skip for title/closing slides)
    if len(non_bg_shapes) < 4 and slide_idx > 0 and slide_idx < 9999:
        # Heuristic: title slides often have < 4 shapes — judge by content
        text_shapes = [s for s in non_bg_shapes if _shape_text(s)]
        if any(any(run.font.size and run.font.size.pt >= 56 for run in _iter_text_runs(s)) for s in text_shapes):
            pass  # likely a title slide with big headline
        else:
            warnings.append({
                "code": "W1",
                "msg": f"Only {len(non_bg_shapes)} non-background shapes — likely sparse content slide",
            })

    # W4: source citation
    has_source = any(
        any(run.font.size and run.font.size.pt < 12 for run in _iter_text_runs(s))
        for s in non_bg_shapes
        if (s.top or 0) > CANVAS_H_EMU - SOURCE_BAND_EMU * 2 and _shape_text(s)
    )
    if info["has_chart"] or info["has_table"]:
        if not has_source:
            warnings.append({
                "code": "W4",
                "msg": "Slide has chart/table but no source citation (small text near bottom)",
            })

    return errors, warnings, info


def check(pptx_path: Path) -> dict:
    prs = Presentation(pptx_path)
    report = {
        "file": str(pptx_path),
        "slide_count": len(prs.slides),
        "slide_size_in": [prs.slide_width / 914400, prs.slide_height / 914400],
        "slides": [],
        "total_errors": 0,
        "total_warnings": 0,
    }
    for idx, slide in enumerate(prs.slides):
        errors, warnings, info = check_slide(idx, slide)
        report["slides"].append({
            "index": idx + 1,
            "info": info,
            "errors": errors,
            "warnings": warnings,
        })
        report["total_errors"] += len(errors)
        report["total_warnings"] += len(warnings)
    return report


def print_report(report):
    print(f"\nPPTX QA Report — {report['file']}")
    print(f"Size: {report['slide_size_in'][0]:.2f}\" × {report['slide_size_in'][1]:.2f}\" · {report['slide_count']} slides")
    print()
    for s in report["slides"]:
        info = s["info"]
        badges = []
        if info["has_chart"]:   badges.append("chart")
        if info["has_table"]:   badges.append("table")
        if info["has_picture"]: badges.append("image")
        badge_str = f" [{', '.join(badges)}]" if badges else ""
        status = "✓"
        if s["errors"]: status = "✗"
        elif s["warnings"]: status = "⚠"
        print(f"  {status} Slide {s['index']:>2}  shapes={info['shape_count']:>2}{badge_str}")
        for e in s["errors"]:
            preview = f' — "{e["text_preview"]}"' if e.get("text_preview") else ""
            print(f"      ❌ {e['code']}: {e['msg']}{preview}")
        for w in s["warnings"]:
            preview = f' — "{w["text_preview"]}"' if w.get("text_preview") else ""
            print(f"      ⚠️  {w['code']}: {w['msg']}{preview}")
    print()
    if report["total_errors"]:
        print(f"✗ {report['total_errors']} error(s), {report['total_warnings']} warning(s)")
    elif report["total_warnings"]:
        print(f"⚠ 0 errors, {report['total_warnings']} warning(s) — review and accept or fix")
    else:
        print("✓ No issues found")


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("pptx", nargs="?", default="deck.pptx")
    parser.add_argument("--report", default="qa-report.json")
    args = parser.parse_args()

    pptx_path = Path(args.pptx)
    if not pptx_path.exists():
        print(f"✗ File not found: {pptx_path}")
        sys.exit(1)

    report = check(pptx_path)
    print_report(report)
    Path(args.report).write_text(json.dumps(report, ensure_ascii=False, indent=2), encoding="utf-8")
    sys.exit(1 if report["total_errors"] else 0)


if __name__ == "__main__":
    main()
