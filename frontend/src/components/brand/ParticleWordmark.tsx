import { useEffect, useRef, useState } from 'react'

interface ParticleWordmarkProps {
  onAssembleComplete?: () => void
}

interface Particle {
  startX: number
  startY: number
  targetX: number
  targetY: number
  size: number
  color: string
  delay: number
}

const PALETTE = ['#1A4D38', '#1A4D38', '#1E1D1A', '#5C7A67', '#C25E3A']

function easeOutCubic(t: number): number {
  return 1 - Math.pow(1 - t, 3)
}

function deterministicUnit(seed: number): number {
  const raw = Math.sin(seed * 12.9898 + 78.233) * 43758.5453
  return raw - Math.floor(raw)
}

/**
 * Lightweight, reduced-motion-safe particle assembly introducing the QUEUELESS wordmark once on mount.
 * Stops rendering particles cleanly once the static typographic wordmark settles in place.
 */
export function ParticleWordmark({ onAssembleComplete }: ParticleWordmarkProps) {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const completedRef = useRef(false)
  const [settled, setSettled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  })

  useEffect(() => {
    const notifyDone = () => {
      if (!completedRef.current) {
        completedRef.current = true
        onAssembleComplete?.()
      }
    }

    if (typeof window === 'undefined') {
      notifyDone()
      return
    }

    const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)')
    if (mediaQuery.matches || settled) {
      notifyDone()
      return
    }

    const container = containerRef.current
    const canvas = canvasRef.current
    if (!container || !canvas) {
      notifyDone()
      return
    }

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      notifyDone()
      return
    }

    const width = Math.max(280, Math.min(container.clientWidth || 560, 620))
    const height = width < 420 ? 64 : 84
    const dpr = Math.min(window.devicePixelRatio || 1, 2)

    canvas.width = Math.floor(width * dpr)
    canvas.height = Math.floor(height * dpr)
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // Render target text on an offscreen sample canvas to collect target particle coordinates.
    const offscreen = document.createElement('canvas')
    offscreen.width = width
    offscreen.height = height
    const octx = offscreen.getContext('2d')
    if (!octx) {
      notifyDone()
      return
    }

    const fontSize = width < 380 ? 36 : width < 500 ? 48 : 58
    octx.clearRect(0, 0, width, height)
    octx.fillStyle = '#1E1D1A'
    octx.font = `700 ${fontSize}px Inter, system-ui, -apple-system, sans-serif`
    octx.textAlign = 'left'
    octx.textBaseline = 'middle'
    octx.fillText('QUEUELESS', 4, height / 2)

    const pixels = octx.getImageData(0, 0, width, height).data
    const step = width < 420 ? 4 : 4
    const targets: { x: number; y: number }[] = []

    for (let y = 0; y < height; y += step) {
      for (let x = 0; x < width; x += step) {
        const alpha = pixels[(y * width + x) * 4 + 3]
        if (alpha > 140) {
          targets.push({ x, y })
        }
      }
    }

    // Cap particle count to keep rendering restrained and silky at 60fps.
    const maxParticles = 300
    const stride = Math.max(1, Math.ceil(targets.length / maxParticles))
    const particles: Particle[] = []
    for (let i = 0; i < targets.length; i += stride) {
      const target = targets[i]
      const r1 = deterministicUnit(i + 1)
      const r2 = deterministicUnit(i + 101)
      const r3 = deterministicUnit(i + 211)
      const angle = r1 * Math.PI * 2
      const radius = 26 + r2 * 62
      particles.push({
        startX: target.x + Math.cos(angle) * radius,
        startY: target.y + Math.sin(angle) * (radius * 0.48),
        targetX: target.x,
        targetY: target.y,
        size: r3 > 0.72 ? 2.4 : 1.85,
        color: PALETTE[i % PALETTE.length],
        delay: (target.x / width) * 0.22,
      })
    }

    let rafId = 0
    const durationMs = 1150
    const startTime = performance.now()

    const renderFrame = (now: number) => {
      const rawProgress = Math.min(1, (now - startTime) / durationMs)
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
      ctx.clearRect(0, 0, width, height)

      // Fade particle overlay softly in the final 15% as crisp SVG/text wordmark takes over.
      const particleAlpha =
        rawProgress < 0.85 ? 1 : Math.max(0, 1 - (rawProgress - 0.85) / 0.15)

      for (const p of particles) {
        const localProgress = Math.max(
          0,
          Math.min(1, (rawProgress - p.delay) / (1 - p.delay)),
        )
        const eased = easeOutCubic(localProgress)
        const x = p.startX + (p.targetX - p.startX) * eased
        const y = p.startY + (p.targetY - p.startY) * eased
        ctx.globalAlpha = Math.min(1, 0.25 + localProgress * 0.75) * particleAlpha
        ctx.fillStyle = p.color
        ctx.beginPath()
        ctx.arc(x, y, p.size, 0, Math.PI * 2)
        ctx.fill()
      }

      if (rawProgress < 1) {
        rafId = window.requestAnimationFrame(renderFrame)
      } else {
        setSettled(true)
        notifyDone()
      }
    }

    rafId = window.requestAnimationFrame(renderFrame)

    return () => {
      window.cancelAnimationFrame(rafId)
    }
  }, [onAssembleComplete, settled])

  return (
    <div
      ref={containerRef}
      className="relative flex min-h-[64px] items-center sm:min-h-[84px]"
    >
      <h1
        className={`font-bold tracking-[0.06em] text-[#1E1D1A] transition-opacity duration-300 text-[36px] sm:text-[48px] lg:text-[56px] leading-none ${
          settled ? 'opacity-100' : 'opacity-0'
        }`}
      >
        QUEUE<span className="text-[#1A4D38]">LESS</span>
      </h1>

      {!settled && (
        <canvas
          ref={canvasRef}
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0"
        />
      )}
    </div>
  )
}

