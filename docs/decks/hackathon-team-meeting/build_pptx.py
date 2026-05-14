#!/usr/bin/env python3
"""
Builder for editable-ppt — converts deck.json into a native .pptx.

Spec format:        references/json-spec-schema.md
Component reference: references/components.md
Editability rules:  references/editability-rules.md

Implements all 10 block types: text, shape, image, icon, chart, table, quote,
stat_grid, two_column, divider. Each block produces native PPTX shapes that
remain individually editable in PowerPoint.

Usage:
    python build_pptx.py [deck.json] [--out deck.pptx] [--themes themes.json]

Requirements:
    pip install python-pptx Pillow lxml
"""

import argparse
import copy
import json
import sys
from pathlib import Path
from urllib.parse import urlparse
from urllib.request import urlopen

from lxml import etree
from pptx import Presentation
from pptx.chart.data import CategoryChartData, XyChartData
from pptx.dml.color import RGBColor
from pptx.enum.chart import XL_CHART_TYPE, XL_LEGEND_POSITION, XL_LABEL_POSITION
from pptx.enum.shapes import MSO_SHAPE, MSO_CONNECTOR
from pptx.enum.text import MSO_ANCHOR, MSO_AUTO_SIZE, PP_ALIGN
from pptx.oxml.ns import qn
from pptx.util import Emu, Pt

# Text metrics for overflow detection — optional dependency, degrades gracefully
try:
    from text_metrics import overflow_check as _measure_fit
    METRICS_AVAILABLE = True
except Exception:
    METRICS_AVAILABLE = False

# Force UTF-8 on Windows consoles
try:
    sys.stdout.reconfigure(encoding="utf-8")
    sys.stderr.reconfigure(encoding="utf-8")
except Exception:
    pass


# ─── Constants ──────────────────────────────────────────────────────────────
CANVAS_W_PX = 1920
CANVAS_H_PX = 1080
EMU_PER_PX = 6350
SLIDE_W_EMU = CANVAS_W_PX * EMU_PER_PX
SLIDE_H_EMU = CANVAS_H_PX * EMU_PER_PX


# ─── Unit conversion ────────────────────────────────────────────────────────
def px(n: float) -> Emu:
    return Emu(int(round(n * EMU_PER_PX)))


# ─── Theme + token resolution ───────────────────────────────────────────────
def load_themes(themes_path: Path) -> dict:
    return json.loads(themes_path.read_text(encoding="utf-8"))


def deep_merge(base: dict, override: dict) -> dict:
    out = copy.deepcopy(base)
    for k, v in override.items():
        if k.startswith("_"):
            continue
        if k in out and isinstance(out[k], dict) and isinstance(v, dict):
            out[k] = deep_merge(out[k], v)
        else:
            out[k] = copy.deepcopy(v)
    return out


def resolve_theme(spec: dict, themes: dict) -> dict:
    name = spec["meta"]["theme"]
    if name == "custom":
        preset = {}
    else:
        preset = themes.get(name)
        if preset is None:
            raise ValueError(f"Unknown theme '{name}'. Known: {list(themes)}")
        preset = {k: v for k, v in preset.items() if not k.startswith("_")}
    return deep_merge(preset, spec.get("tokens") or {})


def resolve_color(value, theme: dict, default: str = "text") -> RGBColor:
    if value is None:
        value = default
    if isinstance(value, str) and value.startswith("#") and len(value) == 7:
        return RGBColor.from_string(value[1:])
    colors = theme.get("colors", {})
    hex_str = colors.get(value)
    if hex_str is None:
        hex_str = colors.get(default, "#000000")
    return RGBColor.from_string(hex_str[1:] if hex_str.startswith("#") else hex_str)


def resolve_font_name(role_or_name, theme: dict, default_role: str = "body") -> str:
    fonts = theme.get("fonts", {})
    if role_or_name in fonts:
        return fonts[role_or_name]
    if isinstance(role_or_name, str) and role_or_name:
        return role_or_name
    return fonts.get(default_role, "Pretendard")


