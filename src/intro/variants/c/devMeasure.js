// Dev-only alignment probe (used under import.meta.env.DEV, dropped from builds); meant for src/shared/.
import { Vector3 } from 'three';

const v = new Vector3();

/** Projected bbox of a w×h face at local depth z vs `rect` (viewport px) → { ext, target, err }. */
export function measureFace({ object, camera, width, height, z = 0, rect, vw = innerWidth, vh = innerHeight }) {
  object.updateWorldMatrix(true, false);
  camera.updateMatrixWorld();
  const ext = [Infinity, Infinity, -Infinity, -Infinity];
  for (const [x, y] of [[-1, 0], [1, 0], [0, -1], [0, 1]]) {
    v.set((x * width) / 2, (y * height) / 2, z).applyMatrix4(object.matrixWorld).project(camera);
    const px = (v.x * 0.5 + 0.5) * vw, py = (0.5 - v.y * 0.5) * vh;
    ext[0] = Math.min(ext[0], px); ext[1] = Math.min(ext[1], py); ext[2] = Math.max(ext[2], px); ext[3] = Math.max(ext[3], py);
  }
  const target = [rect.left, rect.top, rect.left + rect.width, rect.top + rect.height];
  return { ext, target, err: Math.max(...ext.map((e, i) => Math.abs(e - target[i]))) };
}
