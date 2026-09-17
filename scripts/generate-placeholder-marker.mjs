import { createCanvas } from 'canvas'
import { writeFileSync } from 'fs'

// Deterministic PRNG so the placeholder is reproducible across regenerations.
function mulberry32(seed) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

const SIZE = 512
const rand = mulberry32(20260917)
const canvas = createCanvas(SIZE, SIZE)
const ctx = canvas.getContext('2d')

ctx.fillStyle = '#ffffff'
ctx.fillRect(0, 0, SIZE, SIZE)

// Stratified placement: one small shape per grid cell, jittered within the
// cell and randomized in size/rotation/type. This keeps trackable features
// (corners/edges) small and *evenly spread* across the whole marker — the
// first placeholder packed large overlapping blobs into one corner and left
// other regions sparse, which starved MindAR's tracker of stable points
// outside that corner and showed up as pose drift on a real phone. Capping
// shape size well below the cell size also avoids any shape merging into a
// low-detail blob the way the old circles did.
const CELLS = 16
const CELL = SIZE / CELLS

for (let row = 0; row < CELLS; row++) {
  for (let col = 0; col < CELLS; col++) {
    const cx = col * CELL + CELL / 2 + (rand() - 0.5) * CELL * 0.5
    const cy = row * CELL + CELL / 2 + (rand() - 0.5) * CELL * 0.5
    const size = CELL * (0.35 + rand() * 0.35)

    ctx.fillStyle = '#000000'
    ctx.globalAlpha = 0.8 + rand() * 0.2

    const shapeType = Math.floor(rand() * 3)
    if (shapeType === 0) {
      ctx.beginPath()
      ctx.arc(cx, cy, size / 2, 0, Math.PI * 2)
      ctx.fill()
    } else if (shapeType === 1) {
      ctx.save()
      ctx.translate(cx, cy)
      ctx.rotate(rand() * Math.PI)
      ctx.fillRect(-size / 2, -size / 4, size, size / 2)
      ctx.restore()
    } else {
      ctx.beginPath()
      ctx.moveTo(cx, cy - size / 2)
      ctx.lineTo(cx + size / 2, cy + size / 2)
      ctx.lineTo(cx - size / 2, cy + size / 2)
      ctx.closePath()
      ctx.fill()
    }
  }
}
ctx.globalAlpha = 1

// Four asymmetric corner marks (different per corner) so the tracker — and
// a human glancing at the printed marker — has an unambiguous orientation
// reference, without introducing any large flat region.
ctx.fillRect(14, 14, 34, 10)
ctx.fillRect(14, 14, 10, 34)
ctx.beginPath()
ctx.arc(SIZE - 30, 30, 16, 0, Math.PI * 2)
ctx.fill()
ctx.fillRect(SIZE - 46, SIZE - 22, 32, 10)
ctx.beginPath()
ctx.moveTo(30, SIZE - 44)
ctx.lineTo(46, SIZE - 14)
ctx.lineTo(14, SIZE - 14)
ctx.closePath()
ctx.fill()

writeFileSync(new URL('../targets/m1-spike/00-cube-marker.png', import.meta.url), canvas.toBuffer('image/png'))
console.log('wrote targets/m1-spike/00-cube-marker.png')
