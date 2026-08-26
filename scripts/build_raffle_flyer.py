#!/usr/bin/env python3
"""
============================================================
LOUISVILLE LIGHTNING - RAFFLE FLYER GENERATOR
------------------------------------------------------------
Renders public/assets/raffle/flyer.png at 1080x1920, the
phone-native share size: it fills the screen in a text
message and works as an Instagram story with no re-crop.

NOTHING about the raffle is typed into this file. Every
number, date, name, phone and URL is parsed out of
src/lib/raffleData.ts, which is the single source of truth
(see the header of that file). Change the raffle there,
re-run this, and the flyer follows.

Run:
    /opt/anaconda3/bin/python3 scripts/build_raffle_flyer.py

The script refuses to write a flyer it cannot verify:
  * every field must parse out of raffleData.ts
  * no em-dash or en-dash may appear in any drawn string
  * every placed element must sit inside the safe margins
  * no two placed blocks may overlap
  * the glove must land inside the VISIBLE part of the photo
    panel with real padding on all four sides, so it can
    never be cropped through the fingertips
  * the finished PNG is re-opened and the QR is decoded back
    out with cv2, and must equal RAFFLE_URL exactly, and must
    still decode after the flyer is downscaled to 810, 648,
    540 and 432px wide on three resampling filters
============================================================
"""

from __future__ import annotations

import re
import sys
from dataclasses import dataclass
from pathlib import Path

from PIL import Image, ImageDraw, ImageEnhance, ImageFilter, ImageFont

# ------------------------------------------------------------------
# paths
# ------------------------------------------------------------------
REPO = Path(__file__).resolve().parent.parent
RAFFLE_DATA_TS = REPO / "src" / "lib" / "raffleData.ts"
PUBLIC = REPO / "public"
LOGO = PUBLIC / "assets" / "logo-full.png"
OUT = PUBLIC / "assets" / "raffle" / "flyer.png"

# ------------------------------------------------------------------
# palette, lifted from src/index.css @theme
# ------------------------------------------------------------------
NAVY_900 = (0x0A, 0x0F, 0x1C)
NAVY_800 = (0x0F, 0x1A, 0x2E)
NAVY_700 = (0x1B, 0x2A, 0x4E)
GOLD_500 = (0xF5, 0xB8, 0x00)
GOLD_400 = (0xFF, 0xD2, 0x3F)
GOLD_300 = (0xFF, 0xE0, 0x66)
GOLD_DEEP = (0xC8, 0x96, 0x00)
WHITE = (0xFF, 0xFF, 0xFF)
MUTED = (0xB8, 0xC6, 0xDC)

W, H = 1080, 1920
MARGIN = 64  # only full-bleed bands and rules may cross this

# ------------------------------------------------------------------
# layout, top to bottom. One place to retune the whole poster.
# ------------------------------------------------------------------
LOGO_TOP, LOGO_H = 24, 168
EYEBROW_TOP, EYEBROW_H = 204, 32
PANEL_X, PANEL_Y, PANEL_W = 243, 250, 594
BAND_TOP, BAND_H = 905, 188
PANEL_COVER = 100          # strip of the photo panel that the band hides
GLOVE_PAD = 24             # minimum clear canvas px around the glove
PRIZE_TOP, PRIZE_H = 1101, 42
SPEC_TOP, SPEC_H = 1149, 28   # size + model, read off the thumb stamp
DRAW_TOP, DRAW_H = 1183, 60
HAIRLINE_TOP = 1253
SCAN_TOP, SCAN_H = 1265, 44
QR_TOP = 1319
URL_TOP, URL_H = 1806, 40
CONTACT_TOP, CONTACT_H = 1858, 32

# QR sizing, chosen by measurement not by eye. The source code is 33
# modules. Rendering at a whole number of pixels per module keeps every
# module the same width, which is what a camera actually needs. 11px per
# module puts the code at 363px, well over the 300px floor, and a sweep
# of the finished flyer downscaled to 1080 / 810 / 648 / 540 / 432 px
# wide decoded on every resampling filter tried, where the earlier 330px
# code lost 540 and 480 outright. The gate at the bottom of this file
# re-runs that sweep on every build.
QR_MODULES, QR_PX_PER_MODULE, QR_QUIET, QR_RING = 33, 11, 52, 5

