import { AnimatePresence } from 'motion/react'
import { Route, Routes, useLocation } from 'react-router'
import { ArRoute } from './routes/ArRoute'
import { BundlePicker } from './routes/BundlePicker'
import { Home } from './routes/Home'
import { HowToScan } from './routes/HowToScan'

function App() {
  const location = useLocation()

  return (
    // mode="wait": the leaving screen finishes its exit before the next
    // one mounts, rather than cross-fading two full-screen layouts on top
    // of each other. The AR route deliberately has no exit animation of
    // its own (see ArRoute) — it owns a live camera/GL session that
    // should tear down immediately on navigating away, not linger for a
    // transition.
    <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
        <Route path="/" element={<Home />} />
        <Route path="/bundles" element={<BundlePicker />} />
        <Route path="/how-to-scan/:bundleId" element={<HowToScan />} />
        <Route path="/ar/:bundleId" element={<ArRoute />} />
      </Routes>
    </AnimatePresence>
  )
}

export default App