def resolve_text_style(style: dict, theme: dict, default_role: str = "body") -> dict:
    role = style.get("role") or default_role
    role_defaults = theme.get("type_scale", {}).get(role, {})
    font_size = style.get("font_size", role_defaults.get("size", 18))
    font_weight = style.get("font_weight", role_defaults.get("weight", 400))
    tracking = style.get("tracking", role_defaults.get("tracking", 0))
    font_name = resolve_font_name(style.get("font", "body"), theme)
    return {
        "size_pt":     font_size,
        "weight":      font_weight,
        "bold":        font_weight >= 600,
        "tracking":    tracking,
        "name":        font_name,
        "color":       resolve_color(style.get("font_color", "text"), theme),
        "align":       style.get("align", "left"),
        "valign":      style.get("valign", "top"),
        "line_height": style.get("line_height", 1.4),
        "padding":     style.get("padding", [0, 0, 0, 0]),
        "auto_fit":    style.get("auto_fit", "auto"),  # auto | shrink | none
    }


# Overflow tracking (printed once per build)
_OVERFLOW_AUTO_FIXED = []


def _maybe_auto_shrink(tf, value: str, text_style: dict, box_w_px: float, box_h_px: float,
                        slide_id: str, block_id: str):
    """
    Decide whether to enable PowerPoint's auto-shrink-text-to-fit on this text frame.

    Modes (text_style['auto_fit']):
      'shrink' — always enable (user opt-in)
      'none'   — never enable
      'auto'   — enable only when validator-style overflow detected (default)

    Returns True if auto-shrink was applied.
    """
    mode = text_style.get("auto_fit", "auto")
    if mode == "none":
        return False
    if mode == "shrink":
        tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
        return True
    # mode == "auto"
    if not METRICS_AVAILABLE or not value:
        return False
    pad_t, pad_r, pad_b, pad_l = text_style["padding"] or (0, 0, 0, 0)
    avail_w = max(1, box_w_px - pad_l - pad_r)
    avail_h = max(1, box_h_px - pad_t - pad_b)
    result = _measure_fit(str(value), text_style["name"], text_style["size_pt"],
                          avail_w, avail_h,
                          line_height=text_style["line_height"],
                          bold=text_style["bold"],
                          tolerance=0.10)
    if not result["fits"] and result["severity"] == "wrap":
        # Overflow detected — enable runtime auto-shrink so PowerPoint adjusts gracefully
        tf.auto_size = MSO_AUTO_SIZE.TEXT_TO_FIT_SHAPE
        _OVERFLOW_AUTO_FIXED.append({
            "slide": slide_id, "block": block_id,
            "preview": str(value)[:40],
            "needed_lines": result["lines_needed"],
            "fit_lines": result["lines_fit"],
        })
        return True
    return False


# ─── Alignment maps ─────────────────────────────────────────────────────────
H_ALIGN_MAP = {"left": PP_ALIGN.LEFT, "center": PP_ALIGN.CENTER, "right": PP_ALIGN.RIGHT, "justify": PP_ALIGN.JUSTIFY}
V_ANCHOR_MAP = {"top": MSO_ANCHOR.TOP, "middle": MSO_ANCHOR.MIDDLE, "bottom": MSO_ANCHOR.BOTTOM}


# ─── XML helpers ────────────────────────────────────────────────────────────
def _set_solid_fill_alpha(fill_element, alpha: float):
    if alpha is None or alpha >= 1.0:
        return
    srgb = fill_element.find(qn("a:srgbClr"))
    if srgb is None:
        return
    for existing in srgb.findall(qn("a:alpha")):
        srgb.remove(existing)
    alpha_el = etree.SubElement(srgb, qn("a:alpha"))
    alpha_el.set("val", str(int(round(alpha * 100000))))


def set_shape_fill_alpha(shape, alpha: float):
    if alpha is None or alpha >= 1.0:
        return
    sp_pr = shape.fill._xPr.find(qn("a:solidFill"))
    if sp_pr is not None:
        _set_solid_fill_alpha(sp_pr, alpha)


def set_run_letter_spacing(run, em: float, font_size_pt: float):
    if not em:
        return
    spc_val = int(round(em * font_size_pt * 100))
    r_pr = run._r.get_or_add_rPr()
    r_pr.set("spc", str(spc_val))


# ─── Image resolution ───────────────────────────────────────────────────────
def _resolve_image_path(src: str):
    """Returns a local path string, or None if download failed (caller handles fallback)."""
    parsed = urlparse(src)
    if parsed.scheme in ("http", "https"):
        cache_dir = Path(".image-cache")
        cache_dir.mkdir(exist_ok=True)
        name = Path(parsed.path).name or "image"
        if "." not in name:
            name += ".jpg"
        local = cache_dir / name
        if not local.exists():
            try:
                with urlopen(src, timeout=15) as resp:
                    local.write_bytes(resp.read())
            except Exception as e:
                print(f"⚠️  Failed to fetch image {src}: {e}", file=sys.stderr)
                return None
        return str(local)
    if not Path(src).exists():
        print(f"⚠️  Image not found: {src}", file=sys.stderr)
        return None
    return src


