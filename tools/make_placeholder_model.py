"""Build a placeholder 3D model for a piece of furniture, as a real .glb.

WHY THIS EXISTS
    AR is the one feature where a stand-in has to be *dimensionally* honest.
    A photograph that is not really the product is a stand-in; a 3D model at
    the wrong size is a lie the customer measures their room against. So this
    generates simple, blocky geometry at the product's exact real-world size
    rather than something prettier at the wrong scale.

    Nobody will mistake the result for a photoreal sofa, which is the point.
    It is replaced by a real model, uploaded through the dashboard, with no
    code change - exactly like the placeholder photography.

    glTF units are metres and the model stands on Y=0 with its origin centred,
    which is what both AR runtimes expect of something placed on a floor.

    python tools/make_placeholder_model.py sofa --width 2140 --depth 900 \\
        --height 780 --out sofa.glb
"""
from __future__ import annotations

import argparse
import base64
import json
import struct
from pathlib import Path

# Roughly the teak-and-green of the catalogue's own artwork, so a placeholder
# model sits in the same world as the placeholder photography.
UPHOLSTERY = [0.157, 0.353, 0.302, 1.0]
TIMBER = [0.396, 0.251, 0.145, 1.0]


def box(cx: float, cy: float, cz: float, w: float, h: float, d: float):
    """One axis-aligned box, as (positions, normals, indices).

    Flat-shaded: each face carries its own four vertices so the normals stay
    square. A shared-vertex cube renders with smeared lighting that reads as a
    rounded blob, which is worse than blocky.
    """
    x0, x1 = cx - w / 2, cx + w / 2
    y0, y1 = cy - h / 2, cy + h / 2
    z0, z1 = cz - d / 2, cz + d / 2

    faces = [
        ([(x0, y0, z1), (x1, y0, z1), (x1, y1, z1), (x0, y1, z1)], (0, 0, 1)),
        ([(x1, y0, z0), (x0, y0, z0), (x0, y1, z0), (x1, y1, z0)], (0, 0, -1)),
        ([(x1, y0, z1), (x1, y0, z0), (x1, y1, z0), (x1, y1, z1)], (1, 0, 0)),
        ([(x0, y0, z0), (x0, y0, z1), (x0, y1, z1), (x0, y1, z0)], (-1, 0, 0)),
        ([(x0, y1, z1), (x1, y1, z1), (x1, y1, z0), (x0, y1, z0)], (0, 1, 0)),
        ([(x0, y0, z0), (x1, y0, z0), (x1, y0, z1), (x0, y0, z1)], (0, -1, 0)),
    ]

    positions: list[tuple[float, float, float]] = []
    normals: list[tuple[float, float, float]] = []
    indices: list[int] = []
    for corners, normal in faces:
        base = len(positions)
        positions.extend(corners)
        normals.extend([normal] * 4)
        indices.extend([base, base + 1, base + 2, base, base + 2, base + 3])
    return positions, normals, indices


def sofa(width: float, depth: float, height: float):
    """A three-seater, in two parts: upholstery and legs.

    Proportions are the ordinary ones - arms an eighth of the width, seat at
    about 40cm, back filling the rest - so the silhouette is recognisable at
    the size the product actually is.
    """
    leg = min(0.18, height * 0.23)
    seat_top = leg + 0.24
    arm_w = min(0.18, width * 0.09)
    back_d = min(0.18, depth * 0.2)

    upholstery = [
        # Seat block, between the arms.
        box(0, (leg + seat_top) / 2, 0, width - arm_w * 2, seat_top - leg, depth),
        # Backrest, along the rear edge.
        box(
            0,
            (seat_top + height) / 2,
            -(depth - back_d) / 2,
            width - arm_w * 2,
            height - seat_top,
            back_d,
        ),
        # Two arms.
        box(
            (width - arm_w) / 2,
            (leg + seat_top + 0.2) / 2,
            0,
            arm_w,
            seat_top - leg + 0.2,
            depth,
        ),
        box(
            -(width - arm_w) / 2,
            (leg + seat_top + 0.2) / 2,
            0,
            arm_w,
            seat_top - leg + 0.2,
            depth,
        ),
    ]

    inset = 0.09
    legs = [
        box(sx * (width / 2 - inset), leg / 2, sz * (depth / 2 - inset), 0.05, leg, 0.05)
        for sx in (-1, 1)
        for sz in (-1, 1)
    ]
    return upholstery, legs


