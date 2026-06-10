import { motion, AnimatePresence } from 'framer-motion'
import { useGraphStore } from '../store/graphStore'
import { useUIStore } from '../store/uiStore'
import { cardCenter } from '../lib/layout'

// ─────────────────────────────────────────────────────────────────────────
// 물결 ripple — 한 사건 자국에서 여러 동심원이 시차 두고 퍼짐.
//
// 디자인 출처: 잔잔한 수면에 작은 돌이 떨어진 모양 (사용자 ref image).
// SVG로 굴절은 못 그리니까 다중 원 + 위상 어긋남 + opacity 그라데이션으로 대체.
//
// 한 ripple = 4겹의 원. 시작 r 다름 + delay 다름 → 안에서 밖으로 차례로 퍼짐.
// strokeWidth도 안쪽 원은 두껍게, 바깥쪽 얇게 → 진짜 물결처럼 페이드.
// ─────────────────────────────────────────────────────────────────────────

const RIPPLE_DURATION_S = 2.4   // 전체 모션 (이전 1.8 → 더 천천히)
const RIPPLE_R_END = 160        // 마지막 원 r (이전 120)

// 한 ripple의 4겹 — (startDelay, startR, strokeWidth, startOpacity)
const RIPPLE_RINGS = [
  { delay: 0.00, startR: 0, sw: 6, opacity: 0.85 },
  { delay: 0.18, startR: 0, sw: 4, opacity: 0.65 },
  { delay: 0.36, startR: 0, sw: 3, opacity: 0.48 },
  { delay: 0.54, startR: 0, sw: 2, opacity: 0.32 },
]

interface SingleRippleProps {
  rippleId: string
  cx: number
  cy: number
  color: string
}

function SingleRipple({ rippleId, cx, cy, color }: SingleRippleProps) {
  const removeRipple = useUIStore((s) => s.removeRipple)

  return (
    <>
      {RIPPLE_RINGS.map((ring, i) => {
        const isLast = i === RIPPLE_RINGS.length - 1
        return (
          <motion.circle
            key={i}
            cx={cx}
            cy={cy}
            fill="none"
            stroke={color}
            strokeWidth={ring.sw}
            initial={{ r: ring.startR, opacity: ring.opacity }}
            animate={{ r: RIPPLE_R_END, opacity: 0 }}
            transition={{
              duration: RIPPLE_DURATION_S,
              ease: [0.25, 0.46, 0.45, 0.94],   // cubic-out (자연스러운 감속)
              delay: ring.delay,
            }}
            // 가장 바깥 ring이 끝났을 때 ripple 자체 삭제 — 안쪽이 끝났을 때 지우면
            // 바깥 원이 갑자기 사라짐.
            onAnimationComplete={isLast ? () => removeRipple(rippleId) : undefined}
            style={{ pointerEvents: 'none' }}
          />
        )
      })}
    </>
  )
}

export function RipplePulseLayer() {
  const ripples = useUIStore((s) => s.ripples)
  const nodes = useGraphStore((s) => s.nodes)

  // 사건의 색 — flow accent. shared/flow edge 구분 없이 단일.
  const color = '#B22222'

  return (
    <g style={{ pointerEvents: 'none' }}>
      <AnimatePresence>
        {ripples.map((r) => {
          const node = nodes.find((n) => n.id === r.entityId)
          if (!node) return null
          const { cx, cy } = cardCenter(node.x, node.y)
          return (
            <SingleRipple
              key={r.id}
              rippleId={r.id}
              cx={cx}
              cy={cy}
              color={color}
            />
          )
        })}
      </AnimatePresence>
    </g>
  )
}
