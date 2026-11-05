/**
 * Convert MediaPipe Face Landmarker normalized landmarks into stable facial anchors.
 *
 * This module does not detect faces, associate identities between frames, or edit video
 * pixels. It only derives geometry from one already-detected face. Coordinates stay
 * normalized to the source image so callers can map them into a preview/export viewport.
 */
export const FACE_LANDMARK_ANCHOR_INDICES = Object.freeze({
  forehead: 10,
  chin: 152,
  leftEye: 33,
  rightEye: 263,
  leftCheek: 234,
  rightCheek: 454,
  upperLip: 13,
  lowerLip: 14,
  leftMouthCorner: 61,
  rightMouthCorner: 291
});

const REQUIRED_INDICES = Object.values(FACE_LANDMARK_ANCHOR_INDICES);
const finitePoint = point => point && Number.isFinite(Number(point.x)) && Number.isFinite(Number(point.y));
const midpoint = (a, b) => ({ x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 });
const distance = (a, b) => Math.hypot(b.x - a.x, b.y - a.y);
const clamp = (value, min, max) => Math.max(min, Math.min(max, value));

/**
 * Derive mouth/eye/head anchors from one MediaPipe Face Landmarker face.
 * @param {Array<{x:number,y:number,z?:number}>} landmarks One face's normalized landmarks.
 * @returns {{status:string, anchors:object|null, issues:string[]}}
 */
export function deriveFaceLandmarkAnchors(landmarks) {
  if (!Array.isArray(landmarks)) {
    return { status: "invalid", anchors: null, issues: ["Face landmarks must be an array."] };
  }
  const requiredCount = Math.max(...REQUIRED_INDICES) + 1;
  if (landmarks.length < requiredCount) {
    return { status: "invalid", anchors: null, issues: ["Face landmarks do not contain the required facial anchor points."] };
  }
  for (const index of REQUIRED_INDICES) {
    if (!finitePoint(landmarks[index])) {
      return { status: "invalid", anchors: null, issues: ["A required facial anchor point is missing or non-finite."] };
    }
  }

  const points = Object.fromEntries(Object.entries(FACE_LANDMARK_ANCHOR_INDICES)
    .map(([name, index]) => [name, { x: Number(landmarks[index].x), y: Number(landmarks[index].y) }]));
  const eyeCenter = midpoint(points.leftEye, points.rightEye);
  const mouthCenter = midpoint(points.upperLip, points.lowerLip);
  const faceCenter = midpoint(points.forehead, points.chin);
  const eyeDistance = distance(points.leftEye, points.rightEye);
  const mouthWidth = distance(points.leftMouthCorner, points.rightMouthCorner);
  const mouthGap = distance(points.upperLip, points.lowerLip);
  const faceWidth = distance(points.leftCheek, points.rightCheek);
  const faceHeight = distance(points.forehead, points.chin);

  if (eyeDistance < 1e-5 || mouthWidth < 1e-5 || faceWidth < 1e-5 || faceHeight < 1e-5) {
    return { status: "invalid", anchors: null, issues: ["Facial anchor geometry is degenerate."] };
  }

  const boundsPoints = landmarks.filter(finitePoint);
  const xs = boundsPoints.map(point => Number(point.x));
  const ys = boundsPoints.map(point => Number(point.y));
  const minX = Math.min(...xs), maxX = Math.max(...xs);
  const minY = Math.min(...ys), maxY = Math.max(...ys);

  return {
    status: "ready",
    anchors: {
      coordinateSpace: "normalized-image",
      eyeCenter,
      eyeDistance,
      headRotation: Math.atan2(points.rightEye.y - points.leftEye.y, points.rightEye.x - points.leftEye.x),
      mouthCenter,
      mouthWidth,
      mouthWidthRatio: mouthWidth / faceWidth,
      mouthOpenRatio: clamp(mouthGap / mouthWidth, 0, 1),
      faceCenter,
      faceWidth,
      faceHeight,
      faceBounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
      points
    },
    issues: []
  };
}
