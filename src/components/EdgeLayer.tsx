import { useState } from 'react'
import { motion } from 'framer-motion'
import { useGraphStore, type Node } from '../store/graphStore'
import { useUIStore } from '../store/uiStore'
import { cardCenter, CARD_W, CARD_H } from '../lib/layout'
import type { Edge } from '../types/bakerstreet'

// edge 양 끝을 카드 경계까지만 그리도록 줄여서 화살표가 박혀 보이지 않게.
// 정확한 박스-라인 교차는 over-engineering이라 단순 비례 축약.
function trimToBox(
  fromCx: number,
  fromCy: number,
  toCx: number,
  toCy: number,
  pad: number
) {
  const dx = toCx - fromCx
  const dy = toCy - fromCy
  const dist = Math.hypot(dx, dy) || 1
  const ratioStart = pad / dist
  const ratioEnd = (dist - pad) / dist
  return {
    x1: fromCx + dx * ratioStart,
    y1: fromCy + dy * ratioStart,
    x2: fromCx + dx * ratioEnd,
    y2: fromCy + dy * ratioEnd,
  }
}

// design v7 §"The Three-Second Scene": shared_attribute는 dashed, flow는 solid.
// draw-in 동안에는 stroke-dashoffset 트릭을 써야 하므로 임시로 solid 처리,
// 애니메이션 완료 후 shared_attribute만 dasharray 패턴으로 전환.
// → 점선 패턴과 dashoffset 애니메이션이 충돌하는 문제 회피.
const DRAW_DURATION_S = 0.4

interface SingleEdgeProps {
  edge: Edge
  index: number
  from: Node
  to: Node
}

function SingleEdge({ edge, index, from, to }: SingleEdgeProps) {
  const selectedEdgeIndex = useUIStore((s) => s.selectedEdgeIndex)
  const selectEdge = useUIStore((s) => s.selectEdge)
  const isActive = useUIStore((s) => s.activeEdges.includes(edge.id))

  // 애니메이션 완료 여부 — true가 되면 shared_attribute는 dashed로 전환.
  const [drawnIn, setDrawnIn] = useState(false)

  const fromCenter = cardCenter(from.x, from.y)
  const toCenter = cardCenter(to.x, to.y)
  const pad = Math.max(CARD_W, CARD_H) / 2 + 4
  const { x1, y1, x2, y2 } = trimToBox(
    fromCenter.cx,
    fromCenter.cy,
    toCenter.cx,
    toCenter.cy,
    pad
  )

  // 점화되지 않은 edge는 렌더 자체 생략. hitbox도 사라져 발표 흐름에
  // 끼어들지 않음 (자연스러운 reveal). 클릭 popover는 점화 후에만 가능.
  if (!isActive) return null

  const isFlow = edge.type === 'flow'
  const isDemoted = edge.verification.status === 'demoted'
  const isSelected = selectedEdgeIndex === index

  const baseColor = isDemoted
    ? '#9CA3AF'              // demoted → gray
    : isFlow
      ? '#B22222'            // verified flow → red
      : '#4A6FA5'            // verified shared_attribute → ink blue

  const strokeWidth = isFlow ? 2 : 1.5
  const opacity = isDemoted ? 0.45 : 0.9
  const ringWidth = strokeWidth + 8

  // 라인 길이 — dashoffset 애니메이션의 시작값.
  const length = Math.hypot(x2 - x1, y2 - y1)

  // 표시용 dasharray:
  //  - 애니메이션 동안엔 [length, length] (offset만 줄이면 솔리드로 점차 노출)
  //  - flow는 끝나도 solid 유지 → undefined
  //  - shared_attribute는 끝난 뒤 '6 4'로 전환
  let displayDasharray: string | undefined
  if (!drawnIn) {
    displayDasharray = `${length} ${length}`
  } else if (!isFlow) {
    displayDasharray = '6 4'
  } else {
    displayDasharray = undefined
  }

  const markerId = isFlow
    ? isDemoted
      ? 'arrow-flow-demoted'
      : 'arrow-flow'
    : undefined

  return (
    <g
      onClick={(e) => {
        e.stopPropagation()
        selectEdge(index)
      }}
      className="cursor-pointer"
    >
      {/* invisible thick line for easier clicking */}
      <line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke="transparent"
        strokeWidth={ringWidth}
      />
      {/* visible edge — Framer Motion으로 stroke-dashoffset 애니메이트 */}
      <motion.line
        x1={x1}
        y1={y1}
        x2={x2}
        y2={y2}
        stroke={baseColor}
        strokeWidth={isSelected ? strokeWidth + 1.5 : strokeWidth}
        strokeDasharray={displayDasharray}
        opacity={opacity}
        markerEnd={markerId ? `url(#${markerId})` : undefined}
        initial={{ strokeDashoffset: length }}
        animate={{ strokeDashoffset: 0 }}
        transition={{ duration: DRAW_DURATION_S, ease: 'easeOut' }}
        onAnimationComplete={() => setDrawnIn(true)}
      />
      {/* demoted ⚠ 아이콘 — edge midpoint. draw-in 끝난 뒤에만 표시. */}
      {isDemoted && drawnIn && (
        <g transform={`translate(${(x1 + x2) / 2}, ${(y1 + y2) / 2})`}>
          <circle r={10} fill="#FDF5E6" stroke="#B22222" strokeWidth={1.5} />
          <text
            textAnchor="middle"
            dominantBaseline="central"
            fontSize={12}
            fill="#B22222"
            fontWeight="bold"
          >
            !
          </text>
        </g>
      )}
    </g>
  )
}

export function EdgeLayer() {
  const edges = useGraphStore((s) => s.edges)
  const nodes = useGraphStore((s) => s.nodes)

  return (
    <g>
      {/* arrow marker defs */}
      <defs>
        <marker
          id="arrow-flow"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#B22222" />
        </marker>
        <marker
          id="arrow-flow-demoted"
          viewBox="0 0 10 10"
          refX="9"
          refY="5"
          markerWidth="6"
          markerHeight="6"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" fill="#9CA3AF" />
        </marker>
      </defs>

      {edges.map((edge, idx) => {
        const from = nodes.find((n) => n.id === edge.from)
        const to = nodes.find((n) => n.id === edge.to)
        if (!from || !to) return null
        return (
          <SingleEdge
            key={edge.id}
            edge={edge}
            index={idx}
            from={from}
            to={to}
          />
        )
      })}
    </g>
  )
}