# ─── Background ─────────────────────────────────────────────────────────────
def render_background(slide, bg_spec, theme):
    if not bg_spec:
        bg_spec = {"type": "fill", "color": "bg"}
    bg_type = bg_spec.get("type", "fill")
    if bg_type == "fill":
        rect = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W_EMU, SLIDE_H_EMU)
        rect.fill.solid()
        rect.fill.fore_color.rgb = resolve_color(bg_spec.get("color", "bg"), theme, default="bg")
        rect.line.fill.background()
        spTree = rect._element.getparent()
        spTree.remove(rect._element)
        spTree.insert(2, rect._element)
    elif bg_type == "image":
        slide.shapes.add_picture(_resolve_image_path(bg_spec["src"]), 0, 0, SLIDE_W_EMU, SLIDE_H_EMU)
        overlay = bg_spec.get("overlay")
        if overlay:
            o = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, 0, 0, SLIDE_W_EMU, SLIDE_H_EMU)
            o.fill.solid()
            o.fill.fore_color.rgb = resolve_color(overlay.get("color", "bg"), theme)
            o.line.fill.background()
            set_shape_fill_alpha(o, overlay.get("alpha", 0.5))


# ─── Text writer ────────────────────────────────────────────────────────────
def _set_text_frame_padding(tf, padding_px):
    if not padding_px or padding_px == [0, 0, 0, 0]:
        tf.margin_top = tf.margin_right = tf.margin_bottom = tf.margin_left = Emu(0)
        return
    t, r, b, l = padding_px
    tf.margin_top = px(t)
    tf.margin_right = px(r)
    tf.margin_bottom = px(b)
    tf.margin_left = px(l)


def _write_text(tf, value: str, text_style: dict, box_w_px: float = None, box_h_px: float = None,
                slide_id: str = "", block_id: str = ""):
    tf.word_wrap = True
    tf.auto_size = MSO_AUTO_SIZE.NONE
    # Optional auto-shrink fallback (only kicks in if overflow detected or explicitly requested)
    if box_w_px is not None and box_h_px is not None:
        _maybe_auto_shrink(tf, value, text_style, box_w_px, box_h_px, slide_id, block_id)
    _set_text_frame_padding(tf, text_style["padding"])
    tf.vertical_anchor = V_ANCHOR_MAP.get(text_style["valign"], MSO_ANCHOR.TOP)
    lines = str(value).split("\n")
    for i, line in enumerate(lines):
        p = tf.paragraphs[0] if i == 0 else tf.add_paragraph()
        for r in list(p.runs):
            r._r.getparent().remove(r._r)
        p.alignment = H_ALIGN_MAP.get(text_style["align"], PP_ALIGN.LEFT)
        p.line_spacing = text_style["line_height"]
        run = p.add_run()
        run.text = line
        run.font.name = text_style["name"]
        run.font.size = Pt(text_style["size_pt"])
        run.font.bold = text_style["bold"]
        run.font.color.rgb = text_style["color"]
        if text_style["tracking"]:
            set_run_letter_spacing(run, text_style["tracking"], text_style["size_pt"])


def _add_text_block(slide, x_px, y_px, w_px, h_px, value, style: dict, theme: dict,
                    default_role="body", slide_id="", block_id=""):
    tb = slide.shapes.add_textbox(px(x_px), px(y_px), px(w_px), px(h_px))
    text_style = resolve_text_style(style or {}, theme, default_role)
    _write_text(tb.text_frame, value, text_style, w_px, h_px, slide_id, block_id)
    return tb


# ─── 1. text ────────────────────────────────────────────────────────────────
def render_text(slide, block, theme, language):
    return _add_text_block(
        slide, block["x"], block["y"], block["w"], block["h"],
        block["value"], block.get("style", {}), theme,
        default_role="body",
        slide_id=getattr(slide, "_slide_id", ""),
        block_id=block.get("id", ""),
    )


