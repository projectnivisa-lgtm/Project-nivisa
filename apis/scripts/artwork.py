"""Catalogue artwork, generated rather than fetched.

The seed used to point every image at picsum.photos. That is fine until the
machine has no internet — a demo on a train, a CI run, an office with an
egress proxy — and then every product card in the shop is a broken image.
It is also a third party deciding what a furniture catalogue looks like.

So the images are drawn here instead: flat SVG illustrations of the piece,
in the storefront's own palette, sized to the aspect the card and gallery
expect. They are honest about being illustrations — nobody will mistake one
for a photograph — and they are replaced piece by piece as real photography
arrives, through the dashboard, with no code change.

Rendered as SVG rather than raster because a vector is a few kilobytes,
scales to any card size without a second file, and can be diffed.
"""
from __future__ import annotations

# The storefront's own tokens, so generated artwork sits in the same palette
# as the pages around it rather than looking pasted in.
INK = "#2A2622"
LINE = "#8A7E70"
GROUND = "#EFE9E1"
GROUND_ALT = "#E7DFD4"
ACCENT = "#B4552D"
SOFT = "#D9CFC1"


def _svg(body: str, *, width: int, height: int, ground: str = GROUND) -> str:
    return (
        f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {width} {height}" '
        f'width="{width}" height="{height}" role="img">'
        f'<rect width="{width}" height="{height}" fill="{ground}"/>'
        f"{body}</svg>"
    )


def _stroke(d: str, *, width: float = 2.4, colour: str = INK) -> str:
    return (
        f'<path d="{d}" fill="none" stroke="{colour}" stroke-width="{width}" '
        'stroke-linecap="round" stroke-linejoin="round"/>'
    )


def _floor(width: int, height: int) -> str:
    """A soft ellipse the piece sits on, so it reads as standing rather than
    floating. Furniture photographed on nothing looks like a cut-out."""
    return (
        f'<ellipse cx="{width / 2}" cy="{height * 0.82}" rx="{width * 0.34}" '
        f'ry="{height * 0.045}" fill="{SOFT}" opacity="0.75"/>'
    )


# --- One drawing per furniture archetype ------------------------------------
# Coordinates are in a 400x300 space and scaled by the caller, so a card, a
# gallery frame and a room tile all share one drawing.


def _sofa() -> str:
    return (
        _stroke("M78 196 V150 a18 18 0 0 1 18-18 h208 a18 18 0 0 1 18 18 v46")
        + _stroke("M96 132 V108 a16 16 0 0 1 16-16 h176 a16 16 0 0 1 16 16 v24")
        + _stroke("M78 196 h244")
        + _stroke("M96 196 v22 M304 196 v22", width=2)
        + _stroke("M160 132 v-40 M240 132 v-40", width=1.6, colour=LINE)
    )


def _armchair() -> str:
    return (
        _stroke("M140 200 V158 a16 16 0 0 1 16-16 h88 a16 16 0 0 1 16 16 v42")
        + _stroke("M156 142 V104 a18 18 0 0 1 18-18 h52 a18 18 0 0 1 18 18 v38")
        + _stroke("M140 200 h120")
        + _stroke("M152 200 v20 M248 200 v20", width=2)
    )


def _table() -> str:
    return (
        _stroke("M70 140 h260")
        + _stroke("M70 140 v14 h260 v-14", width=2)
        + _stroke("M96 154 v66 M304 154 v66")
        + _stroke("M96 210 h208", width=1.8, colour=LINE)
    )


def _desk() -> str:
    return (
        _stroke("M80 136 h240 v16 H80 z")
        + _stroke("M104 152 v70 M296 152 v70")
        + _stroke("M196 152 v40 h100 v-40", width=1.8, colour=LINE)
        + _stroke("M214 172 h64", width=1.6, colour=LINE)
    )


def _bed() -> str:
    return (
        _stroke("M74 206 V172 h252 v34")
        + _stroke("M100 172 V116 a14 14 0 0 1 14-14 h172 a14 14 0 0 1 14 14 v56")
        + _stroke("M74 206 h252")
        + _stroke("M90 206 v16 M310 206 v16", width=2)
        + _stroke("M138 148 h56 M206 148 h56", width=1.6, colour=LINE)
    )


