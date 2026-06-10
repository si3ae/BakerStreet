import { useState } from 'react'
import { useGraphStore } from '../store/graphStore'
import { useUIStore } from '../store/uiStore'
import { CARD_W, CARD_H, SLOT_SIZE } from '../lib/layout'
import { silhouetteFor } from '../assets/silhouettes'

// ─────────────────────────────────────────────────────────────────────────
// Card v2 (수사 보드 컨셉)
//
//   ┌────────────────────────┐  paper card, 살짝 회전 (-5~+5도)
//   │ ● REG. NO. ent_xxxx  ● │  핀 + 등록증 번호 (typewriter)
//   │   ┌──────────────┐     │
//   │   │   mugshot    │     │  alpha-keyed silhouette이 mask가 되어
//   │   │  (silhouette)│     │  수직선 halftone 패턴이 인물 형태로 박힘
//   │   └──────────────┘     │
//   │  ADAMO PROPERTIES LTD  │
//   │      ┌───────┐         │
//   │      │  BVI  │         │  jurisdiction stamp (red, -3° 기울임)
//   │      └───────┘         │
//   └────────────────────────┘
//
// 회전은 카드 중심 기준 `rotate(rot, w/2, h/2)`. edge center는 회전 무관 (동일 중심).
// mask는 mask-type="alpha" — 실루엣 PNG의 alpha 채널이 mask로 동작.
// ─────────────────────────────────────────────────────────────────────────

const STAMP_RED = '#B22222'
const PAPER_BG = '#F5EFE0'
const PAPER_EDGE = '#C7B89A'
const INK = '#2A2520'
const PIN_RED = '#A03030'

interface CardProps {
  entityId: string
}

