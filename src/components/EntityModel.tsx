import { useEffect, useRef } from 'react'
import { useUIStore } from '../store/uiStore'
import { getEntity } from '../lib/selectors'

// ─────────────────────────────────────────────────────────────────────────
// EntityModel — 우하단 도트 모형.
//
// 컨셉 (사용자 ref: tooooools.app):
//   카드 클릭 → 우하단에 큰 도트 캐릭터 등장 → 마우스로 드래그하면
//   도트들이 마우스 반대 방향으로 밀려서 변형 → 떼면 스프링으로 복귀.
//
// 구현:
//   - Canvas 2D
//   - 도트 그리드 = 32×40 (가로×세로). 사람 실루엣 mask로 일부만 visible.
//   - 각 도트: { home(고정), pos(현재) }
//   - 매 frame:
//       마우스가 캔버스 위에서 눌려있으면: 도트 ← 마우스 distance < radius
//         → force = (도트 - 마우스) 정규화 × strength × (1 - dist/radius)
//       복귀 스프링: force += (home - pos) × restoreK
//       감쇠: vel *= damping
//   - jurisdiction별로 도트 색 다름 (선택된 카드의 entity 정보 사용)
// ─────────────────────────────────────────────────────────────────────────

const PANEL_W = 260                  // 패널 크기
const PANEL_H = 320
const DOT_COLS = 28                  // 그리드 해상도
const DOT_ROWS = 36
const DOT_RADIUS = 3.2

// jurisdiction → 색. design 톤과 일치.
const JURISDICTION_COLORS: Record<string, string> = {
  BVI: '#B85450',
  Cayman: '#5A8FA8',
  Singapore: '#7A6E5A',
  Delaware: '#8E6B3F',
  HK: '#A86B5A',
  Switzerland: '#6B8B5A',
  Cyprus: '#9C7A4F',
  default: '#6B6052',
}

// 사람 실루엣 mask — 어느 그리드 좌표에 도트를 박을지.
// 1 = 도트 있음, 0 = 없음. 28×36 정도.
// 머리 (위), 어깨, 몸통, 다리 단순 도트 캐릭터.
function buildSilhouetteMask(): boolean[][] {
  const mask: boolean[][] = []
  for (let r = 0; r < DOT_ROWS; r++) {
    mask.push(new Array(DOT_COLS).fill(false))
  }
  const cx = DOT_COLS / 2

  // 머리 (원형) — 행 2~10
  for (let r = 2; r <= 10; r++) {
    const halfW = r <= 4 ? 3 + (r - 2) : r <= 8 ? 5 : 4 - (r - 8)
    for (let c = Math.floor(cx - halfW); c <= Math.floor(cx + halfW); c++) {
      if (c >= 0 && c < DOT_COLS) mask[r][c] = true
    }
  }
  // 목 (좁음) — 행 11~12
  for (let r = 11; r <= 12; r++) {
    for (let c = Math.floor(cx - 2); c <= Math.floor(cx + 1); c++) {
      mask[r][c] = true
    }
  }
  // 어깨 + 몸통 — 행 13~26
  for (let r = 13; r <= 26; r++) {
    const halfW = r <= 14 ? 8 + (r - 13) : r <= 24 ? 9 : 9 - (r - 24)
    for (let c = Math.floor(cx - halfW); c <= Math.floor(cx + halfW); c++) {
      if (c >= 0 && c < DOT_COLS) mask[r][c] = true
    }
  }
  // 다리 (양쪽) — 행 27~34
  for (let r = 27; r <= 34; r++) {
    for (let c = Math.floor(cx - 7); c <= Math.floor(cx - 2); c++) {
      if (c >= 0 && c < DOT_COLS) mask[r][c] = true
    }
    for (let c = Math.floor(cx + 1); c <= Math.floor(cx + 6); c++) {
      if (c >= 0 && c < DOT_COLS) mask[r][c] = true
    }
  }
  return mask
}

interface Dot {
  homeX: number
  homeY: number
  x: number
  y: number
  vx: number
  vy: number
}

// 물리 상수
const MOUSE_INFLUENCE_R = 80         // 마우스 영향 반경 (픽셀)
const MOUSE_STRENGTH = 1.5           // 미는 힘
const RESTORE_K = 0.06               // 복귀 스프링 강도
const DAMPING = 0.82                 // 속도 감쇠 (1에 가까울수록 오래 흔들림)

