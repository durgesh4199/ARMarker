import { DebugOverlay } from './debug/DebugOverlay'
import { useDebugMode } from './debug/useDebugMode'

function App() {
  const debugMode = useDebugMode()

  return (
    <>
      <main>
        <h1>ARMarker</h1>
        <p>Milestone 0 harness. Routing, bundle picker, and AR view land in later milestones.</p>
      </main>
      {debugMode && <DebugOverlay />}
    </>
  )
}

export default App
