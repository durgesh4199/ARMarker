// MindAR's built-in "scanning" overlay (uiScanning: 'yes', the default)
// draws a static corner-bracket frame plus an animated scanline that
// sweeps top-to-bottom on a 2s loop (see mind-ar's src/ui/ui.js and
// scanning.html). Per request, the frame stays but the sweep goes — this
// builds the same corner-bracket look as a standalone element and passes
// its selector as MindARThree's uiScanning option, so MindAR's own
// show()/hide() calls (driven by whether any target is currently found)
// toggle this instead of its default template.
let styleInjected = false

function ensureStyleInjected() {
  if (styleInjected) return
  styleInjected = true
  const style = document.createElement('style')
  style.textContent = `
    .armarker-scan-frame {
      display: flex;
      align-items: center;
      justify-content: center;
      position: fixed;
      inset: 0;
      z-index: 2;
      pointer-events: none;
    }
    .armarker-scan-frame.hidden {
      display: none;
    }
    .armarker-scan-frame .inner {
      width: 50vh;
      height: 50vh;
      opacity: 0.8;
      background:
        linear-gradient(to right, white 10px, transparent 10px) 0 0,
        linear-gradient(to right, white 10px, transparent 10px) 0 100%,
        linear-gradient(to left, white 10px, transparent 10px) 100% 0,
        linear-gradient(to left, white 10px, transparent 10px) 100% 100%,
        linear-gradient(to bottom, white 10px, transparent 10px) 0 0,
        linear-gradient(to bottom, white 10px, transparent 10px) 100% 0,
        linear-gradient(to top, white 10px, transparent 10px) 0 100%,
        linear-gradient(to top, white 10px, transparent 10px) 100% 100%;
      background-repeat: no-repeat;
      background-size: 40px 40px;
    }
    @media (max-aspect-ratio: 1/1) {
      .armarker-scan-frame .inner {
        width: 80vw;
        height: 80vw;
      }
    }
  `
  document.head.appendChild(style)
}

// Returns the element's id (to pass as MindARThree's uiScanning option,
// prefixed with '#') and a cleanup function. Each call creates its own
// element rather than sharing one, so two ARStage instances (e.g. React
// 18 StrictMode's dev-mode double-mount) never fight over the same node.
export function createScanFrame(): { selector: string; remove: () => void } {
  ensureStyleInjected()
  const id = `armarker-scan-frame-${Math.random().toString(36).slice(2)}`
  const el = document.createElement('div')
  el.id = id
  el.className = 'armarker-scan-frame hidden'
  el.innerHTML = '<div class="inner"></div>'
  document.body.appendChild(el)
  return {
    selector: `#${id}`,
    remove: () => el.remove(),
  }
}
