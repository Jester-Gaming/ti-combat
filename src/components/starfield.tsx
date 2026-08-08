import { useEffect, useRef } from 'react'

interface Star {
  x: number
  y: number
  r: number
  alpha: number
  speed: number
  dir: number
  twinkleOffset: number
}

interface Streak {
  startX: number
  startY: number
  endX: number
  endY: number
  progress: number
  speed: number
}

export function Starfield() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const canvasElement: HTMLCanvasElement = canvas

    const context = canvas.getContext('2d')
    if (!context) return

    const ctx: CanvasRenderingContext2D = context

    let animFrameId: number
    const stars: Star[] = []
    const NUM_STARS = 180

    let streak: Streak | null = null
    let nextStreakTime = 30000 + Math.random() * 15000
    let lastTime = 0

    function resize() {
      canvasElement.width = window.innerWidth
      canvasElement.height = window.innerHeight
    }

    function initStars() {
      stars.length = 0

      for (let i = 0; i < NUM_STARS; i++) {
        stars.push({
          x: Math.random() * canvasElement.width,
          y: Math.random() * canvasElement.height,
          r: Math.random() * 1.4 + 0.2,
          alpha: Math.random() * 0.7 + 0.2,
          speed: Math.random() * 0.3 + 0.05,
          dir: Math.random() > 0.5 ? 1 : -1,
          twinkleOffset: Math.random() * Math.PI * 2,
        })
      }
    }

    function createStreak() {
      const startX = Math.random() * canvasElement.width
      const startY = Math.random() * canvasElement.height * 0.65

      const distance = canvasElement.width * (0.35 + Math.random() * 0.3)
      const direction = Math.random() > 0.5 ? 1 : -1

      streak = {
        startX,
        startY,
        endX: startX + distance * direction,
        endY: startY + distance * (0.5 + Math.random() * 0.5),
        progress: 0,
        speed: 0.02 + Math.random() * 0.01,
      }
    }

    resize()
    initStars()

    const resizeObserver = new ResizeObserver(() => {
      resize()
      initStars()
    })

    resizeObserver.observe(canvasElement)

    let t = 0

    function draw(timestamp: number) {
      ctx.fillStyle = '#050814'
      ctx.fillRect(0, 0, canvasElement.width, canvasElement.height)

      t += 0.012

      // Meteor timing
      if (timestamp - lastTime > nextStreakTime) {
        createStreak()
        lastTime = timestamp
        nextStreakTime = 30000 + Math.random() * 20000
      }

      // Nebula clouds
      const nebula = [
        {
          x: canvasElement.width * 0.25,
          y: canvasElement.height * 0.35,
          size: canvasElement.width * 0.6,
          color: 'rgba(90, 60, 200, 0.5)',
        },
        {
          x: canvasElement.width * 0.75,
          y: canvasElement.height * 0.7,
          size: canvasElement.width * 0.5,
          color: 'rgba(30, 140, 220, 0.4)',
        },
      ]

      for (const n of nebula) {
        const gradient = ctx.createRadialGradient(
          n.x + Math.sin(t * 0.2) * 50,
          n.y + Math.cos(t * 0.15) * 40,
          0,
          n.x,
          n.y,
          n.size,
        )

        gradient.addColorStop(0, n.color)
        gradient.addColorStop(1, 'rgba(0,0,0,0)')

        ctx.fillStyle = gradient
        ctx.fillRect(0, 0, canvasElement.width, canvasElement.height)
      }

      // Meteor streak
      if (streak) {
        streak.progress += streak.speed

        const x =
          streak.startX + (streak.endX - streak.startX) * streak.progress

        const y =
          streak.startY + (streak.endY - streak.startY) * streak.progress

        const tailLength = 0.25
        const tailProgress = Math.max(0, streak.progress - tailLength)

        const tailX =
          streak.startX + (streak.endX - streak.startX) * tailProgress

        const tailY =
          streak.startY + (streak.endY - streak.startY) * tailProgress

        const gradient = ctx.createLinearGradient(tailX, tailY, x, y)

        gradient.addColorStop(0, 'rgba(255,255,255,0)')
        gradient.addColorStop(0.65, 'rgba(220,235,255,0.35)')
        gradient.addColorStop(1, 'rgba(255,255,255,1)')

        ctx.strokeStyle = gradient
        ctx.lineWidth = 1.5 + Math.random()

        ctx.beginPath()
        ctx.moveTo(tailX, tailY)
        ctx.lineTo(x, y)
        ctx.stroke()

        // Meteor head glow
        ctx.beginPath()
        ctx.arc(x, y, 2.5, 0, Math.PI * 2)

        ctx.fillStyle = 'rgba(255,255,255,0.9)'
        ctx.shadowBlur = 12
        ctx.shadowColor = 'rgba(220,235,255,0.9)'
        ctx.fill()

        ctx.shadowBlur = 0

        if (streak.progress >= 1) {
          streak = null
        }
      }

      // Stars
      for (const s of stars) {
        const twinkle =
          0.4 + 0.6 * Math.abs(Math.sin(t * s.speed * 4 + s.twinkleOffset))

        ctx.beginPath()
        ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(230,235,255,${s.alpha * twinkle})`
        ctx.fill()
      }

      animFrameId = requestAnimationFrame(draw)
    }

    animFrameId = requestAnimationFrame(draw)

    return () => {
      cancelAnimationFrame(animFrameId)
      resizeObserver.disconnect()
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: '100vw',
        height: '100vh',
        display: 'block',
        pointerEvents: 'none',
        zIndex: 0,
      }}
    />
  )
}