export function Card({ entityId }: CardProps) {
  const node = useGraphStore((s) => s.nodes.find((n) => n.id === entityId))
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const selectEntity = useUIStore((s) => s.selectEntity)

  if (!node) return null

  const isSelected = selectedEntityId === entityId

  // entity별 고유 def id — 카드별 격리.
  const patternId = `halftone-${entityId}`
  const maskId = `mask-${entityId}`

  // 가독성 위해 32자까지 허용 (이전 28). 폰트 크기도 살짝 키움.
  const displayName =
    node.name.length > 32 ? node.name.slice(0, 31) + '…' : node.name

  // 카드 내부 좌표 (CARD 240×300, SLOT 140 기준)
  const slotX = (CARD_W - SLOT_SIZE) / 2
  const slotY = 50
  const regNoY = 30
  const nameY = slotY + SLOT_SIZE + 32
  const stampW = 110
  const stampH = 42
  const stampX = (CARD_W - stampW) / 2
  const stampY = nameY + 18
  const pinR = 6

  const silhouetteUrl = silhouetteFor(entityId)

  // hover 시 카드가 살짝 위로 올라감 + 그림자 강화.
  // SVG g는 CSS hover로 transform 갱신이 까다로워 state로 추적.
  const [isHovered, setIsHovered] = useState(false)
  const hoverYOffset = isHovered ? -6 : 0
  const transform = `translate(${node.x}, ${node.y + hoverYOffset}) rotate(${node.rotation}, ${CARD_W / 2}, ${CARD_H / 2})`
  const stampRot = -3

  // Stage 6 C-2: 자동 점화 도입 후 카드 클릭은 popover만.
  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation()
    selectEntity(entityId)
  }

  return (
    <g
      transform={transform}
      onClick={handleClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      style={{
        transition: 'transform 0.15s ease-out',
        cursor: 'zoom-in',         // 단서 위 = 돋보기
      }}
    >
      <defs>
        {/* 수직선 halftone pattern — 1.6px stripe every 3px */}
        <pattern
          id={patternId}
          patternUnits="userSpaceOnUse"
          width={3}
          height={3}
        >
          <rect width={3} height={3} fill="transparent" />
          <rect width={1.6} height={3} fill={INK} />
        </pattern>
        {/*
          alpha-mask — 실루엣 PNG의 alpha 채널이 mask로 직접 동작.
          PNG는 검정 잉크 + 인물 형태 alpha. mask-type="alpha"라서
          luminance 무시하고 alpha만 본다 → 인물 영역만 통과.
        */}
        <mask
          id={maskId}
          maskUnits="userSpaceOnUse"
          mask-type="alpha"
        >
          <image
            href={silhouetteUrl}
            x={slotX}
            y={slotY}
            width={SLOT_SIZE}
            height={SLOT_SIZE}
            preserveAspectRatio="xMidYMid slice"
          />
        </mask>
      </defs>

      {/* paper shadow — hover 시 더 길고 진하게 (들어올려진 느낌) */}
      <rect
        x={isHovered ? 4 : 2}
        y={isHovered ? 6 : 3}
        width={CARD_W}
        height={CARD_H}
        fill={isHovered ? 'rgba(0,0,0,0.28)' : 'rgba(0,0,0,0.18)'}
        rx={2}
      />
      {/* paper body */}
      <rect
        x={0}
        y={0}
        width={CARD_W}
        height={CARD_H}
        fill={PAPER_BG}
        stroke={isSelected ? STAMP_RED : PAPER_EDGE}
        strokeWidth={isSelected ? 2.5 : 1}
        rx={2}
      />

      {/* REG. NO. 라벨 */}
      <text
        x={CARD_W / 2}
        y={regNoY}
        textAnchor="middle"
        fontSize={12}
        fill={INK}
        fontFamily="'Traveling _Typewriter', 'Courier Prime', monospace"
        style={{ letterSpacing: '0.8px' }}
      >
        REG. NO. {entityId}
      </text>

      {/* mugshot slot */}
      {/* 슬롯 배경 (밝은 paper) */}
      <rect
        x={slotX}
        y={slotY}
        width={SLOT_SIZE}
        height={SLOT_SIZE}
        fill="#FAF6EC"
        stroke={PAPER_EDGE}
        strokeWidth={0.5}
      />
      {/* halftone 패턴을 인물 형태로 박음 */}
      <rect
        x={slotX}
        y={slotY}
        width={SLOT_SIZE}
        height={SLOT_SIZE}
        fill={`url(#${patternId})`}
        mask={`url(#${maskId})`}
      />

      {/* entity name — fontSize 14→15, letterSpacing 추가로 가독성 향상 */}
      <text
        x={CARD_W / 2}
        y={nameY}
        textAnchor="middle"
        fontSize={15}
        fill={INK}
        fontFamily="'Traveling _Typewriter', 'Courier Prime', monospace"
        fontWeight="bold"
        style={{ letterSpacing: '0.4px' }}
      >
        {displayName}
      </text>

      {/* jurisdiction stamp */}
      <g
        transform={`translate(${stampX + stampW / 2}, ${stampY + stampH / 2}) rotate(${stampRot}) translate(${-stampW / 2}, ${-stampH / 2})`}
        style={{ pointerEvents: 'none' }}
      >
        <rect
          x={0}
          y={0}
          width={stampW}
          height={stampH}
          fill="none"
          stroke={STAMP_RED}
          strokeWidth={2}
        />
        <rect
          x={3}
          y={3}
          width={stampW - 6}
          height={stampH - 6}
          fill="none"
          stroke={STAMP_RED}
          strokeWidth={0.5}
          opacity={0.5}
        />
        <text
          x={stampW / 2}
          y={stampH / 2 + 1}
          textAnchor="middle"
          dominantBaseline="middle"
          fontSize={16}
          fill={STAMP_RED}
          fontFamily="'Traveling _Typewriter', 'Courier Prime', monospace"
          fontWeight="bold"
          style={{ letterSpacing: '2px' }}
        >
          {node.jurisdiction.toUpperCase().slice(0, 9)}
        </text>
      </g>

      {/* 핀 두 개 */}
      <g style={{ pointerEvents: 'none' }}>
        <circle cx={18} cy={15} r={pinR + 1.5} fill="rgba(0,0,0,0.25)" />
        <circle cx={17} cy={14} r={pinR} fill={PIN_RED} />
        <circle cx={15} cy={12} r={1.8} fill="rgba(255,255,255,0.6)" />
        <circle cx={CARD_W - 16} cy={15} r={pinR + 1.5} fill="rgba(0,0,0,0.25)" />
        <circle cx={CARD_W - 17} cy={14} r={pinR} fill={PIN_RED} />
        <circle
          cx={CARD_W - 19}
          cy={12}
          r={1.8}
          fill="rgba(255,255,255,0.6)"
        />
      </g>
    </g>
  )
}
