import { FilesetResolver, FaceLandmarker } from '@mediapipe/tasks-vision'

const WASM_URL = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision/wasm'
const MODEL_URL =
  'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task'

const LEFT_EYE_INDICES = [33, 160, 158, 133, 153, 144]
const RIGHT_EYE_INDICES = [362, 385, 387, 263, 373, 380]
const NOSE_TIP = 1
const MOUTH_UPPER = 13
const FOREHEAD_TOP = 10

export const EFFECTS = {
  none: { key: 'none', label: 'Aucun', icon: '' },
  ears: { key: 'ears', label: 'Oreilles', icon: '' },
  glasses: { key: 'glasses', label: 'Lunettes', icon: '' },
  hat: { key: 'hat', label: 'Chapeau', icon: '' },
  mustache: { key: 'mustache', label: 'Moustache', icon: '' },
}

export async function loadFaceLandmarker() {
  try {
    const vision = await FilesetResolver.forVisionTasks(WASM_URL)
    const faceLandmarker = await FaceLandmarker.createFromModelPath(vision, MODEL_URL)
    return faceLandmarker
  } catch (err) {
    console.error('[FaceEffects] Failed to load FaceLandmarker:', err)
    throw err
  }
}

function getAveragePoint(landmarks, indices, width, height) {
  let sx = 0
  let sy = 0
  let count = 0
  for (const i of indices) {
    const p = landmarks[i]
    if (!p) continue
    sx += p.x
    sy += p.y
    count++
  }
  if (count === 0) return null
  return { x: (sx / count) * width, y: (sy / count) * height }
}

function getFaceBounds(landmarks, width, height) {
  let minX = 1
  let minY = 1
  let maxX = 0
  let maxY = 0
  for (const p of landmarks) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  const centerX = ((minX + maxX) / 2) * width
  const centerY = ((minY + maxY) / 2) * height
  return {
    minX: minX * width,
    minY: minY * height,
    maxX: maxX * width,
    maxY: maxY * height,
    centerX,
    centerY,
    width: (maxX - minX) * width,
    height: (maxY - minY) * height,
  }
}

function getHeadRoll(leftEye, rightEye) {
  const dx = rightEye.x - leftEye.x
  const dy = rightEye.y - leftEye.y
  return Math.atan2(dy, dx)
}

function withRotation(ctx, center, angle, draw) {
  ctx.save()
  ctx.translate(center.x, center.y)
  ctx.rotate(angle)
  ctx.translate(-center.x, -center.y)
  draw()
  ctx.restore()
}

export function drawEffect(ctx, landmarks, effect, width, height) {
  if (effect === 'none' || !landmarks || landmarks.length === 0) return

  const leftEye = getAveragePoint(landmarks, LEFT_EYE_INDICES, width, height)
  const rightEye = getAveragePoint(landmarks, RIGHT_EYE_INDICES, width, height)
  const faceBounds = getFaceBounds(landmarks, width, height)
  if (!leftEye || !rightEye) return

  const roll = getHeadRoll(leftEye, rightEye)

  withRotation(ctx, faceBounds.center, roll, () => {
    switch (effect) {
      case 'ears':
        drawCatEars(ctx, faceBounds)
        break
      case 'glasses':
        drawGlasses(ctx, leftEye, rightEye)
        break
      case 'hat':
        drawHat(ctx, faceBounds)
        break
      case 'mustache':
        drawMustache(ctx, landmarks, width, height, faceBounds)
        break
      default:
        break
    }
  })
}