# The glove leather in glove-palm.jpg, read off a coordinate grid laid
# over the source at 100px intervals. Fingertips y=380, heel y=1700,
# pinky side x=55, thumb side x=1240. The Ready-2-Go hang tag hangs off
# the left at roughly x 25..145, and is deliberately kept in frame.
GLOVE_BOX = (55, 380, 1240, 1700)


# ==================================================================
# 1. read the contract
# ==================================================================
@dataclass(frozen=True)
class RaffleFacts:
    prize_name: str
    prize_spec: str
    price_label: str
    draw_date_label: str
    url_full: str
    url_display: str
    qr_path: Path
    photo_path: Path
    contact_role: str
    contact_name: str
    contact_phone: str


def _optional(pattern: str, text: str) -> str:
    """Like _grab but a missing or empty value is legal and yields ''."""
    m = re.search(pattern, text)
    return m.group(1).strip() if m else ""


def _grab(pattern: str, text: str, what: str) -> str:
    m = re.search(pattern, text)
    if not m:
        sys.exit(f"FATAL: could not read {what} out of {RAFFLE_DATA_TS}. "
                 f"The flyer refuses to guess. Pattern: {pattern}")
    return m.group(1)


def _block(name: str, text: str) -> str:
    """Body of `export const NAME = { ... } as const;`"""
    m = re.search(r"export const " + name + r"\s*=\s*\{(.*?)\}\s*as const;", text, re.S)
    if not m:
        sys.exit(f"FATAL: could not find the {name} block in {RAFFLE_DATA_TS}.")
    return m.group(1)


def format_usd(cents: int) -> str:
    """Mirrors formatUsd() in raffleData.ts."""
    return f"${cents / 100:.0f}" if cents % 100 == 0 else f"${cents / 100:.2f}"


def read_facts() -> RaffleFacts:
    src = RAFFLE_DATA_TS.read_text(encoding="utf-8")
    prize = _block("PRIZE", src)
    contact = _block("RAFFLE_CONTACT", src)

    cents = int(_grab(r"export const PRICE_PER_CHANCE_CENTS\s*=\s*(\d+)", src,
                      "PRICE_PER_CHANCE_CENTS"))
    url_full = _grab(r"export const RAFFLE_URL\s*=\s*'([^']+)'", src, "RAFFLE_URL")
    qr_rel = _grab(r"export const RAFFLE_QR_IMAGE\s*=\s*'([^']+)'", src, "RAFFLE_QR_IMAGE")
    photo_rel = _grab(r"src:\s*'([^']+)'", prize, "PRIZE.photos[0].src")

    return RaffleFacts(
        prize_name=_grab(r"name:\s*'([^']+)'", prize, "PRIZE.name"),
        prize_spec=" \u00b7 ".join(
            part for part in (
                _optional(r"size:\s*'([^']*)'", prize),
                _optional(r"model:\s*'([^']*)'", prize),
            ) if part
        ),
        price_label=format_usd(cents),
        draw_date_label=_grab(r"export const DRAW_DATE_LABEL\s*=\s*'([^']+)'", src,
                              "DRAW_DATE_LABEL"),
        url_full=url_full,
        url_display=re.sub(r"^https?://", "", url_full).rstrip("/"),
        qr_path=PUBLIC / qr_rel.lstrip("/"),
        photo_path=PUBLIC / photo_rel.lstrip("/"),
        contact_role=_grab(r"role:\s*'([^']+)'", contact, "RAFFLE_CONTACT.role"),
        contact_name=_grab(r"name:\s*'([^']+)'", contact, "RAFFLE_CONTACT.name"),
        contact_phone=_grab(r"phone:\s*'([^']+)'", contact, "RAFFLE_CONTACT.phone"),
    )


def poster_case(s: str) -> str:
    """'October 1st' -> 'OCTOBER 1st'. Uppercase, ordinal suffix left alone."""
    return re.sub(r"(?<=\d)(ST|ND|RD|TH)\b", lambda m: m.group(1).lower(), s.upper())


