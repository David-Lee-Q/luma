interface QualityRingProps {
  score: number
  size?: number
  label?: string
}

export function QualityRing({ score, size = 52, label = '画质' }: QualityRingProps) {
  const radius = (size - 7) / 2
  const circumference = 2 * Math.PI * radius
  const clamped = Math.max(0, Math.min(100, score))
  const offset = circumference * (1 - clamped / 100)
  const tone = clamped >= 72 ? 'good' : clamped >= 48 ? 'fair' : 'poor'

  return (
    <div className={`quality quality--${tone}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          className="quality-track"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="3"
        />
        <circle
          className="quality-value"
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <span className="quality-number">{clamped}</span>
      <span className="quality-label">{label}</span>
    </div>
  )
}