def _wardrobe() -> str:
    return (
        _stroke("M118 78 h164 v146 H118 z")
        + _stroke("M200 78 v146", width=1.8)
        + _stroke("M182 150 v18 M218 150 v18", width=2, colour=ACCENT)
        + _stroke("M118 224 v14 M282 224 v14", width=2)
    )


def _bookcase() -> str:
    return (
        _stroke("M124 68 h152 v160 H124 z")
        + _stroke("M124 108 h152 M124 148 h152 M124 188 h152", width=1.8)
        + _stroke("M140 82 v22 M150 82 v22 M160 86 v18", width=1.6, colour=LINE)
        + _stroke("M140 162 v22 M150 162 v22", width=1.6, colour=LINE)
    )


def _sideboard() -> str:
    return (
        _stroke("M84 120 h232 v88 H84 z")
        + _stroke("M162 120 v88 M238 120 v88", width=1.8)
        + _stroke("M118 164 h14 M196 164 h14 M272 164 h14", width=2.2, colour=ACCENT)
        + _stroke("M100 208 v16 M300 208 v16", width=2)
    )


def _bench() -> str:
    return (
        _stroke("M110 158 h180 v16 H110 z")
        + _stroke("M130 174 v46 M270 174 v46")
        + _stroke("M130 200 h140", width=1.8, colour=LINE)
    )


def _lamp() -> str:
    return (
        _stroke("M162 96 h76 l-14 -34 h-48 z")
        + _stroke("M200 96 v112")
        + _stroke("M170 214 h60", width=2.6)
        + _stroke("M182 118 v18", width=1.6, colour=ACCENT)
    )


def _pendant() -> str:
    return (
        _stroke("M200 56 v44")
        + _stroke("M160 148 h80 l-18 -48 h-44 z")
        + _stroke("M186 168 h28", width=1.8, colour=ACCENT)
    )


def _decor() -> str:
    return (
        _stroke("M148 210 q0 -70 52 -70 q52 0 52 70 z")
        + _stroke("M176 140 q24 -46 48 0", width=1.8, colour=LINE)
    )


ARCHETYPES = {
    "sofa": _sofa,
    "armchair": _armchair,
    "table": _table,
    "desk": _desk,
    "bed": _bed,
    "wardrobe": _wardrobe,
    "bookcase": _bookcase,
    "sideboard": _sideboard,
    "bench": _bench,
    "lamp": _lamp,
    "pendant": _pendant,
    "decor": _decor,
}


def archetype_for(name: str) -> str:
    """Pick a drawing from what the piece is called.

    Matched on words rather than an exact map so a new product named
    "Dining Bench" or "Reading Lamp" finds something without anyone
    remembering to register it.
    """
    lowered = name.lower()
    for key, words in (
        ("sofa", ("sofa", "couch", "settee")),
        ("armchair", ("armchair", "lounge", "recliner", "chair")),
        ("bed", ("bed", "mattress", "headboard")),
        ("wardrobe", ("wardrobe", "almirah", "closet")),
        ("bookcase", ("bookcase", "shelf", "shelving", "bookshelf")),
        ("sideboard", ("sideboard", "cabinet", "chest", "dresser", "console")),
        ("bench", ("bench", "ottoman", "stool")),
        ("desk", ("desk", "study", "writing")),
        ("pendant", ("pendant", "chandelier")),
        ("lamp", ("lamp", "light", "sconce")),
        ("table", ("table", "coffee", "dining", "side")),
    ):
        if any(word in lowered for word in words):
            return key
    return "decor"


# --- Public builders --------------------------------------------------------