# ==================================================================
# 2. fonts
# ==================================================================
# Bebas Neue (the site's display face) is a webfont and is not installed
# on macOS. DIN Condensed Bold is the closest thing shipped with the OS:
# tall, narrow, uppercase-forward. Everything under it is a fallback so
# this can never land on PIL's 11px bitmap default.
DISPLAY_CANDIDATES = [
    ("/System/Library/Fonts/Supplemental/DIN Condensed Bold.ttf", 0),
    ("/System/Library/Fonts/Supplemental/Impact.ttf", 0),
    ("/System/Library/Fonts/HelveticaNeue.ttc", 9),                       # Condensed Black
    ("/System/Library/Fonts/Supplemental/Avenir Next Condensed.ttc", 8),  # Heavy
    ("/System/Library/Fonts/Supplemental/Arial Narrow Bold.ttf", 0),
    ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 0),
]
BODY_BOLD_CANDIDATES = [
    ("/System/Library/Fonts/HelveticaNeue.ttc", 1),                       # Bold
    ("/System/Library/Fonts/Supplemental/Arial Bold.ttf", 0),
]
BODY_MED_CANDIDATES = [
    ("/System/Library/Fonts/HelveticaNeue.ttc", 10),                      # Medium
    ("/System/Library/Fonts/HelveticaNeue.ttc", 0),
    ("/System/Library/Fonts/Supplemental/Arial.ttf", 0),
]

_RESOLVED: dict[str, tuple[str, int, str]] = {}


def resolve(role: str, candidates: list[tuple[str, int]]) -> tuple[str, int]:
    for path, index in candidates:
        if not Path(path).exists():
            continue
        try:
            f = ImageFont.truetype(path, 48, index=index)
        except OSError:
            continue
        family, style = f.getname()
        _RESOLVED[role] = (path, index, f"{family} {style}")
        return path, index
    sys.exit(f"FATAL: no usable {role} font found. Refusing to fall back to "
             f"PIL's default bitmap font, which would render a broken flyer.")


DISPLAY = resolve("display", DISPLAY_CANDIDATES)
BODY_BOLD = resolve("body-bold", BODY_BOLD_CANDIDATES)
BODY_MED = resolve("body-medium", BODY_MED_CANDIDATES)


def font(spec: tuple[str, int], size: int) -> ImageFont.FreeTypeFont:
    return ImageFont.truetype(spec[0], size, index=spec[1])


# ==================================================================
# 3. text rendering
#
# Every line is drawn onto its own transparent layer and cropped to its
# INK box before it is pasted. Placement is therefore measured against
# the pixels the eye actually sees, not against the font's ascent and
# descent, so a line can never be clipped by a bad baseline guess and
# the box reported to the collision check is exactly the visible mark.
# ==================================================================
PLACED: list[tuple[str, int, int, int, int]] = []  # (label, l, t, r, b)


def render_line(text: str, f: ImageFont.FreeTypeFont, fill, tracking: float = 0.0) -> Image.Image:
    pad = max(24, f.size)
    width = int(sum(f.getlength(c) for c in text) + tracking * max(0, len(text) - 1)) + pad * 2
    layer = Image.new("RGBA", (width, f.size * 3 + pad * 2), (0, 0, 0, 0))
    d = ImageDraw.Draw(layer)
    x = float(pad)
    baseline = f.size * 2
    for ch in text:
        d.text((x, baseline), ch, font=f, fill=fill, anchor="ls")
        x += f.getlength(ch) + tracking
    box = layer.getbbox()
    if box is None:
        sys.exit(f"FATAL: rendered nothing for {text!r}.")
    return layer.crop(box)


def fit_line(text: str, spec: tuple[str, int], fill, max_w: int, max_h: int,
             tracking_ratio: float = 0.0, start: int = 400) -> Image.Image:
    """Largest size whose INK fits inside max_w x max_h."""
    lo, hi, best = 8, start, None
    while lo <= hi:
        mid = (lo + hi) // 2
        img = render_line(text, font(spec, mid), fill, tracking_ratio * mid)
        if img.width <= max_w and img.height <= max_h:
            best, lo = img, mid + 1
        else:
            hi = mid - 1
    if best is None:
        sys.exit(f"FATAL: {text!r} cannot be fitted into {max_w}x{max_h}.")
    return best


