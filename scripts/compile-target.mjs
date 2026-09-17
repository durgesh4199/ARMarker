// Compiles source marker images into a .mind file MindAR can load at runtime.
// Usage: node scripts/compile-target.mjs <bundle-id> <image-path> [<image-path> ...]
//
// Regenerate whenever a marker image in targets/<bundle-id>/ changes. Index
// order matches the argument order (see the TargetEntry.index contract in
// the manifest types) — pass images in the same order the manifest expects.
import { loadImage } from 'canvas'
import { writeFileSync } from 'fs'
import { OfflineCompiler } from 'mind-ar/src/image-target/offline-compiler.js'
import * as tf from '@tensorflow/tfjs'

const [bundleId, ...imagePaths] = process.argv.slice(2)
if (!bundleId || imagePaths.length === 0) {
  console.error('Usage: node scripts/compile-target.mjs <bundle-id> <image-path> [<image-path> ...]')
  process.exit(1)
}

await tf.setBackend('cpu')
await tf.ready()

const images = await Promise.all(imagePaths.map((p) => loadImage(p)))

const compiler = new OfflineCompiler()
await compiler.compileImageTargets(images, (percent) => {
  process.stdout.write(`\rcompiling ${bundleId}: ${percent.toFixed(1)}%`)
})
process.stdout.write('\n')

const buffer = compiler.exportData()
const outPath = new URL(`../public/targets/${bundleId}.mind`, import.meta.url)
writeFileSync(outPath, buffer)
console.log(`wrote public/targets/${bundleId}.mind (${imagePaths.length} target${imagePaths.length === 1 ? '' : 's'})`)