def product_image(name: str, kind: str = "studio") -> str:
    """One product image. `kind` changes the framing, not the piece.

    Three genuinely different framings rather than three tints of the same
    drawing: the gallery groups by kind, and a "detail" shot that is merely
    the studio shot again teaches customers the gallery is padding.
    """
    draw = ARCHETYPES[archetype_for(name)]

    if kind == "lifestyle":
        # The piece in a room: a horizon line, a window, a plant.
        return _svg(
            f'<rect y="0" width="400" height="188" fill="{GROUND_ALT}"/>'
            + _stroke("M0 188 h400", width=1.6, colour=LINE)
            + _stroke("M300 40 h64 v76 h-64 z", width=1.8, colour=LINE)
            + _stroke("M332 40 v76 M300 78 h64", width=1.4, colour=LINE)
            + _floor(400, 300)
            + f'<g transform="translate(-14 6) scale(0.92)">{draw()}</g>'
            + _stroke("M58 214 q10 -44 22 0 z", width=1.8, colour=LINE),
            width=400, height=300, ground=GROUND,
        )

    if kind == "detail":
        # Close on the joint and the material, which is what a furniture
        # buyer zooms in for.
        return _svg(
            _stroke("M60 120 h280 v80 H60 z", width=2.6)
            + _stroke("M60 160 h280", width=1.8, colour=LINE)
            + _stroke("M140 120 v80 M260 120 v80", width=1.8, colour=LINE)
            + _stroke("M92 138 h28 M92 180 h28", width=1.4, colour=LINE)
            + _stroke("M180 138 h40 M180 180 h40", width=1.4, colour=LINE)
            + f'<circle cx="200" cy="160" r="7" fill="{ACCENT}"/>',
            width=400, height=300, ground=GROUND_ALT,
        )

    if kind == "dimension":
        # The measured drawing. The single most useful image on a furniture
        # listing, and the one nobody photographs.
        return _svg(
            f'<g opacity="0.9">{draw()}</g>'
            + _stroke("M70 250 h260", width=1.4, colour=ACCENT)
            + _stroke("M70 244 v12 M330 244 v12", width=1.4, colour=ACCENT)
            + _stroke("M352 100 v130", width=1.4, colour=ACCENT)
            + _stroke("M346 100 h12 M346 230 h12", width=1.4, colour=ACCENT)
            + f'<text x="200" y="272" text-anchor="middle" font-family="system-ui,sans-serif" '
            f'font-size="15" fill="{ACCENT}">width</text>'
            + f'<text x="372" y="170" text-anchor="middle" font-family="system-ui,sans-serif" '
            f'font-size="15" fill="{ACCENT}" transform="rotate(90 372 170)">height</text>',
            width=400, height=300, ground=GROUND,
        )

    return _svg(_floor(400, 300) + draw(), width=400, height=300)


def taxonomy_image(name: str) -> str:
    """A square tile for a category, room or collection."""
    draw = ARCHETYPES[archetype_for(name)]
    return _svg(
        _floor(300, 300)
        + f'<g transform="translate(-50 0) scale(1.0)">{draw()}</g>',
        width=300, height=300, ground=GROUND_ALT,
    )


def banner_image(*, wide: bool = True) -> str:
    """The homepage hero. A room, not a product."""
    if wide:
        width, height = 1600, 700
        return _svg(
            f'<rect width="{width}" height="420" fill="{GROUND_ALT}"/>'
            + _stroke(f"M0 420 h{width}", width=2, colour=LINE)
            + _stroke("M1140 120 h220 v240 h-220 z", width=2, colour=LINE)
            + _stroke("M1250 120 v240 M1140 240 h220", width=1.5, colour=LINE)
            + f'<ellipse cx="700" cy="560" rx="420" ry="34" fill="{SOFT}" opacity="0.7"/>'
            + f'<g transform="translate(500 290) scale(1.9)">{_sofa()}</g>'
            + f'<g transform="translate(1180 300) scale(1.1)">{_lamp()}</g>'
            + f'<g transform="translate(180 330) scale(1.2)">{_table()}</g>',
            width=width, height=height, ground=GROUND,
        )

    width, height = 900, 1200
    return _svg(
        f'<rect width="{width}" height="720" fill="{GROUND_ALT}"/>'
        + _stroke(f"M0 720 h{width}", width=2, colour=LINE)
        + f'<ellipse cx="450" cy="900" rx="300" ry="30" fill="{SOFT}" opacity="0.7"/>'
        + f'<g transform="translate(190 700) scale(1.3)">{_sofa()}</g>'
        + f'<g transform="translate(560 480) scale(0.9)">{_lamp()}</g>',
        width=width, height=height, ground=GROUND,
    )