# ─── 2. shape ───────────────────────────────────────────────────────────────
SHAPE_KIND_MAP = {
    "rect":          MSO_SHAPE.RECTANGLE,
    "oval":          MSO_SHAPE.OVAL,
    "triangle":      MSO_SHAPE.ISOSCELES_TRIANGLE,
    "arrow_right":   MSO_SHAPE.RIGHT_ARROW,
    "arrow_down":    MSO_SHAPE.DOWN_ARROW,
    "chevron_right": MSO_SHAPE.CHEVRON,
}


def _resolve_radius_px(radius_spec, theme: dict) -> float:
    if radius_spec is None:
        return 0
    if isinstance(radius_spec, (int, float)):
        return float(radius_spec)
    if isinstance(radius_spec, str):
        return float(theme.get("radius", {}).get(radius_spec, 0))
    return 0


def render_shape(slide, block, theme, language):
    style = block.get("style", {}) or {}
    kind = block["shape_kind"]
    w_px, h_px = block["w"], block["h"]
    x_emu, y_emu = px(block["x"]), px(block["y"])
    w_emu, h_emu = px(w_px), px(h_px)

    radius_px = _resolve_radius_px(style.get("radius"), theme)
    if kind == "rect" and radius_px > 0:
        shape_type = MSO_SHAPE.ROUNDED_RECTANGLE
    else:
        shape_type = SHAPE_KIND_MAP.get(kind, MSO_SHAPE.RECTANGLE)

    shape = slide.shapes.add_shape(shape_type, x_emu, y_emu, w_emu, h_emu)

    if shape_type == MSO_SHAPE.ROUNDED_RECTANGLE and radius_px > 0:
        smaller_px = min(w_px, h_px)
        if smaller_px > 0:
            try:
                shape.adjustments[0] = min(0.5, radius_px / smaller_px)
            except Exception:
                pass

    fill_value = style.get("fill")
    if fill_value:
        shape.fill.solid()
        shape.fill.fore_color.rgb = resolve_color(fill_value, theme)
        set_shape_fill_alpha(shape, style.get("fill_alpha", 1.0))
    else:
        shape.fill.background()

    stroke_w = style.get("stroke_width", 0)
    if stroke_w and stroke_w > 0:
        shape.line.color.rgb = resolve_color(style.get("stroke", "border"), theme)
        shape.line.width = px(stroke_w)
    else:
        shape.line.fill.background()

    nested = block.get("text")
    if nested:
        text_style = resolve_text_style(nested.get("style", {}) or {}, theme, default_role="card_body")
        _write_text(shape.text_frame, nested["value"], text_style,
                     w_px, h_px,
                     getattr(slide, "_slide_id", ""),
                     block.get("id", "") + "/text")

    return shape


# ─── 3. image ───────────────────────────────────────────────────────────────
def render_image(slide, block, theme, language):
    src = _resolve_image_path(block["src"])
    x_emu, y_emu = px(block["x"]), px(block["y"])
    w_emu, h_emu = px(block["w"]), px(block["h"])
    if src is None:
        # Fallback: render a neutral placeholder rect so layout doesn't collapse
        ph = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x_emu, y_emu, w_emu, h_emu)
        ph.fill.solid()
        ph.fill.fore_color.rgb = resolve_color("surface", theme)
        ph.line.color.rgb = resolve_color("border", theme)
        ph.line.width = px(1)
        return ph
    pic = slide.shapes.add_picture(src, x_emu, y_emu, w_emu, h_emu)
    crop = block.get("crop")
    if crop:
        try:
            pic.crop_left = float(crop.get("left", 0))
            pic.crop_top = float(crop.get("top", 0))
            pic.crop_right = float(crop.get("right", 0))
            pic.crop_bottom = float(crop.get("bottom", 0))
        except Exception:
            pass
    overlay = block.get("overlay")
    if overlay:
        o = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, x_emu, y_emu, w_emu, h_emu)
        o.fill.solid()
        o.fill.fore_color.rgb = resolve_color(overlay.get("color", "bg"), theme)
        o.line.fill.background()
        set_shape_fill_alpha(o, overlay.get("alpha", 0.5))
    return pic


# ─── 4. icon ────────────────────────────────────────────────────────────────
ICON_GLYPHS = {
    "arrow_right": "→",  "arrow_left": "←",  "arrow_up": "↑",  "arrow_down": "↓",
    "check":       "✓",  "x":          "✗",
    "star":        "★",  "lightning":  "⚡",
    "warning":     "⚠",  "info":       "ⓘ",
    "chart_up":    "↗",  "chart_down": "↘",
    "dollar":      "$",  "globe":      "◯",
    "target":      "◎",  "circle":     "●",  "square": "■",
    "triangle":    "▲",  "diamond":    "◆",
    "play":        "▶",  "pause":      "❚❚",
    "plus":        "＋", "minus":      "−",
    "code":        "</>", "gear":      "⚙",
}


