import * as THREE from 'three'
import type { ContentItem } from '../../content/types'
import { useGameSurfaceStore } from '../gameSurfaceStore'
import { createCanvasSurface } from './canvasSurface'
import type { ContentHandle } from './types'

const BG_COLOR = 'rgba(10, 12, 20, 0.85)'
const GROUND_COLOR = 'rgba(255, 255, 255, 0.35)'
const CHAR_COLOR = '#4ade80'
const OBSTACLE_COLOR = '#f87171'
const GAME_OVER_OVERLAY = 'rgba(10, 12, 20, 0.45)'

const GROUND_Y_FRACTION = 0.82
const CHAR_SIZE_FRACTION = 0.13
const CHAR_X_FRACTION = 0.15
const GRAVITY = 1400 // canvas px/s^2
// height = v^2/(2*GRAVITY), air time = 2*|v|/GRAVITY — at -420 that's a
// ~63px-tall, ~0.6s hop (was -320/~37px/~0.46s, which read as barely
// clearing anything). Tune both together if this still isn't enough:
// GRAVITY down also stretches the arc without needing more velocity.
const JUMP_VELOCITY = -420 // canvas px/s, upward (negative y)
const BASE_SPEED = 140 // canvas px/s, obstacles scrolling left
const SPEED_RAMP = 6 // px/s of extra speed per second survived
const MAX_SPEED = 320
const SPAWN_MIN_S = 0.9
const SPAWN_MAX_S = 1.7
const SCORE_PER_SECOND = 10

interface Obstacle {
  x: number
  width: number
  height: number
}

function randomSpawnDelay() {
  return SPAWN_MIN_S + Math.random() * (SPAWN_MAX_S - SPAWN_MIN_S)
}

// A Chrome-Dino-style endless runner: tap to jump the character over
// obstacles scrolling in from the right, survive to score. Same
// canvas-texture-plane technique as gameSurfaceRenderer.ts (see that
// file's doc comment for why: it's the "true 3D, tilts with the marker"
// counterpart to a 'dom' overlay, and reuses ARStage's existing raycast
// hit-testing for taps). Unlike the dot game, this needs continuous
// per-frame physics (gravity, scroll, collision), not just an occasional
// eased lerp — update() runs every frame regardless of animation state,
// the same way the model renderer's AnimationMixer does.
//
// No text is drawn on the canvas (CLAUDE.md section 5.3) — score and the
// game-over/restart prompt are the paired 'dom' SurfaceScore item, same
// as the dot game, sharing gameOver/score state through gameSurfaceStore.
export function createRunnerGameRenderer(item: ContentItem, anchor: THREE.Group): ContentHandle {
  if (!item.gameId) throw new Error("content item of type 'game' missing 'gameId' (the manifest schema should have caught this)")
  const gameId = item.gameId

  const surface = createCanvasSurface(item, anchor)
  const { ctx, canvasWidth, canvasHeight } = surface

  const groundY = canvasHeight * GROUND_Y_FRACTION
  const charSize = canvasWidth * CHAR_SIZE_FRACTION
  const charX = canvasWidth * CHAR_X_FRACTION
  const groundedY = groundY - charSize

  let charY = groundedY
  let velocity = 0
  let grounded = true
  let obstacles: Obstacle[] = []
  let spawnTimer = randomSpawnDelay()
  let elapsed = 0
  let lastScoreSet = -1
  let gameOver = false

  function reset() {
    charY = groundedY
    velocity = 0
    grounded = true
    obstacles = []
    spawnTimer = randomSpawnDelay()
    elapsed = 0
    lastScoreSet = -1
    gameOver = false
    // Resets both score and gameOver together (see gameSurfaceStore) —
    // the same action the very first startGame() call below uses.
    useGameSurfaceStore.getState().startGame(gameId)
  }

  function draw() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight)
    ctx.fillStyle = BG_COLOR
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    ctx.strokeStyle = GROUND_COLOR
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(0, groundY)
    ctx.lineTo(canvasWidth, groundY)
    ctx.stroke()

    ctx.fillStyle = OBSTACLE_COLOR
    for (const obstacle of obstacles) {
      ctx.fillRect(obstacle.x, groundY - obstacle.height, obstacle.width, obstacle.height)
    }

    ctx.fillStyle = CHAR_COLOR
    ctx.beginPath()
    // roundRect landed in most engines in 2022-2023 — guard it rather than
    // assume, since a throw here would blank the whole canvas every frame.
    if (ctx.roundRect) {
      ctx.roundRect(charX, charY, charSize, charSize, charSize * 0.25)
    } else {
      ctx.rect(charX, charY, charSize, charSize)
    }
    ctx.fill()

    if (gameOver) {
      ctx.fillStyle = GAME_OVER_OVERLAY
      ctx.fillRect(0, 0, canvasWidth, canvasHeight)
    }

    surface.markDirty()
  }
  draw()

  useGameSurfaceStore.getState().startGame(gameId)

  return {
    object: surface.mesh,
    show() {},
    hide() {},
    onInteract() {
      if (gameOver) {
        reset()
        draw()
        return
      }
      if (!grounded) return
      velocity = JUMP_VELOCITY
      grounded = false
    },
    update(deltaSeconds) {
      if (gameOver) return

      elapsed += deltaSeconds
      const speed = Math.min(BASE_SPEED + elapsed * SPEED_RAMP, MAX_SPEED)

      if (!grounded) {
        velocity += GRAVITY * deltaSeconds
        charY += velocity * deltaSeconds
        if (charY >= groundedY) {
          charY = groundedY
          velocity = 0
          grounded = true
        }
      }

      spawnTimer -= deltaSeconds
      if (spawnTimer <= 0) {
        const height = canvasHeight * (0.12 + Math.random() * 0.1)
        const width = canvasWidth * 0.07
        obstacles.push({ x: canvasWidth, width, height })
        spawnTimer = randomSpawnDelay()
      }

      for (const obstacle of obstacles) obstacle.x -= speed * deltaSeconds
      obstacles = obstacles.filter((obstacle) => obstacle.x + obstacle.width > 0)

      for (const obstacle of obstacles) {
        const overlapsX = charX < obstacle.x + obstacle.width && charX + charSize > obstacle.x
        const overlapsY = charY + charSize > groundY - obstacle.height
        if (overlapsX && overlapsY) {
          gameOver = true
          useGameSurfaceStore.getState().setGameOver(gameId, true)
          break
        }
      }

      const score = Math.floor(elapsed * SCORE_PER_SECOND)
      if (score !== lastScoreSet) {
        lastScoreSet = score
        useGameSurfaceStore.getState().setScore(gameId, score)
      }

      draw()
    },
    dispose() {
      surface.dispose()
    },
  }
}
