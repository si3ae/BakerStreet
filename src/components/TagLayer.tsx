import { motion, AnimatePresence } from 'framer-motion'
import { useGraphStore } from '../store/graphStore'
import { useUIStore } from '../store/uiStore'
import { CARD_W } from '../lib/layout'

// 카드 우측에 칩 stack — 같은 (kind, status) 조합은 한 번만 표시.
// 의도: 같은 evidence가 두 edge에서 나와도 시각적으로 한 번. 점화 누적은
// uiStore.tags가 가지고 있지만 화면엔 dedup된 모습이 더 깔끔.

const TAG_WIDTH = 160       // foreignObject 슬롯 폭
const TAG_GAP_X = 8         // 카드와 슬롯 사이 간격
const SLOT_HEIGHT = 200     // 충분히 넓게 (max ~6 tags 가정)

interface SingleTagPopupProps {
  entityId: string
}

function SingleTagPopup({ entityId }: SingleTagPopupProps) {
  const tags = useUIStore((s) => s.tags[entityId]) ?? []
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === entityId))

  if (!node || tags.length === 0) return null

  // dedup — (kind, status) 조합 단위. 최초 등장 순서 보존.
  const seen = new Set<string>()
  const unique = tags.filter((t) => {
    const key = `${t.kind}__${t.status}`
    if (seen.has(key)) return false
    seen.add(key)
    return true
  })

  // 카드 우상단을 기준으로 우측에 슬롯 배치.
  // foreignObject 안에선 HTML — 텍스트 wrap이 쉬워서 SVG <text>보다 유리.
  const slotX = node.x + CARD_W + TAG_GAP_X
  const slotY = node.y - 4

  return (
    <foreignObject
      x={slotX}
      y={slotY}
      width={TAG_WIDTH}
      height={SLOT_HEIGHT}
      style={{ pointerEvents: 'none', overflow: 'visible' }}
    >
      {/*
        xmlns 명시 필요 — foreignObject 안의 HTML이 React 19 + SVG 환경에서
        간헐적으로 렌더 누락되는 케이스 회피.
      */}
      <div
        // @ts-expect-error xmlns is required for HTML inside <foreignObject>
        xmlns="http://www.w3.org/1999/xhtml"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'flex-start',
          gap: 4,
        }}
      >
        <AnimatePresence>
          {unique.map((t) => {
            const isDemoted = t.status === 'demoted'
            return (
              <motion.div
                key={t.id}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.25, ease: 'easeOut' }}
                style={{
                  fontFamily:
                    'Courier Prime, ui-monospace, SFMono-Regular, monospace',
                  fontSize: 11,
                  lineHeight: 1.2,
                  padding: '2px 6px',
                  border: '1px solid',
                  borderColor: isDemoted ? '#9CA3AF' : '#4A6FA5',
                  color: isDemoted ? '#6B7280' : '#1F2937',
                  background: isDemoted ? '#F3F4F6' : '#FFFBEA',
                  borderRadius: 2,
                  textDecoration: isDemoted ? 'line-through' : 'none',
                  whiteSpace: 'nowrap',
                }}
              >
                [{t.kind}]
              </motion.div>
            )
          })}
        </AnimatePresence>
      </div>
    </foreignObject>
  )
}

// 모든 entity의 TagPopup을 한 번에. 카드 컴포넌트 안 건드림 (옵션 A).
export function TagLayer() {
  const nodes = useGraphStore((s) => s.nodes)
  return (
    <g>
      {nodes.map((n) => (
        <SingleTagPopup key={n.id} entityId={n.id} />
      ))}
    </g>
  )
}
