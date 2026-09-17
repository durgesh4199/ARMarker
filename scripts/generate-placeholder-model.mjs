// Generates a small placeholder animated .glb — no 3D art exists yet (see
// CLAUDE.md's answers), and the M2 model renderer needs *something* real to
// load, DRACO/KTX2-decode-path and all, to prove itself against.
// GLTFExporter needs `FileReader`, which Node doesn't have (it's DOM-only);
// Node 18+ does have a global `Blob`, so a minimal readAsArrayBuffer-only
// shim is enough to cover the paths GLTFExporter's binary export takes.
class FileReaderPolyfill {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((buffer) => {
      this.result = buffer
      this.onloadend?.()
    })
  }
}
globalThis.FileReader = FileReaderPolyfill

import * as THREE from 'three'
import { GLTFExporter } from 'three/addons/exporters/GLTFExporter.js'
import { writeFileSync } from 'fs'

const geometry = new THREE.IcosahedronGeometry(0.15, 0)
const material = new THREE.MeshStandardMaterial({ color: 0x2f7de1, metalness: 0.2, roughness: 0.5 })
const mesh = new THREE.Mesh(geometry, material)
mesh.name = 'PlaceholderModel'

const q0 = new THREE.Quaternion()
const q1 = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), Math.PI * 2)
const spinTrack = new THREE.QuaternionKeyframeTrack(
  '.quaternion',
  [0, 2],
  [q0.x, q0.y, q0.z, q0.w, q1.x, q1.y, q1.z, q1.w],
)
const clip = new THREE.AnimationClip('Spin', 2, [spinTrack])

const exporter = new GLTFExporter()
const buffer = await exporter.parseAsync(mesh, { binary: true, animations: [clip] })
writeFileSync(new URL('../public/models/placeholder.glb', import.meta.url), Buffer.from(buffer))
console.log('wrote public/models/placeholder.glb')