def merge(parts):
    positions: list[tuple[float, float, float]] = []
    normals: list[tuple[float, float, float]] = []
    indices: list[int] = []
    for part_positions, part_normals, part_indices in parts:
        offset = len(positions)
        positions.extend(part_positions)
        normals.extend(part_normals)
        indices.extend(i + offset for i in part_indices)
    return positions, normals, indices


def build_glb(groups: list[tuple[list, list]]) -> bytes:
    """Assemble one GLB: a mesh with one primitive per material."""
    buffer = bytearray()
    accessors: list[dict] = []
    buffer_views: list[dict] = []
    primitives: list[dict] = []

    def add_view(data: bytes, target: int) -> int:
        # Accessor offsets must be aligned to their component size; padding
        # each view to four bytes satisfies every type used here.
        while len(buffer) % 4:
            buffer.append(0)
        buffer_views.append(
            {"buffer": 0, "byteOffset": len(buffer), "byteLength": len(data), "target": target}
        )
        buffer.extend(data)
        return len(buffer_views) - 1

    for material_index, (parts, _colour) in enumerate(groups):
        positions, normals, indices = merge(parts)

        pos_view = add_view(
            b"".join(struct.pack("<3f", *p) for p in positions), 34962
        )
        accessors.append({
            "bufferView": pos_view,
            "componentType": 5126,
            "count": len(positions),
            "type": "VEC3",
            # Required on POSITION, and what a viewer frames the camera from.
            "min": [min(p[i] for p in positions) for i in range(3)],
            "max": [max(p[i] for p in positions) for i in range(3)],
        })
        position_accessor = len(accessors) - 1

        nor_view = add_view(b"".join(struct.pack("<3f", *n) for n in normals), 34962)
        accessors.append({
            "bufferView": nor_view,
            "componentType": 5126,
            "count": len(normals),
            "type": "VEC3",
        })
        normal_accessor = len(accessors) - 1

        idx_view = add_view(b"".join(struct.pack("<I", i) for i in indices), 34963)
        accessors.append({
            "bufferView": idx_view,
            "componentType": 5125,
            "count": len(indices),
            "type": "SCALAR",
        })
        index_accessor = len(accessors) - 1

        primitives.append({
            "attributes": {"POSITION": position_accessor, "NORMAL": normal_accessor},
            "indices": index_accessor,
            "material": material_index,
        })

    gltf = {
        "asset": {"version": "2.0", "generator": "Nivisa placeholder model generator"},
        "scene": 0,
        "scenes": [{"nodes": [0]}],
        "nodes": [{"mesh": 0, "name": "placeholder"}],
        "meshes": [{"primitives": primitives}],
        "materials": [
            {
                "name": name,
                "pbrMetallicRoughness": {
                    "baseColorFactor": colour,
                    "metallicFactor": 0.0,
                    "roughnessFactor": 0.85,
                },
            }
            for name, (_parts, colour) in zip(("upholstery", "timber"), groups)
        ],
        "buffers": [{"byteLength": len(buffer)}],
        "bufferViews": buffer_views,
        "accessors": accessors,
    }

    json_chunk = json.dumps(gltf, separators=(",", ":")).encode()
    json_chunk += b" " * ((4 - len(json_chunk) % 4) % 4)
    bin_chunk = bytes(buffer)
    bin_chunk += b"\x00" * ((4 - len(bin_chunk) % 4) % 4)

    body = (
        struct.pack("<I4s", len(json_chunk), b"JSON")
        + json_chunk
        + struct.pack("<I4s", len(bin_chunk), b"BIN\x00")
        + bin_chunk
    )
    return struct.pack("<4sII", b"glTF", 2, 12 + len(body)) + body


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("shape", choices=["sofa"])
    parser.add_argument("--width", type=int, required=True, help="millimetres")
    parser.add_argument("--depth", type=int, required=True, help="millimetres")
    parser.add_argument("--height", type=int, required=True, help="millimetres")
    parser.add_argument("--out", type=Path, required=True)
    parser.add_argument("--base64", action="store_true", help="also write <out>.b64")
    args = parser.parse_args()

    upholstery, legs = sofa(args.width / 1000, args.depth / 1000, args.height / 1000)
    glb = build_glb([(upholstery, UPHOLSTERY), (legs, TIMBER)])

    args.out.write_bytes(glb)
    print(f"{args.out}: {len(glb)} bytes, {args.width}x{args.depth}x{args.height}mm")
    if args.base64:
        args.out.with_suffix(args.out.suffix + ".b64").write_text(
            base64.b64encode(glb).decode()
        )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