function drawCatEars(ctx, bounds) {
  const faceWidth = bounds.width
  const topY = bounds.minY + faceWidth * 0.05
  const earSize = faceWidth * 0.35
  const innerSize = earSize * 0.45

  ctx.fillStyle = '#333333'
  ctx.strokeStyle = '#1a1a1a'
  ctx.lineWidth = Math.max(2, faceWidth * 0.02)

  drawTriangle(ctx, bounds.centerX - faceWidth * 0.28, topY + earSize * 0.25, bounds.centerX - faceWidth * 0.42, topY - earSize * 0.75, bounds.centerX - faceWidth * 0.14, topY - earSize * 0.2)
  drawTriangle(ctx, bounds.centerX + faceWidth * 0.28, topY + earSize * 0.25, bounds.centerX + faceWidth * 0.42, topY - earSize * 0.75, bounds.centerX + faceWidth * 0.14, topY - earSize * 0.2)

  ctx.fillStyle = '#ffb6c1'
  drawTriangle(ctx, bounds.centerX - faceWidth * 0.28, topY + innerSize * 0.35, bounds.centerX - faceWidth * 0.38, topY - innerSize, bounds.centerX - faceWidth * 0.18, topY - innerSize * 0.35)
  drawTriangle(ctx, bounds.centerX + faceWidth * 0.28, topY + innerSize * 0.35, bounds.centerX + faceWidth * 0.38, topY - innerSize, bounds.centerX + faceWidth * 0.18, topY - innerSize * 0.35)
}

function drawTriangle(ctx, x1, y1, x2, y2, x3, y3) {
  ctx.beginPath()
  ctx.moveTo(x1, y1)
  ctx.lineTo(x2, y2)
  ctx.lineTo(x3, y3)
  ctx.closePath()
  ctx.fill()
  ctx.stroke()
}

function drawGlasses(ctx, leftEye, rightEye) {
  const eyeDist = Math.hypot(rightEye.x - leftEye.x, rightEye.y - leftEye.y)
  const lensRadius = eyeDist * 0.42

  ctx.strokeStyle = '#1a1a1a'
  ctx.fillStyle = 'rgba(0, 0, 0, 0.75)'
  ctx.lineWidth = Math.max(3, eyeDist * 0.08)
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(leftEye.x + lensRadius * 0.7, leftEye.y)
  ctx.lineTo(rightEye.x - lensRadius * 0.7, rightEye.y)
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(leftEye.x, leftEye.y, lensRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.arc(rightEye.x, rightEye.y, lensRadius, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}

function drawHat(ctx, bounds) {
  const faceWidth = bounds.width
  const brimY = bounds.minY + faceWidth * 0.08
  const hatHeight = faceWidth * 0.55
  const hatWidth = faceWidth * 1.1

  ctx.fillStyle = '#2d1b69'
  ctx.strokeStyle = '#1a1033'
  ctx.lineWidth = Math.max(2, faceWidth * 0.02)

  ctx.beginPath()
  ctx.roundRect(bounds.centerX - hatWidth * 0.6, brimY - hatHeight, hatWidth * 1.2, faceWidth * 0.18, faceWidth * 0.05)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.roundRect(bounds.centerX - hatWidth * 0.45, brimY - hatHeight, hatWidth * 0.9, hatHeight * 0.85, faceWidth * 0.05)
  ctx.fill()
  ctx.stroke()

  ctx.fillStyle = '#ff6b4a'
  ctx.fillRect(bounds.centerX - hatWidth * 0.45, brimY - hatHeight * 0.35, hatWidth * 0.9, faceWidth * 0.12)
}

function drawMustache(ctx, landmarks, width, height, bounds) {
  const nose = landmarks[NOSE_TIP]
  const mouth = landmarks[MOUTH_UPPER]
  const forehead = landmarks[FOREHEAD_TOP]
  if (!nose || !mouth || !forehead) return

  const faceHeight = bounds.height
  const mx = ((nose.x + mouth.x) / 2) * width
  const my = ((nose.y + mouth.y) / 2) * height
  const mustacheWidth = faceHeight * 0.55
  const mustacheHeight = faceHeight * 0.12

  ctx.fillStyle = '#2a1a10'
  ctx.strokeStyle = '#1a0f08'
  ctx.lineWidth = Math.max(1, mustacheHeight * 0.15)

  ctx.beginPath()
  ctx.ellipse(mx, my, mustacheWidth / 2, mustacheHeight / 2, 0, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(mx - mustacheWidth * 0.35, my - mustacheHeight * 0.2, mustacheWidth * 0.22, mustacheHeight * 0.55, Math.PI * 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()

  ctx.beginPath()
  ctx.ellipse(mx + mustacheWidth * 0.35, my - mustacheHeight * 0.2, mustacheWidth * 0.22, mustacheHeight * 0.55, -Math.PI * 0.15, 0, Math.PI * 2)
  ctx.fill()
  ctx.stroke()
}