def render_icon(slide, block, theme, language):
    name = block.get("name")
    glyph = ICON_GLYPHS.get(name, "●") if name else "●"
    style = block.get("style", {}) or {}
    size_px = min(block["w"], block["h"])
    # Approximate: 1 px ≈ 0.75 pt for icon glyph sizing
    font_size = style.get("font_size", int(size_px * 0.6))
    fill_color = style.get("fill", "accent")

    icon_style = {
        "role": None, "font_size": font_size, "font_weight": 700,
        "font_color": fill_color, "align": "center", "valign": "middle",
        "font": "display",
    }
    return _add_text_block(slide, block["x"], block["y"], block["w"], block["h"], glyph, icon_style, theme, default_role="body")


# ─── 5. chart ───────────────────────────────────────────────────────────────
CHART_KIND_MAP = {
    "column":  XL_CHART_TYPE.COLUMN_CLUSTERED,
    "bar":     XL_CHART_TYPE.BAR_CLUSTERED,
    "line":    XL_CHART_TYPE.LINE,
    "area":    XL_CHART_TYPE.AREA,
    "pie":     XL_CHART_TYPE.PIE,
    "doughnut": XL_CHART_TYPE.DOUGHNUT,
    "scatter": XL_CHART_TYPE.XY_SCATTER,
}


def _style_chart_series(chart, palette, theme, is_line=False):
    for i, series in enumerate(chart.series):
        color_name = palette[i % len(palette)] if palette else "accent"
        rgb = resolve_color(color_name, theme)
        if is_line:
            series.format.line.color.rgb = rgb
            series.format.line.width = Pt(2.5)
        else:
            fill = series.format.fill
            fill.solid()
            fill.fore_color.rgb = rgb
            try:
                series.format.line.fill.background()
            except Exception:
                pass


def render_chart(slide, block, theme, language):
    kind = block["chart_kind"]
    chart_type = CHART_KIND_MAP.get(kind, XL_CHART_TYPE.COLUMN_CLUSTERED)
    style = block.get("style", {}) or {}
    data_spec = block["data"]

    if kind == "scatter":
        cd = XyChartData()
        for s in data_spec["series"]:
            series = cd.add_series(s.get("name", ""))
            for xv, yv in zip(s.get("x", []), s.get("y", [])):
                series.add_data_point(xv, yv)
    else:
        cd = CategoryChartData()
        cd.categories = data_spec.get("categories", [])
        for s in data_spec["series"]:
            cd.add_series(s.get("name", ""), s.get("values", []))

    gframe = slide.shapes.add_chart(
        chart_type,
        px(block["x"]), px(block["y"]), px(block["w"]), px(block["h"]),
        cd,
    )
    chart = gframe.chart

    palette = style.get("palette") or ["accent", "accent_alt", "text_muted", "success", "warning"]
    is_line_like = kind in ("line", "scatter")
    _style_chart_series(chart, palette, theme, is_line=is_line_like)

    # Legend
    show_legend = style.get("show_legend", len(data_spec.get("series", [])) > 1)
    chart.has_legend = bool(show_legend)
    if chart.has_legend:
        chart.legend.position = XL_LEGEND_POSITION.BOTTOM
        chart.legend.include_in_layout = False
        try:
            chart.legend.font.size = Pt(style.get("legend_font_size", 12))
            chart.legend.font.name = resolve_font_name("body", theme)
            chart.legend.font.color.rgb = resolve_color("text_muted", theme)
        except Exception:
            pass

    # Data labels
    if style.get("show_data_labels"):
        for plot in chart.plots:
            plot.has_data_labels = True
            try:
                dl = plot.data_labels
                dl.font.size = Pt(style.get("label_font_size", 11))
                dl.font.bold = True
                dl.font.color.rgb = resolve_color("text", theme)
                if kind == "column":
                    dl.position = XL_LABEL_POSITION.OUTSIDE_END
                elif kind == "bar":
                    dl.position = XL_LABEL_POSITION.OUTSIDE_END
            except Exception:
                pass

    # Y-axis number format
    y_format = style.get("y_format")
    if y_format and kind not in ("pie", "doughnut", "scatter"):
        try:
            chart.value_axis.tick_labels.number_format = y_format
            chart.value_axis.tick_labels.font.size = Pt(11)
            chart.value_axis.tick_labels.font.color.rgb = resolve_color("text_muted", theme)
        except Exception:
            pass

    try:
        chart.category_axis.tick_labels.font.size = Pt(12)
        chart.category_axis.tick_labels.font.color.rgb = resolve_color("text_muted", theme)
    except Exception:
        pass

    return gframe


