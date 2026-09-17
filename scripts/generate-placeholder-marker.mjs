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

// Asymmetric, non-repeating, high-contrast, feature-dense shapes —
// the trackability constraints from the project brief section 11.3.
for (let i = 0; i < 120; i++) {
  const x = rand() * SIZE
  const y = rand() * SIZE
  const size = 8 + rand() * 48
  const shade = rand() < 0.5 ? '#000000' : '#000000'
  ctx.globalAlpha = 0.85 + rand() * 0.15
  ctx.fillStyle = shade
  const shapeType = Math.floor(rand() * 3)
  if (shapeType === 0) {
    ctx.beginPath()
    ctx.arc(x, y, size / 2, 0, Math.PI * 2)
    ctx.fill()
  } else if (shapeType === 1) {
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rand() * Math.PI)
    ctx.fillRect(-size / 2, -size / 4, size, size / 2)
    ctx.restore()
  } else {
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + size * (rand() - 0.5), y + size)
    ctx.lineTo(x - size * (rand() - 0.5), y + size)
    ctx.closePath()
    ctx.fill()
  }
}
ctx.globalAlpha = 1

// A handful of larger anchor shapes to break up any residual regularity
// and give the tracker strong high-scale features too.
ctx.fillStyle = '#000000'
ctx.fillRect(30, 30, 90, 14)
ctx.fillRect(30, 30, 14, 70)
ctx.beginPath()
ctx.arc(SIZE - 90, SIZE - 90, 46, 0, Math.PI * 2)
ctx.fill()
ctx.save()
ctx.translate(SIZE - 70, 90)
ctx.rotate(0.4)
ctx.fillRect(-60, -10, 120, 20)
ctx.restore()

writeFileSync(new URL('../targets/m1-spike/00-cube-marker.png', import.meta.url), canvas.toBuffer('image/png'))
console.log('wrote targets/m1-spike/00-cube-marker.png')