def place(canvas: Image.Image, img: Image.Image, label: str,
          center_x: int | None = None, left: int | None = None,
          top: int = 0) -> tuple[int, int, int, int]:
    x = left if left is not None else int((center_x if center_x is not None else W // 2) - img.width / 2)
    canvas.alpha_composite(img, (x, top))
    entry = (label, x, top, x + img.width, top + img.height)
    PLACED.append(entry)
    return entry[1:]


# ==================================================================
# 4. background furniture
# ==================================================================
def build_background() -> Image.Image:
    """Navy-900 base, a soft navy bloom behind the hero, and the site's
    45 degree gold stripe texture from .stripe-pattern in index.css."""
    bg = Image.new("RGBA", (W, H), NAVY_900 + (255,))

    glow = Image.new("L", (108, 192), 0)
    gd = ImageDraw.Draw(glow)
    for i in range(30, 0, -1):
        gd.ellipse([54 - i * 2.1, 58 - i * 2.4, 54 + i * 2.1, 58 + i * 2.4],
                   fill=int(80 * (1 - i / 30)))
    glow = glow.resize((W, H), Image.LANCZOS)
    bg = Image.composite(Image.new("RGBA", (W, H), NAVY_700 + (255,)), bg, glow)

    stripes = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    sd = ImageDraw.Draw(stripes)
    for i in range(-H, W + H, 46):
        sd.line([(i, 0), (i + H, H)], fill=GOLD_500 + (7,), width=11)
    return Image.alpha_composite(bg, stripes)


def gold_bar(canvas: Image.Image, top: int, height: int) -> None:
    d = ImageDraw.Draw(canvas)
    d.rectangle([0, top, W, top + height], fill=GOLD_500 + (255,))
    d.rectangle([0, top + height // 3, W, top + height - height // 3], fill=GOLD_300 + (255,))


def hairline(canvas: Image.Image, top: int, half_width: int) -> None:
    """Gold rule that fades out at both ends, like .section-divider."""
    d = ImageDraw.Draw(canvas)
    cx = W // 2
    for x in range(cx - half_width, cx + half_width):
        t = 1 - abs(x - cx) / half_width
        d.rectangle([x, top, x + 1, top + 2], fill=GOLD_500 + (int(210 * t),))


def gold_glow(canvas: Image.Image, box: tuple[int, int, int, int], spread: int = 26) -> None:
    """Soft gold halo behind a frame, echoing .box-glow-gold."""
    layer = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    ImageDraw.Draw(layer).rectangle(
        [box[0] - 4, box[1] - 4, box[2] + 4, box[3] + 4], fill=GOLD_500 + (95,))
    layer = layer.filter(ImageFilter.GaussianBlur(spread))
    canvas.alpha_composite(layer)


def grade(img: Image.Image) -> Image.Image:
    """A light grade so the leather reads warm and present rather than
    like a dim phone snapshot dropped onto a dark poster."""
    img = ImageEnhance.Brightness(img).enhance(1.06)
    img = ImageEnhance.Contrast(img).enhance(1.10)
    return ImageEnhance.Color(img).enhance(1.12)


def vignette(img: Image.Image, strength: float = 0.62) -> Image.Image:
    """Pull the kitchen behind the glove down toward navy at the edges so
    the leather is unmistakably the subject. Gentle: only the outer band
    is touched, the centre is untouched."""
    w, h = img.size
    mask = Image.new("L", (72, 72), 0)
    md = ImageDraw.Draw(mask)
    for i in range(36, 0, -1):
        r = i * 1.82
        md.ellipse([36 - r, 36 - r, 36 + r, 36 + r], fill=int(255 * (1 - (i / 36) ** 3.0)))
    mask = mask.resize((w, h), Image.LANCZOS)
    shade = Image.new("RGB", (w, h), tuple(int(c * strength) for c in NAVY_800))
    return Image.composite(img.convert("RGB"), shade, mask).convert("RGBA")


def hero_crop(photo: Image.Image, panel_w: int, panel_h: int,
              visible_h: int) -> tuple[Image.Image, tuple[float, float, float, float]]:
    """Pick the source rectangle rather than squashing the photo.

    The rectangle is solved from GLOVE_BOX so that the whole glove lands
    inside the VISIBLE part of the panel with at least GLOVE_PAD of clear
    canvas on every side. Whatever falls below the glove (the wrist and
    the Rawlings hang tag) drops into the strip the price band covers.

    Returns the resized crop and the glove's rectangle in panel space so
    the caller can assert the framing instead of trusting it.
    """
    gx0, gy0, gx1, gy1 = GLOVE_BOX
    gw, gh = gx1 - gx0, gy1 - gy0
    scale = min((panel_w - 2 * GLOVE_PAD) / gw, (visible_h - 2 * GLOVE_PAD) / gh)

    win_w, win_h = panel_w / scale, panel_h / scale
    vis_win_h = visible_h / scale

    left = min(max((gx0 + gx1) / 2 - win_w / 2, 0), photo.width - win_w)
    top = min(max(gy0 - (vis_win_h - gh) / 2, 0), photo.height - win_h)

    crop = photo.crop((round(left), round(top), round(left + win_w), round(top + win_h)))
    crop = crop.resize((panel_w, panel_h), Image.LANCZOS)
    glove_on_panel = ((gx0 - left) * scale, (gy0 - top) * scale,
                      (gx1 - left) * scale, (gy1 - top) * scale)
    return crop, glove_on_panel


# ==================================================================
# 5. the flyer
# ==================================================================
def build() -> tuple[RaffleFacts, list[str], tuple[float, float, float, float]]:
    facts = read_facts()
    for p in (facts.qr_path, facts.photo_path, LOGO):
        if not p.exists():
            sys.exit(f"FATAL: missing asset {p}")

    strings: list[str] = []

    def s(text: str) -> str:
        strings.append(text)
        return text

    canvas = build_background()
    gold_bar(canvas, 0, 14)

    # ---------- club logo ----------
    logo = Image.open(LOGO).convert("RGBA")
    logo = logo.crop(logo.split()[-1].getbbox())       # strip the transparent gutter
    logo_w = round(logo.width * LOGO_H / logo.height)
    place(canvas, logo.resize((logo_w, LOGO_H), Image.LANCZOS), "logo",
          center_x=W // 2, top=LOGO_TOP)

    # ---------- eyebrow, with rules running out to the margins ----------
    eyebrow = fit_line(s("TEAM FUNDRAISER RAFFLE"), DISPLAY, GOLD_500,
                       max_w=540, max_h=EYEBROW_H, tracking_ratio=0.16, start=60)
    eb = place(canvas, eyebrow, "eyebrow", center_x=W // 2, top=EYEBROW_TOP)
    ed = ImageDraw.Draw(canvas)
    rule_y = eb[1] + eyebrow.height // 2
    for x0, x1 in ((MARGIN + 44, eb[0] - 30), (eb[2] + 30, W - MARGIN - 44)):
        ed.rectangle([x0, rule_y - 1, x1, rule_y + 1], fill=GOLD_500 + (130,))

    # ---------- hero photo ----------
    visible_h = BAND_TOP - PANEL_Y
    panel_h = visible_h + PANEL_COVER
    photo = Image.open(facts.photo_path).convert("RGB")
    hero, glove_on_panel = hero_crop(photo, PANEL_W, panel_h, visible_h)
    gold_glow(canvas, (PANEL_X, PANEL_Y, PANEL_X + PANEL_W, BAND_TOP))
    place(canvas, vignette(grade(hero)), "hero-photo", left=PANEL_X, top=PANEL_Y)
    ImageDraw.Draw(canvas).rectangle(
        [PANEL_X - 5, PANEL_Y - 5, PANEL_X + PANEL_W + 4, PANEL_Y + panel_h + 4],
        outline=GOLD_500 + (255,), width=5)

    # ---------- price band ----------
    # Full bleed, opaque gold, riding over the bottom of the photo. Navy on
    # solid gold means the loudest line on the flyer never has to fight the
    # photo for legibility.
    bd = ImageDraw.Draw(canvas)
    bd.rectangle([0, BAND_TOP, W, BAND_TOP + BAND_H], fill=GOLD_500 + (255,))
    bd.rectangle([0, BAND_TOP, W, BAND_TOP + 5], fill=GOLD_300 + (255,))
    bd.rectangle([0, BAND_TOP + BAND_H - 5, W, BAND_TOP + BAND_H], fill=GOLD_DEEP + (255,))
    price = fit_line(s(f"{facts.price_label} A CHANCE"), DISPLAY, NAVY_900,
                     max_w=W - MARGIN * 2 - 40, max_h=BAND_H - 44,
                     tracking_ratio=0.02, start=400)
    place(canvas, price, "price", center_x=W // 2,
          top=BAND_TOP + (BAND_H - price.height) // 2)

    # ---------- what you are playing for ----------
    prize = fit_line(s(facts.prize_name.upper()), DISPLAY, GOLD_400,
                     max_w=840, max_h=PRIZE_H, tracking_ratio=0.05, start=90)
    place(canvas, prize, "prize-name", center_x=W // 2, top=PRIZE_TOP)

    # Size and model, straight off the thumb stamp. Skipped entirely when the
    # contract has neither, so an unknown spec leaves no gap and no empty line.
    if facts.prize_spec:
        spec = fit_line(s(facts.prize_spec.upper()), DISPLAY, MUTED,
                        max_w=760, max_h=SPEC_H, tracking_ratio=0.08, start=60)
        place(canvas, spec, "prize-spec", center_x=W // 2, top=SPEC_TOP)

    word = fit_line(s("DRAWING"), DISPLAY, WHITE, max_w=340, max_h=DRAW_H, start=110)
    date = fit_line(s(poster_case(facts.draw_date_label)), DISPLAY, GOLD_500,
                    max_w=520, max_h=DRAW_H, start=110)
    gap = 22
    left = (W - (word.width + gap + date.width)) // 2
    place(canvas, word, "drawing-word", left=left,
          top=DRAW_TOP + (date.height - word.height) // 2)
    place(canvas, date, "drawing-date", left=left + word.width + gap, top=DRAW_TOP)

    hairline(canvas, HAIRLINE_TOP, 300)

    # ---------- one code, one action ----------
    call = fit_line(s("SCAN TO ENTER"), DISPLAY, GOLD_500,
                    max_w=W - MARGIN * 2, max_h=SCAN_H, tracking_ratio=0.12, start=80)
    place(canvas, call, "scan-label", center_x=W // 2, top=SCAN_TOP)

    # The source QR already ships with a 4 module quiet zone. Crop to the
    # code itself, scale by a whole number of pixels per module so no module
    # edge is ever resampled soft, then re-pad with a wider quiet zone than
    # the spec asks for. The gold ring is drawn OUTSIDE the white plate so
    # it can never eat into that quiet zone, and it is baked into the placed
    # image so the collision check sees the ring and not just the plate.
    qr_src = Image.open(facts.qr_path).convert("L")
    code = qr_src.crop(qr_src.point(lambda v: 255 if v < 128 else 0).getbbox())
    code_px = QR_MODULES * QR_PX_PER_MODULE      # 363, comfortably over the 300 floor
    code = code.resize((code_px, code_px), Image.NEAREST)
    plate_px = code_px + QR_QUIET * 2            # 4.7 modules of white on every side
    block = Image.new("RGBA", (plate_px + QR_RING * 2, plate_px + QR_RING * 2), (0, 0, 0, 0))
    ImageDraw.Draw(block).rectangle([0, 0, block.width - 1, block.height - 1],
                                    outline=GOLD_500 + (255,), width=QR_RING)
    block.paste(WHITE + (255,), (QR_RING, QR_RING, QR_RING + plate_px, QR_RING + plate_px))
    block.paste(code.convert("RGBA"), (QR_RING + QR_QUIET, QR_RING + QR_QUIET))
    place(canvas, block, "qr-block", center_x=W // 2, top=QR_TOP)

    url = fit_line(s(facts.url_display), BODY_BOLD, WHITE,
                   max_w=W - MARGIN * 2, max_h=URL_H, start=70)
    place(canvas, url, "url", center_x=W // 2, top=URL_TOP)

    # ---------- who to call ----------
    contact = fit_line(
        s(f"Questions: {facts.contact_role} {facts.contact_name} {facts.contact_phone}"),
        BODY_MED, MUTED, max_w=880, max_h=CONTACT_H, start=56)
    place(canvas, contact, "contact", center_x=W // 2, top=CONTACT_TOP)

    gold_bar(canvas, H - 14, 14)

    OUT.parent.mkdir(parents=True, exist_ok=True)
    canvas.convert("RGB").save(OUT, "PNG", optimize=True)
    return facts, strings, glove_on_panel


# ==================================================================
# 6. verification. None of this is optional.
# ==================================================================
def verify(facts: RaffleFacts, strings: list[str],
           glove_on_panel: tuple[float, float, float, float]) -> None:
    failures: list[str] = []

    for text in strings:
        for bad, label in ((chr(0x2014), "em-dash"), (chr(0x2013), "en-dash")):
            if bad in text:
                failures.append(f"{label} in drawn string {text!r}")

    for label, l, t, r, b in PLACED:
        if l < MARGIN or r > W - MARGIN:
            failures.append(f"{label} breaks the side margin: x {l}..{r}")
        if t < 20 or b > H - 20:
            failures.append(f"{label} breaks the top or bottom margin: y {t}..{b}")

    blocks = [p for p in PLACED if p[0] != "hero-photo"]
    for i, a in enumerate(blocks):
        for b in blocks[i + 1:]:
            if a[1] < b[3] and b[1] < a[3] and a[2] < b[4] and b[2] < a[4]:
                failures.append(f"{a[0]} overlaps {b[0]}")

    # the glove must be whole, and inside the part of the panel you can see
    visible_h = BAND_TOP - PANEL_Y
    gl, gt, gr, gb = glove_on_panel
    pads = {"left": gl, "top": gt, "right": PANEL_W - gr, "bottom": visible_h - gb}
    for side, pad in pads.items():
        if pad < GLOVE_PAD - 1:
            failures.append(f"glove is only {pad:.0f}px from the {side} of the "
                            f"visible panel, wanted at least {GLOVE_PAD}px")

    import cv2  # late, so a missing cv2 cannot hide behind an earlier error
    import numpy as np
    flyer = cv2.imread(str(OUT))
    decoded = ""
    survived: list[str] = []
    if flyer is None:
        failures.append(f"cv2 could not read {OUT}")
    else:
        decoded, _, _ = cv2.QRCodeDetector().detectAndDecode(flyer)
        if decoded != facts.url_full:
            failures.append(f"QR decoded to {decoded!r}, expected {facts.url_full!r}")

        # A flyer is not consumed at full size. It gets forwarded, screenshotted
        # and recompressed on the way to somebody's phone. Decode it back out
        # at the sizes it will really be seen at, on every resampling filter a
        # messaging app might use. All of these must survive.
        page = Image.open(OUT).convert("RGB")
        for width in (810, 648, 540, 432):
            for fname, filt in (("lanczos", Image.LANCZOS), ("box", Image.BOX),
                                ("bilinear", Image.BILINEAR)):
                small = page.resize((width, round(width * H / W)), filt)
                arr = cv2.cvtColor(np.array(small), cv2.COLOR_RGB2BGR)
                try:
                    got, _, _ = cv2.QRCodeDetector().detectAndDecode(arr)
                except cv2.error:
                    got = ""
                if got == facts.url_full:
                    survived.append(f"{width}px/{fname}")
                else:
                    failures.append(f"QR stopped decoding once the flyer was "
                                    f"resized to {width}px wide ({fname})")

    size = Image.open(OUT).size
    if size != (W, H):
        failures.append(f"flyer is {size}, expected {(W, H)}")

    print("=" * 64)
    print("FONTS RESOLVED")
    for role, (path, index, name) in _RESOLVED.items():
        print(f"  {role:12} {name:32} {path} [face {index}]")
    print("-" * 64)
    print("COPY, ALL OF IT PARSED OUT OF src/lib/raffleData.ts")
    print(f"  price       {facts.price_label} A CHANCE")
    print(f"  prize       {facts.prize_name}")
    print(f"  spec        {facts.prize_spec or '(none set)'}")
    print(f"  drawing     {poster_case(facts.draw_date_label)}")
    print(f"  url         {facts.url_display}   ({facts.url_full})")
    print(f"  contact     {facts.contact_role} {facts.contact_name} {facts.contact_phone}")
    print("-" * 64)
    print("PLACEMENT")
    for label, l, t, r, b in PLACED:
        print(f"  {label:12} x {l:4}..{r:4}   y {t:4}..{b:4}   {r - l:4} x {b - t:4}")
    print(f"  glove clear of the visible panel edges by: "
          + ", ".join(f"{k} {v:.0f}px" for k, v in pads.items()))
    print("-" * 64)
    print(f"QR DECODED BACK OUT OF THE FINISHED PNG: {decoded!r}")
    print(f"  and still decodes after downscaling: {len(survived)}/12 "
          f"({', '.join(survived[:4])} ...)")
    print(f"OUTPUT: {OUT}  {size[0]}x{size[1]}  "
          f"{OUT.stat().st_size / 1024:.0f} KB")
    print("=" * 64)

    if failures:
        for f in failures:
            print(f"  FAIL  {f}")
        sys.exit(f"{len(failures)} check(s) failed. Flyer is not shippable.")
    print("ALL CHECKS PASSED")


if __name__ == "__main__":
    verify(*build())
