import { useEffect, useRef, useState, type ReactNode } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// ResizableSplit — 세로 분할 컨테이너.
//
//   ┌─────────────┐
//   │   top       │  topHeight (px)
//   ├──── ↕ ──────┤  drag handle (4px)
//   │   bottom    │  나머지
//   └─────────────┘
//
// localStorage에 마지막 분할 비율 저장 → 새로고침해도 유지.
// ─────────────────────────────────────────────────────────────────────────

interface ResizableSplitProps {
  top: ReactNode
  bottom: ReactNode
  initialTopPercent?: number     // 기본 40%
  minTopPx?: number              // 최소 높이 (둘 다)
  storageKey?: string
}

const HANDLE_HEIGHT = 6

export function ResizableSplit({
  top,
  bottom,
  initialTopPercent = 40,
  minTopPx = 80,
  storageKey,
}: ResizableSplitProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [topHeightPx, setTopHeightPx] = useState<number | null>(null)
  const [containerHeight, setContainerHeight] = useState(0)
  const [isDragging, setIsDragging] = useState(false)

  // 초기 높이 결정 — localStorage 우선, 없으면 initialTopPercent
  useEffect(() => {
    const el = containerRef.current
    if (!el) return
    const ro = new ResizeObserver(() => {
      setContainerHeight(el.clientHeight)
    })
    ro.observe(el)
    setContainerHeight(el.clientHeight)
    return () => ro.disconnect()
  }, [])

  useEffect(() => {
    if (containerHeight === 0) return
    if (topHeightPx !== null) return
    let initial = (containerHeight * initialTopPercent) / 100
    if (storageKey) {
      const saved = localStorage.getItem(storageKey)
      if (saved) {
        const parsed = parseFloat(saved)
        if (!Number.isNaN(parsed)) initial = parsed
      }
    }
    setTopHeightPx(initial)
  }, [containerHeight, initialTopPercent, storageKey, topHeightPx])

  // 드래그 핸들러 — pointer events로 통일
  useEffect(() => {
    if (!isDragging) return
    const handleMove = (e: PointerEvent) => {
      const el = containerRef.current
      if (!el) return
      const rect = el.getBoundingClientRect()
      const newTop = e.clientY - rect.top
      const min = minTopPx
      const max = rect.height - minTopPx - HANDLE_HEIGHT
      const clamped = Math.min(max, Math.max(min, newTop))
      setTopHeightPx(clamped)
    }
    const handleUp = () => {
      setIsDragging(false)
      if (storageKey && topHeightPx !== null) {
        localStorage.setItem(storageKey, String(topHeightPx))
      }
    }
    document.addEventListener('pointermove', handleMove)
    document.addEventListener('pointerup', handleUp)
    return () => {
      document.removeEventListener('pointermove', handleMove)
      document.removeEventListener('pointerup', handleUp)
    }
  }, [isDragging, minTopPx, storageKey, topHeightPx])

  const computedTopPx = topHeightPx ?? 0

  return (
    <div
      ref={containerRef}
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        userSelect: isDragging ? 'none' : 'auto',
      }}
    >
      <div
        style={{
          height: computedTopPx,
          minHeight: 0,
          overflow: 'auto',
          flexShrink: 0,
        }}
      >
        {top}
      </div>
      <div
        onPointerDown={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        style={{
          height: HANDLE_HEIGHT,
          flexShrink: 0,
          cursor: 'row-resize',
          background: isDragging ? 'rgba(178,34,34,0.35)' : 'rgba(0,0,0,0.12)',
          borderTop: '1px solid rgba(0,0,0,0.15)',
          borderBottom: '1px solid rgba(0,0,0,0.15)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
          fontSize: 9,
          color: isDragging ? '#B22222' : '#6B6052',
          letterSpacing: 2,
          transition: isDragging ? 'none' : 'background 0.15s',
        }}
        title="drag to resize"
      >
        ↕
      </div>
      <div style={{ flex: 1, minHeight: 0, overflow: 'hidden' }}>
        {bottom}
      </div>
    </div>
  )
}