# ─── 6. table ───────────────────────────────────────────────────────────────
def render_table(slide, block, theme, language):
    headers = block["headers"]
    rows = block["rows"]
    style = block.get("style", {}) or {}
    n_cols = len(headers)
    n_rows = len(rows) + 1
    gframe = slide.shapes.add_table(
        n_rows, n_cols,
        px(block["x"]), px(block["y"]), px(block["w"]), px(block["h"])
    )
    table = gframe.table

    column_widths = block.get("column_widths")
    if column_widths and len(column_widths) == n_cols:
        total_emu = px(block["w"])
        for i, frac in enumerate(column_widths):
            table.columns[i].width = int(total_emu * frac)

    font_size = style.get("font_size", 16)
    header_font_size = style.get("header_font_size", font_size)
    header_fill = style.get("header_fill", "accent")
    header_font_color = style.get("header_font_color", "bg")
    body_font_color = style.get("font_color", "text")
    row_alt_fill = style.get("row_alt_fill")
    border_color = style.get("border_color", "border")
    body_font = resolve_font_name("body", theme)

    for c, header in enumerate(headers):
        cell = table.cell(0, c)
        cell.fill.solid()
        cell.fill.fore_color.rgb = resolve_color(header_fill, theme)
        cell.text = ""
        tf = cell.text_frame
        tf.margin_left = px(12); tf.margin_right = px(12)
        tf.margin_top = px(8); tf.margin_bottom = px(8)
        p = tf.paragraphs[0]
        p.alignment = PP_ALIGN.LEFT
        run = p.add_run()
        run.text = str(header)
        run.font.name = body_font
        run.font.size = Pt(header_font_size)
        run.font.bold = True
        run.font.color.rgb = resolve_color(header_font_color, theme)

    for r, row in enumerate(rows, start=1):
        for c, value in enumerate(row):
            cell = table.cell(r, c)
            if row_alt_fill and r % 2 == 0:
                cell.fill.solid()
                cell.fill.fore_color.rgb = resolve_color(row_alt_fill, theme)
            else:
                cell.fill.solid()
                cell.fill.fore_color.rgb = resolve_color("bg", theme)
            cell.text = ""
            tf = cell.text_frame
            tf.margin_left = px(12); tf.margin_right = px(12)
            tf.margin_top = px(6); tf.margin_bottom = px(6)
            p = tf.paragraphs[0]
            text_str = str(value)
            is_numeric = bool(text_str.strip()) and text_str.replace(",", "").replace(".", "").replace("-", "").replace("+", "").replace("%", "").replace("$", "").replace(" ", "").isdigit()
            p.alignment = PP_ALIGN.RIGHT if is_numeric else PP_ALIGN.LEFT
            run = p.add_run()
            run.text = text_str
            run.font.name = body_font
            run.font.size = Pt(font_size)
            run.font.color.rgb = resolve_color(body_font_color, theme)

    return gframe


# ─── 7. quote ───────────────────────────────────────────────────────────────
def render_quote(slide, block, theme, language):
    style = block.get("style", {}) or {}
    x, y, w, h = block["x"], block["y"], block["w"], block["h"]

    mark_size = style.get("mark_size", 180)
    text_size = style.get("font_size", 44)
    mark_color = style.get("mark_color", "accent")
    text_color = style.get("font_color", "text")
    font_role = style.get("font", "display")
    attribution = block.get("attribution", "")

    mark_h = int(mark_size * 1.1)
    mark_w = int(mark_size * 0.9)
    attr_h = 40 if attribution else 0
    attr_gap = 16 if attribution else 0
    text_y = y + int(mark_size * 0.4)
    text_h = h - int(mark_size * 0.4) - attr_gap - attr_h

    # Mark glyph
    mark_style = {
        "font": font_role, "role": None,
        "font_size": mark_size, "font_weight": 700,
        "font_color": mark_color, "align": "left", "valign": "top",
        "line_height": 0.9,
    }
    _add_text_block(slide, x, y - int(mark_size * 0.1), mark_w, mark_h, "“", mark_style, theme)

    # Quote text
    quote_style = {
        "font": font_role, "role": None,
        "font_size": text_size, "font_weight": 600,
        "font_color": text_color, "align": "left", "valign": "top",
        "line_height": 1.3,
    }
    _add_text_block(slide, x, text_y, w, text_h, block["text"], quote_style, theme)

    # Attribution
    if attribution:
        attr_style = {
            "font": "body", "role": "caption",
            "font_size": style.get("attribution_size", 16),
            "font_color": "text_muted", "align": "left", "valign": "top",
        }
        _add_text_block(slide, x, y + h - attr_h, w, attr_h, attribution, attr_style, theme)