export function EntityModel() {
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const dotsRef = useRef<Dot[]>([])
  const mouseRef = useRef<{ x: number; y: number; down: boolean }>({
    x: -1000,
    y: -1000,
    down: false,
  })
  const rafRef = useRef<number | null>(null)

  // entity 정보
  const entity = selectedEntityId ? getEntity(selectedEntityId) : null
  const color = entity
    ? JURISDICTION_COLORS[entity.jurisdiction] ?? JURISDICTION_COLORS.default
    : JURISDICTION_COLORS.default

  // 도트 생성 — selectedEntityId 바뀌면 새로 빌드 (위치 리셋).
  useEffect(() => {
    if (!selectedEntityId) {
      dotsRef.current = []
      return
    }
    const mask = buildSilhouetteMask()
    const cellW = PANEL_W / (DOT_COLS + 2)
    const cellH = PANEL_H / (DOT_ROWS + 2)
    const offsetX = cellW
    const offsetY = cellH
    const dots: Dot[] = []
    for (let r = 0; r < DOT_ROWS; r++) {
      for (let c = 0; c < DOT_COLS; c++) {
        if (!mask[r][c]) continue
        const x = offsetX + c * cellW + cellW / 2
        const y = offsetY + r * cellH + cellH / 2
        dots.push({ homeX: x, homeY: y, x, y, vx: 0, vy: 0 })
      }
    }
    dotsRef.current = dots
  }, [selectedEntityId])

  // 애니메이션 루프 — 도트 위치 갱신 + 렌더.
  useEffect(() => {
    if (!selectedEntityId) {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      return
    }
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    // HiDPI 대응
    const dpr = window.devicePixelRatio || 1
    canvas.width = PANEL_W * dpr
    canvas.height = PANEL_H * dpr
    ctx.scale(dpr, dpr)

    const tick = () => {
      const dots = dotsRef.current
      const m = mouseRef.current

      for (const d of dots) {
        // 마우스 영향 — 누르고 있을 때만.
        if (m.down) {
          const dx = d.x - m.x
          const dy = d.y - m.y
          const dist = Math.hypot(dx, dy)
          if (dist < MOUSE_INFLUENCE_R && dist > 0.1) {
            const f = (1 - dist / MOUSE_INFLUENCE_R) * MOUSE_STRENGTH
            d.vx += (dx / dist) * f
            d.vy += (dy / dist) * f
          }
        }
        // 복귀 스프링
        d.vx += (d.homeX - d.x) * RESTORE_K
        d.vy += (d.homeY - d.y) * RESTORE_K
        // 감쇠
        d.vx *= DAMPING
        d.vy *= DAMPING
        // 적용
        d.x += d.vx
        d.y += d.vy
      }

      // 렌더
      ctx.clearRect(0, 0, PANEL_W, PANEL_H)
      ctx.fillStyle = color
      for (const d of dots) {
        ctx.beginPath()
        ctx.arc(d.x, d.y, DOT_RADIUS, 0, Math.PI * 2)
        ctx.fill()
      }

      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [selectedEntityId, color])

  // 마우스 이벤트 — canvas 기준 로컬 좌표로 변환.
  const updateMouse = (e: React.PointerEvent) => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    mouseRef.current.x = e.clientX - rect.left
    mouseRef.current.y = e.clientY - rect.top
  }

  if (!selectedEntityId || !entity) return null

  return (
    <div
      style={{
        position: 'absolute',
        right: 16,
        bottom: 16,
        width: PANEL_W,
        height: PANEL_H + 36,    // 캡션 공간
        zIndex: 4,
        pointerEvents: 'auto',
        background: 'rgba(245, 239, 224, 0.92)',
        border: '1px solid #C7B89A',
        boxShadow: '0 4px 16px rgba(0,0,0,0.25)',
        fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
      }}
    >
      <canvas
        ref={canvasRef}
        style={{
          display: 'block',
          width: PANEL_W,
          height: PANEL_H,
          touchAction: 'none',
          cursor: 'grab',
        }}
        onPointerDown={(e) => {
          mouseRef.current.down = true
          updateMouse(e)
          e.currentTarget.setPointerCapture(e.pointerId)
          ;(e.currentTarget as HTMLCanvasElement).style.cursor = 'grabbing'
        }}
        onPointerMove={(e) => {
          updateMouse(e)
        }}
        onPointerUp={(e) => {
          mouseRef.current.down = false
          mouseRef.current.x = -1000
          mouseRef.current.y = -1000
          if (e.currentTarget.hasPointerCapture(e.pointerId)) {
            e.currentTarget.releasePointerCapture(e.pointerId)
          }
          ;(e.currentTarget as HTMLCanvasElement).style.cursor = 'grab'
        }}
        onPointerLeave={() => {
          mouseRef.current.down = false
          mouseRef.current.x = -1000
          mouseRef.current.y = -1000
        }}
      />
      <div
        style={{
          padding: '6px 10px',
          borderTop: '1px solid #C7B89A',
          fontSize: 11,
          color: '#4A4135',
          letterSpacing: 1,
        }}
      >
        <div style={{ fontWeight: 700, fontSize: 12, marginBottom: 1 }}>
          {entity.name}
        </div>
        <div style={{ color: '#6B6052' }}>
          {entity.jurisdiction} · drag to deform
        </div>
      </div>
    </div>
  )
}
