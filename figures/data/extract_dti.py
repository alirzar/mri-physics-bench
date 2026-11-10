"""Extract one axial slice of the Oxford-MM-1 DTI template (FA and the principal direction V1) for Fig 13.

usage: python -I extract_dti.py <FA.nii.gz> <V1.nii.gz> <out.json> [z_mm]

The template is stored like FSL's MNI152 (affine x = -i + 90, y = j - 126, z = k - 72, 1 mm). Its V1 vectors are
given along the voxel axes, so in world (MNI) terms vx = -v_i, vy = v_j, vz = v_k (checked against anatomy: the
anterior limbs of the internal capsule diverge anterolaterally, the corpus callosum runs left-right, the posterior
limb runs superior-inferior).
The slice is written in radiological view, like the other films: anterior at the top, the subject's left on the right.
"""
import base64
import json
import sys

import nibabel as nib
import numpy as np

fa_path, v1_path, out_path = sys.argv[1], sys.argv[2], sys.argv[3]
z_mm = float(sys.argv[4]) if len(sys.argv) > 4 else 14.0

fa_img = nib.load(fa_path)
aff = fa_img.affine
assert np.allclose(aff[:3, :3], np.diag([-1, 1, 1])), "unexpected orientation"
k = int(round((z_mm - aff[2, 3]) / aff[2, 2]))
fa = np.asarray(fa_img.dataobj[:, :, k], dtype=np.float32)
v = np.asarray(nib.load(v1_path).dataobj[:, :, k, :], dtype=np.float32)

# world-frame components (see the docstring)
vx, vy, vz = -v[..., 0], v[..., 1], v[..., 2]

# crop to the brain with a small margin
mask = fa > 0.02
ii, jj = np.where(mask)
m = 3
i0, i1 = max(ii.min() - m, 0), min(ii.max() + m, fa.shape[0] - 1)
j0, j1 = max(jj.min() - m, 0), min(jj.max() + m, fa.shape[1] - 1)

# radiological display: column c -> i = i0 + c (i increases towards the subject's left); row r -> j = j1 - r
def disp(a):
    return a[i0 : i1 + 1, j0 : j1 + 1].T[::-1, :]

FA, VX, VY, VZ = disp(fa), disp(vx), disp(vy), disp(vz)
height, width = FA.shape

def u8(a):
    return base64.b64encode(np.clip(np.round(a * 255), 0, 255).astype(np.uint8).tobytes()).decode()

def s8(a):  # -1..1 -> 1..255, 128 = 0
    return base64.b64encode(np.clip(np.round(a * 127) + 128, 1, 255).astype(np.uint8).tobytes()).decode()

out = {
    "z": z_mm,
    "k": k,
    "width": int(width),
    "height": int(height),
    "view": "radiological",
    "i_first": int(i0),
    "j_last": int(j1),
    "affine": aff.round(3).tolist(),
    "frame": "vx, vy, vz in world (MNI) axes: +x subject's right, +y anterior, +z superior",
    "source": "Oxford-MM-1 DTI template (Arthofer et al., Imaging Neuroscience 2024, doi:10.1162/imag_a_00361), built from UK Biobank data; CC BY-SA 4.0",
    "fa": u8(FA),
    "vx": s8(VX),
    "vy": s8(VY),
    "vz": s8(VZ),
}
with open(out_path, "w") as f:
    json.dump(out, f)
print(f"slice k={k} (z={z_mm:+.0f} mm): {width} x {height} px, FA max {FA.max():.2f}, brain px {int((FA > 0.02).sum())}")