# ─── 8. stat_grid ───────────────────────────────────────────────────────────
def render_stat_grid(slide, block, theme, language):
    style = block.get("style", {}) or {}
    items = block["items"]
    cols = block["cols"]
    rows = block["rows"]
    x, y, w, h = block["x"], block["y"], block["w"], block["h"]

    gutter = style.get("gutter", 24)
    cell_w = (w - (cols - 1) * gutter) / cols
    cell_h = (h - (rows - 1) * gutter) / rows

    value_size = style.get("value_size", 64)
    label_size = style.get("label_size", 14)
    delta_size = style.get("delta_size", 12)
    value_color = style.get("value_color", "accent")
    label_color = style.get("label_color", "text")
    delta_color = style.get("delta_color", "text_muted")

    value_h = int(cell_h * 0.6)
    label_h = int(cell_h * 0.18)
    delta_h = int(cell_h * 0.18)

    for i, item in enumerate(items):
        if i >= cols * rows:
            break
        r = i // cols
        c = i % cols
        cx = x + c * (cell_w + gutter)
        cy = y + r * (cell_h + gutter)

        value_style = {
            "font": "display", "role": None,
            "font_size": value_size, "font_weight": 800,
            "font_color": value_color, "align": "left", "valign": "top",
            "line_height": 1.0, "tracking": -0.03,
        }
        _add_text_block(slide, cx, cy, cell_w, value_h, item.get("value", ""), value_style, theme)

        if item.get("label"):
            label_style = {
                "font": "body", "role": None,
                "font_size": label_size, "font_weight": 600,
                "font_color": label_color, "align": "left", "valign": "top",
                "tracking": 0.05,
            }
            _add_text_block(slide, cx, cy + value_h + 4, cell_w, label_h, item["label"], label_style, theme)

        if item.get("delta"):
            delta_style = {
                "font": "body", "role": None,
                "font_size": delta_size, "font_weight": 400,
                "font_color": delta_color, "align": "left", "valign": "top",
            }
            _add_text_block(slide, cx, cy + value_h + label_h + 8, cell_w, delta_h, item["delta"], delta_style, theme)


# ─── 9. two_column ──────────────────────────────────────────────────────────
def render_two_column(slide, block, theme, language):
    x, y, w, h = block["x"], block["y"], block["w"], block["h"]
    split = block.get("split", [50, 50])
    gap = block.get("gap", 24)
    total = split[0] + split[1]
    inner_w = w - gap
    left_w = inner_w * split[0] / total
    right_w = inner_w * split[1] / total

    def render_nested(nested_list, origin_x, origin_y, max_w):
        for nested in nested_list or []:
            nested_copy = copy.deepcopy(nested)
            nested_copy["x"] = origin_x + nested.get("x", 0)
            nested_copy["y"] = origin_y + nested.get("y", 0)
            if nested.get("w") is None or nested.get("w", 0) > max_w:
                nested_copy["w"] = max_w
            renderer = BLOCK_RENDERERS.get(nested["type"])
            if renderer:
                renderer(slide, nested_copy, theme, language)

    render_nested(block.get("left"), x, y, left_w)
    render_nested(block.get("right"), x + left_w + gap, y, right_w)


