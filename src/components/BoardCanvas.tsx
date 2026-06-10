import { useEffect, useRef, useState } from 'react'
import { useGraphStore } from '../store/graphStore'
import { useUIStore } from '../store/uiStore'
import { initLayout } from '../lib/initLayout'
import { VIEW_W, VIEW_H } from '../lib/layout'
import { EdgeLayer } from './EdgeLayer'
import { Card } from './Card'
import { RipplePulseLayer } from './RipplePulseLayer'
import { TagLayer } from './TagLayer'

// ─────────────────────────────────────────────────────────────────────────
// BoardCanvas — 보드 + zoom + 자유 pan.
//
//   cardZoom = 1.0       → 보드 전체가 wrapper에 fit. pan 의미 X.
//   cardZoom > 1.0       → SVG가 wrapper보다 큼. 자유 pan으로 둘러봄.
//
// cursor:
//   - 빈 영역 = grab (default), 잡는 중 = grabbing
//   - 카드 위 = zoom-in (Card 컴포넌트가 자체 cursor 박음)
// ─────────────────────────────────────────────────────────────────────────

const DRAG_THRESHOLD_PX = 5

export function BoardCanvas() {
  const nodes = useGraphStore((s) => s.nodes)
  const clearSelection = useUIStore((s) => s.clearSelection)
  const cardZoom = useUIStore((s) => s.cardZoom)

  const wrapperRef = useRef<HTMLDivElement>(null)
  const [pan, setPan] = useState({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStart = useRef<{
    x: number; y: number; panX: number; panY: number; moved: boolean
  } | null>(null)

  useEffect(() => {
    initLayout()
  }, [])

  // zoom 1.0으로 돌아오면 pan 0 리셋.
  useEffect(() => {
    if (cardZoom <= 1.0 + 0.001) setPan({ x: 0, y: 0 })
  }, [cardZoom])

  // pan clamp — SVG가 wrapper 밖으로 너무 나가지 않게.
  const clampPan = (px: number, py: number) => {
    const wrap = wrapperRef.current
    if (!wrap) return { x: px, y: py }
    const wrapW = wrap.clientWidth
    const wrapH = wrap.clientHeight
    // SVG 실제 표시 크기 = wrapper × cardZoom (width/height %로 정함)
    const svgW = wrapW * cardZoom
    const svgH = wrapH * cardZoom
    const minX = Math.min(0, wrapW - svgW)   // 음수 또는 0
    const minY = Math.min(0, wrapH - svgH)
    return {
      x: Math.min(0, Math.max(minX, px)),
      y: Math.min(0, Math.max(minY, py)),
    }
  }

  const handlePointerDown = (e: React.PointerEvent) => {
    dragStart.current = {
      x: e.clientX,
      y: e.clientY,
      panX: pan.x,
      panY: pan.y,
      moved: false,
    }
  }

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return
    const dx = e.clientX - dragStart.current.x
    const dy = e.clientY - dragStart.current.y
    if (!dragStart.current.moved && Math.hypot(dx, dy) > DRAG_THRESHOLD_PX) {
      dragStart.current.moved = true
      setIsDragging(true)
      e.currentTarget.setPointerCapture(e.pointerId)
    }
    if (dragStart.current.moved) {
      setPan(clampPan(dragStart.current.panX + dx, dragStart.current.panY + dy))
    }
  }

  const handlePointerUp = (e: React.PointerEvent) => {
    if (dragStart.current?.moved) {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId)
      }
    }
    setIsDragging(false)
    dragStart.current = null
  }

  const handleClick = () => {
    if (!dragStart.current?.moved) {
      clearSelection()
    }
  }

  const cursor = isDragging ? 'grabbing' : 'grab'

  return (
    <div
      ref={wrapperRef}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onClick={handleClick}
      style={{
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#EFE4CC',
        position: 'relative',
        cursor,
        touchAction: 'none',
      }}
    >
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        style={{
          display: 'block',
          width: `${100 * cardZoom}%`,
          height: `${100 * cardZoom}%`,
          transform: `translate(${pan.x}px, ${pan.y}px)`,
          transition: isDragging
            ? 'none'
            : 'width 0.25s ease-out, height 0.25s ease-out, transform 0.25s ease-out',
        }}
      >
        <defs>
          <filter id="paperNoise" x="0" y="0" width="100%" height="100%">
            <feTurbulence
              type="fractalNoise"
              baseFrequency="0.85"
              numOctaves="2"
              seed="3"
              result="noise"
            />
            <feColorMatrix
              in="noise"
              type="matrix"
              values="0 0 0 0 0.85
                      0 0 0 0 0.78
                      0 0 0 0 0.62
                      0 0 0 0.08 0"
            />
            <feComposite in2="SourceGraphic" operator="in" />
            <feBlend in="SourceGraphic" mode="multiply" />
          </filter>
        </defs>

        <rect width={VIEW_W} height={VIEW_H} fill="#EFE4CC" />
        <rect
          width={VIEW_W}
          height={VIEW_H}
          fill="#EFE4CC"
          filter="url(#paperNoise)"
          opacity={0.6}
        />

        <EdgeLayer />
        {nodes.map((n) => (
          <Card key={n.id} entityId={n.id} />
        ))}
        <RipplePulseLayer />
        <TagLayer />
      </svg>
    </div>
  )
}
