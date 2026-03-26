import { useState, useRef, useCallback } from 'react'

interface Props {
  value: { x: number; y: number } | null
  onChange: (loc: { x: number; y: number } | null) => void
  hitType?: string | null
}

/** Interactive baseball field -- tap or drag to mark where the ball went */
export default function FieldTapInput({ value, onChange, hitType }: Props) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [isDragging, setIsDragging] = useState(false)

  const w = 300, h = 320
  const home = { x: 150, y: 285 }
  const first = { x: 222, y: 210 }
  const second = { x: 150, y: 145 }
  const third = { x: 78, y: 210 }
  const arcR = 250

  // Convert SVG coordinates to percentage (0-100)
  function svgToPercent(svgX: number, svgY: number) {
    const x = Math.max(0, Math.min(100, ((svgX - 10) / (w - 20)) * 100))
    const y = Math.max(0, Math.min(100, ((svgY - 10) / (h - 40)) * 100))
    return { x: Math.round(x * 10) / 10, y: Math.round(y * 10) / 10 }
  }

  // Convert percentage to SVG coordinates (for rendering)
  function toSvg(loc: { x: number; y: number }) {
    return {
      x: 10 + (loc.x / 100) * (w - 20),
      y: 10 + (loc.y / 100) * (h - 40),
    }
  }

  const getSvgPoint = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!svgRef.current) return null
    const svg = svgRef.current
    const rect = svg.getBoundingClientRect()
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const svgX = ((clientX - rect.left) / rect.width) * w
    const svgY = ((clientY - rect.top) / rect.height) * h
    return svgToPercent(svgX, svgY)
  }, [])

  const handlePointerDown = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    e.preventDefault()
    setIsDragging(true)
    const pt = getSvgPoint(e)
    if (pt) onChange(pt)
  }, [getSvgPoint, onChange])

  const handlePointerMove = useCallback((e: React.MouseEvent | React.TouchEvent) => {
    if (!isDragging) return
    e.preventDefault()
    const pt = getSvgPoint(e)
    if (pt) onChange(pt)
  }, [isDragging, getSvgPoint, onChange])

  const handlePointerUp = useCallback(() => {
    setIsDragging(false)
  }, [])

  // Hit type icon at the marked location
  const hitLabel = hitType === 'ground_ball' ? 'GB'
    : hitType === 'fly_ball' ? 'FB'
    : hitType === 'pop_fly' ? 'PF'
    : hitType === 'line_drive' ? 'LD'
    : null

  const dot = value ? toSvg(value) : null

  return (
    <div className="relative">
      <p className="text-white/40 text-xs font-accent uppercase tracking-wider text-center mb-2">
        Tap where the ball went
      </p>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${w} ${h}`}
        className="w-full max-w-[300px] mx-auto cursor-crosshair touch-none select-none"
        onMouseDown={handlePointerDown}
        onMouseMove={handlePointerMove}
        onMouseUp={handlePointerUp}
        onMouseLeave={handlePointerUp}
        onTouchStart={handlePointerDown}
        onTouchMove={handlePointerMove}
        onTouchEnd={handlePointerUp}
      >
        {/* Grass/outfield */}
        <path
          d={`M ${home.x} ${home.y} L ${third.x - 60} ${third.y - 80} A ${arcR} ${arcR} 0 0 1 ${first.x + 60} ${first.y - 80} Z`}
          fill="rgba(34,120,60,0.25)"
          stroke="rgba(255,255,255,0.15)"
          strokeWidth="1.5"
        />
        {/* Infield diamond */}
        <polygon
          points={`${home.x},${home.y} ${first.x},${first.y} ${second.x},${second.y} ${third.x},${third.y}`}
          fill="rgba(139,90,43,0.15)"
          stroke="rgba(255,255,255,0.2)"
          strokeWidth="1"
        />
        {/* Base dots */}
        {[home, first, second, third].map((b, i) => (
          <g key={i}>
            <rect
              x={b.x - 4} y={b.y - 4} width={8} height={8}
              fill="rgba(255,255,255,0.4)"
              transform={`rotate(45 ${b.x} ${b.y})`}
            />
          </g>
        ))}
        {/* Pitcher mound */}
        <circle cx={150} cy={215} r={5} fill="rgba(255,255,255,0.2)" />

        {/* Zone labels */}
        <text x={40} y={120} fontSize="9" fill="rgba(255,255,255,0.2)" textAnchor="middle">LF</text>
        <text x={150} y={80} fontSize="9" fill="rgba(255,255,255,0.2)" textAnchor="middle">CF</text>
        <text x={260} y={120} fontSize="9" fill="rgba(255,255,255,0.2)" textAnchor="middle">RF</text>
        <text x={68} y={230} fontSize="8" fill="rgba(255,255,255,0.15)" textAnchor="middle">3B</text>
        <text x={150} y={165} fontSize="8" fill="rgba(255,255,255,0.15)" textAnchor="middle">SS/2B</text>
        <text x={232} y={230} fontSize="8" fill="rgba(255,255,255,0.15)" textAnchor="middle">1B</text>

        {/* Selected location */}
        {dot && (
          <g>
            {/* Line from home to dot */}
            <line
              x1={home.x} y1={home.y}
              x2={dot.x} y2={dot.y}
              stroke="#f5b800"
              strokeWidth="2"
              opacity="0.6"
              strokeDasharray="4 3"
            />
            {/* Pulsing ring */}
            <circle cx={dot.x} cy={dot.y} r={16} fill="none" stroke="#f5b800" strokeWidth="1.5" opacity="0.3">
              <animate attributeName="r" from="14" to="22" dur="1.2s" repeatCount="indefinite" />
              <animate attributeName="opacity" from="0.4" to="0" dur="1.2s" repeatCount="indefinite" />
            </circle>
            {/* Dot */}
            <circle cx={dot.x} cy={dot.y} r={14} fill="#f5b800" opacity="0.9" />
            <text
              x={dot.x} y={dot.y + 4}
              textAnchor="middle"
              fontSize="10"
              fontWeight="bold"
              fill="#0a1628"
            >
              {hitLabel || '\u2022'}
            </text>
          </g>
        )}
      </svg>

      {value && (
        <button
          onClick={() => onChange(null)}
          className="mt-2 mx-auto block text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          Clear location
        </button>
      )}
    </div>
  )
}
