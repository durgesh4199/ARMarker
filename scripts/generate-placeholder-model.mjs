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

// A full 360deg turn needs intermediate keyframes, not just start/end: a
// 360deg rotation quaternion is mathematically identical to the identity
// quaternion (quaternions double-cover SO(3)), so SLERPing directly from
// 0deg to "360deg" produces *no visible rotation at all* — that was the
// actual cause of an earlier "spin doesn't move" bug. Four quarter-turns
// gives three real intermediate keyframes and a seamless loop back to the
// start.
const axis = new THREE.Vector3(0, 1, 0)
const angles = [0, 0.5, 1, 1.5, 2].map((t) => (t / 2) * Math.PI * 2)
const times = [0, 0.5, 1, 1.5, 2]
const quaternionValues = angles.flatMap((angle) => new THREE.Quaternion().setFromAxisAngle(axis, angle).toArray())
const spinTrack = new THREE.QuaternionKeyframeTrack('.quaternion', times, quaternionValues)
const clip = new THREE.AnimationClip('Spin', 2, [spinTrack])

const exporter = new GLTFExporter()
const buffer = await exporter.parseAsync(mesh, { binary: true, animations: [clip] })
writeFileSync(new URL('../public/models/placeholder.glb', import.meta.url), Buffer.from(buffer))
console.log('wrote public/models/placeholder.glb')
