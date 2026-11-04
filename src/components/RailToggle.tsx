import { ChevronLeft, ChevronRight } from 'lucide-react'

/** Edge tab that shows/hides a floating rail so the chart can go full-bleed. */
export function RailToggle({
  side,
  open,
  onToggle,
  label,
}: {
  side: 'left' | 'right'
  open: boolean
  onToggle: () => void
  label: string
}) {
  // When the rail is open the tab sits just inside its edge; when hidden it
  // parks against the viewport edge.
  return (
    <button
      type="button"
      className={`rail-toggle rail-toggle--${side} ${open ? 'is-open' : ''}`}
      onClick={onToggle}
      aria-label={open ? `隐藏${label}` : `显示${label}`}
      aria-expanded={open}
      title={open ? `隐藏${label}` : `显示${label}`}
    >
      {side === 'left' ? (
        open ? <ChevronLeft size={12} /> : <ChevronRight size={12} />
      ) : open ? (
        <ChevronRight size={12} />
      ) : (
        <ChevronLeft size={12} />
      )}
    </button>
  )
}
