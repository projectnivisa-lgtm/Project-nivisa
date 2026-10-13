"""Build a placeholder 3D model for a piece of furniture, as a real .usdz.

WHY THIS EXISTS
    The companion to tools/make_placeholder_model.py, which produces the .glb
    that Android's Scene Viewer reads. iOS AR Quick Look reads USDZ and only
    USDZ, and neither format converts to the other at runtime - so a product
    with one but not the other has AR on one platform and not the other.

    Same rule as the glTF tool, for the same reason: a stand-in has to be
    DIMENSIONALLY honest. Blocky geometry at the product's exact real-world
    size is a placeholder; something prettier at the wrong size is a lie the
    customer measures their room against.

    USD's unit is the metre, matching glTF, and the piece stands on Y=0 with
    its origin centred - what AR Quick Look expects of something placed on a
    floor.

USAGE
    python tools/make_placeholder_usdz.py sofa --width 2140 --depth 900 \\
        --height 780 --out sofa.usdz

REQUIREMENTS
    pip install usd-core        (Pixar's own USD build, no Xcode needed)
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

try:
    from pxr import Gf, Sdf, Usd, UsdGeom, UsdShade, UsdUtils
except ImportError:  # pragma: no cover - the message is the whole point
    sys.exit(
        "This needs Pixar's USD library:\n"
        "    pip install usd-core\n"
        "It is not a dependency of the API - only this tool uses it."
    )

# The same two colours the glTF placeholder uses, so a piece looks like the
# same stand-in whichever phone opens it.
UPHOLSTERY = (0.157, 0.353, 0.302)
TIMBER = (0.396, 0.251, 0.145)


def _material(stage: Usd.Stage, path: str, rgb: tuple[float, float, float]):
    """One flat PBR material. Quick Look needs UsdPreviewSurface, not a
    custom shader - anything else renders untextured grey on a phone."""
    material = UsdShade.Material.Define(stage, path)
    shader = UsdShade.Shader.Define(stage, path + "/Shader")
    shader.CreateIdAttr("UsdPreviewSurface")
    shader.CreateInput("diffuseColor", Sdf.ValueTypeNames.Color3f).Set(Gf.Vec3f(*rgb))
    shader.CreateInput("roughness", Sdf.ValueTypeNames.Float).Set(0.7)
    shader.CreateInput("metallic", Sdf.ValueTypeNames.Float).Set(0.0)
    material.CreateSurfaceOutput().ConnectToSource(shader.ConnectableAPI(), "surface")
    return material


def _box(stage, path, centre, size, material):
    """One axis-aligned box. UsdGeom.Cube is a unit cube, so the size is
    carried by the scale - which keeps the maths readable and the file small."""
    xform = UsdGeom.Xform.Define(stage, path)
    cube = UsdGeom.Cube.Define(stage, path + "/Geom")
    cube.CreateSizeAttr(1.0)
    UsdGeom.XformCommonAPI(xform).SetTranslate(Gf.Vec3d(*centre))
    UsdGeom.XformCommonAPI(xform).SetScale(Gf.Vec3f(*size))
    UsdShade.MaterialBindingAPI(cube).Bind(material)
    return xform


def build(shape: str, width_mm: int, depth_mm: int, height_mm: int, out: Path) -> None:
    w, d, h = width_mm / 1000.0, depth_mm / 1000.0, height_mm / 1000.0

    # USD writes the package from a layer on disk, so the source layer is
    # written beside the target and removed once it is packaged. Binary crate
    # (.usdc) rather than ASCII: the USDZ spec allows either, but Apple's
    # guidance is crate, and it is smaller over mobile data.
    scratch = out.with_suffix(".usdc")
    stage = Usd.Stage.CreateNew(str(scratch))
    UsdGeom.SetStageUpAxis(stage, UsdGeom.Tokens.y)
    UsdGeom.SetStageMetersPerUnit(stage, 1.0)

    root = UsdGeom.Xform.Define(stage, "/Model")
    stage.SetDefaultPrim(root.GetPrim())

    body = _material(stage, "/Model/Materials/Body", UPHOLSTERY)
    legs = _material(stage, "/Model/Materials/Legs", TIMBER)

    leg_h = min(0.12, h * 0.18)
    carcass_h = h - leg_h

    # The carcass, sitting on top of the legs.
    _box(stage, "/Model/Carcass", (0.0, leg_h + carcass_h / 2, 0.0), (w, carcass_h, d), body)

    # Four legs, inset from the corners.
    inset_x = w / 2 - min(0.06, w * 0.06)
    inset_z = d / 2 - min(0.06, d * 0.06)
    leg = min(0.06, w * 0.05, d * 0.12)
    for i, (sx, sz) in enumerate(((-1, -1), (1, -1), (-1, 1), (1, 1))):
        _box(stage, f"/Model/Leg{i}", (sx * inset_x, leg_h / 2, sz * inset_z),
             (leg, leg_h, leg), legs)

    stage.GetRootLayer().Save()
    del stage

    if out.exists():
        out.unlink()
    if not UsdUtils.CreateNewUsdzPackage(Sdf.AssetPath(str(scratch)), str(out)):
        scratch.unlink(missing_ok=True)
        sys.exit(f"USD refused to package {scratch} into {out}")
    scratch.unlink(missing_ok=True)

    print(f"{out}: {out.stat().st_size} bytes, {width_mm}x{depth_mm}x{height_mm}mm")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("shape", choices=["sofa"], help="Only one silhouette so far.")
    parser.add_argument("--width", type=int, required=True, help="Millimetres")
    parser.add_argument("--depth", type=int, required=True, help="Millimetres")
    parser.add_argument("--height", type=int, required=True, help="Millimetres")
    parser.add_argument("--out", type=Path, required=True)
    args = parser.parse_args()
    build(args.shape, args.width, args.depth, args.height, args.out)


if __name__ == "__main__":
    main()
