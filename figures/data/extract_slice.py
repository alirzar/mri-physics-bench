"""Extract an axial slice of the MNI152 (ICBM 2009c) GM/WM/CSF probability maps for the figures.

python extract_slice.py [z_mm]   (default z = +14 mm MNI: lateral ventricles, basal ganglia, thalamus)

Writes data/mni152-slice.json: { z, width, height, view, gm, wm, csf } where each map is base64 of
uint8 probabilities (0..255), rows from anterior (top) to posterior, radiological view
(patient's left on the right of the image), 1 mm pixels.
"""
import base64
import json
import sys
from pathlib import Path

import nibabel as nib
import numpy as np

HERE = Path(__file__).resolve().parent
SRC = HERE / "mni152"
z_mm = float(sys.argv[1]) if len(sys.argv) > 1 else 14.0

maps = {}
for label in ("GM", "WM", "CSF"):
    img = nib.load(SRC / f"tpl-MNI152NLin2009cAsym_res-01_label-{label}_probseg.nii.gz")
    ijk = np.linalg.inv(img.affine) @ np.array([0, 0, z_mm, 1])
    k = int(round(ijk[2]))
    sl = np.asarray(img.dataobj[:, :, k], dtype=np.float32)  # [i (x: left→right), j (y: posterior→anterior)]
    maps[label] = sl

# crop to the brain with a small margin, shared by all three maps
total = maps["GM"] + maps["WM"] + maps["CSF"]
ii, jj = np.where(total > 0.02)
pad = 4
i0, i1 = max(ii.min() - pad, 0), min(ii.max() + pad + 1, total.shape[0])
j0, j1 = max(jj.min() - pad, 0), min(jj.max() + pad + 1, total.shape[1])


def encode(sl):
    crop = sl[i0:i1, j0:j1]
    # to image rows: anterior at the top, radiological (flip x)
    image = np.flipud(crop.T)[:, ::-1]
    q = np.clip(np.round(image * 255), 0, 255).astype(np.uint8)
    return q, base64.b64encode(q.tobytes()).decode("ascii")


out = {"z": z_mm, "view": "axial, radiological", "source": "MNI152NLin2009cAsym (ICBM 2009c), TemplateFlow, res-01"}
for label, sl in maps.items():
    q, b64 = encode(sl)
    out["height"], out["width"] = q.shape
    out[label.lower()] = b64

# voxel indices of image pixel (row, col): i = i_last - col, j = j_last - row, k = k; MNI mm = affine @ [i, j, k, 1]
out["i_last"] = int(i1 - 1)
out["j_last"] = int(j1 - 1)
out["k"] = k
out["affine"] = [[float(v) for v in row] for row in img.affine]

(HERE / "mni152-slice.json").write_text(json.dumps(out))
# the same data as a script, for pages opened straight from disk (file:// pages cannot fetch JSON)
(HERE / "mni152-slice.js").write_text("window.MNI_SLICE = " + json.dumps(out) + ";\n")
print(f"slice z={z_mm} mm -> {out['width']}x{out['height']} px, written mni152-slice.json")