# ─── 10. divider ────────────────────────────────────────────────────────────
def render_divider(slide, block, theme, language):
    style = block.get("style", {}) or {}
    orientation = block.get("orientation", "h")
    color = style.get("color", "border")
    thickness = style.get("thickness", 1)
    x, y, w, h = block["x"], block["y"], block["w"], block["h"]
    if orientation == "h":
        line_w = w
        line_h = thickness
        line_y = y + (h - thickness) // 2
        line_x = x
    else:
        line_w = thickness
        line_h = h
        line_x = x + (w - thickness) // 2
        line_y = y
    shape = slide.shapes.add_shape(MSO_SHAPE.RECTANGLE, px(line_x), px(line_y), px(line_w), px(line_h))
    shape.fill.solid()
    shape.fill.fore_color.rgb = resolve_color(color, theme)
    shape.line.fill.background()


# ─── Dispatch table ─────────────────────────────────────────────────────────
BLOCK_RENDERERS = {
    "text":       render_text,
    "shape":      render_shape,
    "image":      render_image,
    "icon":       render_icon,
    "chart":      render_chart,
    "table":      render_table,
    "quote":      render_quote,
    "stat_grid":  render_stat_grid,
    "two_column": render_two_column,
    "divider":    render_divider,
}


# ─── Slide builder ──────────────────────────────────────────────────────────
def sort_blocks_by_z(blocks):
    indexed = list(enumerate(blocks))
    indexed.sort(key=lambda pair: (pair[1].get("z", pair[0]), pair[0]))
    return [b for _, b in indexed]


def build_slide(prs, slide_spec, theme, language, skipped_types):
    blank_layout = prs.slide_layouts[6]
    slide = prs.slides.add_slide(blank_layout)
    slide._slide_id = slide_spec.get("id", "")
    render_background(slide, slide_spec.get("background"), theme)
    if slide_spec.get("notes"):
        slide.notes_slide.notes_text_frame.text = slide_spec["notes"]
    for block in sort_blocks_by_z(slide_spec.get("blocks", [])):
        btype = block.get("type")
        renderer = BLOCK_RENDERERS.get(btype)
        if renderer is None:
            skipped_types.add(btype)
            continue
        try:
            renderer(slide, block, theme, language)
        except Exception as e:
            print(f"⚠️  Error rendering {btype} on slide '{slide_spec.get('id')}': {e}", file=sys.stderr)
    return slide


def build(spec, themes_path: Path = None) -> Presentation:
    themes_path = themes_path or (Path(__file__).parent / "themes.json")
    themes = load_themes(themes_path)
    theme = resolve_theme(spec, themes)
    language = spec.get("meta", {}).get("language", "ko")

    prs = Presentation()
    prs.slide_width = SLIDE_W_EMU
    prs.slide_height = SLIDE_H_EMU

    meta = spec.get("meta", {})
    cp = prs.core_properties
    if meta.get("title"):
        cp.title = meta["title"]
    if meta.get("author"):
        cp.author = meta["author"]

    skipped = set()
    for slide_spec in spec["slides"]:
        build_slide(prs, slide_spec, theme, language, skipped)

    if skipped:
        print(f"⚠️  Skipped unimplemented block type(s): {sorted(skipped)}")

    if _OVERFLOW_AUTO_FIXED:
        print(f"⚠️  Auto-enabled text-shrink-to-fit on {len(_OVERFLOW_AUTO_FIXED)} block(s) due to overflow:")
        for entry in _OVERFLOW_AUTO_FIXED[:10]:
            print(f"    [{entry['slide']}] {entry['block']!r}: {entry['needed_lines']} lines needed, "
                  f"{entry['fit_lines']} fit — '{entry['preview']}'")
        if len(_OVERFLOW_AUTO_FIXED) > 10:
            print(f"    ... +{len(_OVERFLOW_AUTO_FIXED)-10} more")
        print(f"    Run `python validate_spec.py {{spec}}` for full list + fixes.")

    return prs


# ─── CLI ────────────────────────────────────────────────────────────────────
def main():
    parser = argparse.ArgumentParser(description="Build editable .pptx from deck.json")
    parser.add_argument("spec", nargs="?", default="deck.json")
    parser.add_argument("--out", default="deck.pptx")
    parser.add_argument("--themes", default=None)
    args = parser.parse_args()

    spec_path = Path(args.spec)
    if not spec_path.exists():
        print(f"✗ Spec file not found: {spec_path}")
        sys.exit(1)

    spec = json.loads(spec_path.read_text(encoding="utf-8"))
    themes_path = Path(args.themes) if args.themes else None
    prs = build(spec, themes_path)

    out_path = Path(args.out)
    prs.save(out_path)
    print(f"✓ Built {out_path} ({len(spec['slides'])} slides)")


if __name__ == "__main__":
    main()
