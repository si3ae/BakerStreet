import { useEffect, useState } from 'react'
import { useUIStore } from '../store/uiStore'
import sherlockBase from '../assets/sherlock_base.png?url'
import sherlockBreathing from '../assets/sherlock_breathing.png?url'

// ─────────────────────────────────────────────────────────────────────────
// SHERLOCK BOT
//
// 레이어:
//   1) base PNG — 말풍선만 (정적, "The game is on" 고정)
//   2) breathing PNG — 캐릭터 통째. stepped 애니메이션 (도트 게임 느낌)
//      두 키프레임 사이 점프 — translate(0,0) ↔ translate(3,3)
//   3) 동적 연기 — 정적 연기가 있던 자리에서 솟아오름. PNG에서 정적 연기는
//      모두 지움 → 모든 연기가 100% 코드 동적.
//
// 연기 활성 조건: splash/briefing 제외 모든 상태에서. verdict 박힌 후에도 계속.
// ─────────────────────────────────────────────────────────────────────────

// 표시 사이즈 — PNG 원본 640×575의 비율 유지.
// 320×288로 표시 (절반 축소). 말풍선 우측 끝까지 다 보이게.
const PNG_W = 320
const PNG_H = 288

const SMOKE_GLYPHS = [';', "'", ',', '`', '~', '.']
const PUFF_LIFE_MS = 2400
const PUFF_SPAWN_MS = 280
const PUFF_RISE_PX = 70

// 동적 연기 출구 — 표시 좌표 320×288 기준.
// PNG 원본(640×575)에서 잉크 우측 부유 글자가 x 270~290, y 190~460에 분포.
// 표시 비율 0.5 적용 → x 135~145, y 95~230.
const SMOKE_OUTLETS = [
  { x: 140, y: 210 },
  { x: 138, y: 185 },
  { x: 142, y: 160 },
  { x: 138, y: 135 },
  { x: 142, y: 110 },
]

interface Puff {
  id: number
  glyph: string
  startedAt: number
  outletX: number
  outletY: number
  xJitter: number
  swayAmp: number
}

export function SherlockBot() {
  const streamingState = useUIStore((s) => s.streamingState)
  const [puffs, setPuffs] = useState<Puff[]>([])

  // 연기 활성 — splash/briefing 제외 항상.
  // idle/activating/complete + verdict 박힌 후에도 계속 (도장 후에도).
  const isThinking =
    streamingState !== 'splash' && streamingState !== 'briefing'

  useEffect(() => {
    if (!isThinking) return
    let counter = 0
    const interval = setInterval(() => {
      setPuffs((prev) => {
        const now = Date.now()
        const alive = prev.filter((p) => now - p.startedAt < PUFF_LIFE_MS)
        counter++
        const outlet = SMOKE_OUTLETS[counter % SMOKE_OUTLETS.length]
        return [
          ...alive,
          {
            id: now + counter,
            glyph: SMOKE_GLYPHS[counter % SMOKE_GLYPHS.length],
            startedAt: now,
            outletX: outlet.x,
            outletY: outlet.y,
            xJitter: (Math.random() - 0.5) * 5,
            swayAmp: 4 + Math.random() * 6,
          },
        ]
      })
    }, PUFF_SPAWN_MS)
    return () => clearInterval(interval)
  }, [isThinking])

  return (
    <div
      style={{
        position: 'absolute',
        left: 20,
        bottom: 12,
        width: PNG_W,
        height: PNG_H,
        pointerEvents: 'none',
        zIndex: 5,
      }}
    >
      {/* base + breathing 둘 다 정적으로 깔림 (애니메이션 제거).
          PNG는 2× 사이즈로 저장됨 — pixelated로 도트 톤 선명하게.
          drop-shadow 4방향 흰색 = ASCII 글자 외곽선. 카드와 겹쳐도 또렷. */}
      <img
        src={sherlockBase}
        alt=""
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: PNG_W,
          height: PNG_H,
          opacity: 0.85,
          imageRendering: 'pixelated',
          // 윤곽선 (drop-shadow) 제거 — 사용자 피드백
        }}
      />
      <img
        src={sherlockBreathing}
        alt=""
        style={{
          position: 'absolute',
          left: 0,
          top: 0,
          width: PNG_W,
          height: PNG_H,
          opacity: 0.85,
          imageRendering: 'pixelated',
          // 윤곽선 (drop-shadow) 제거 — 사용자 피드백
        }}
      />

      {/* 동적 연기 글리프 */}
      {puffs.map((p) => (
        <SmokePuff key={p.id} puff={p} />
      ))}
    </div>
  )
}

function SmokePuff({ puff }: { puff: Puff }) {
  const [risen, setRisen] = useState(false)

  useEffect(() => {
    const id = requestAnimationFrame(() => setRisen(true))
    return () => cancelAnimationFrame(id)
  }, [])

  return (
    <span
      style={{
        position: 'absolute',
        left: puff.outletX + puff.xJitter + (risen ? puff.swayAmp : 0),
        top: risen ? puff.outletY - PUFF_RISE_PX : puff.outletY,
        opacity: risen ? 0 : 0.75,
        fontSize: 14,
        color: '#2A2520',
        fontFamily: "'Courier Prime', monospace",
        fontWeight: 700,
        // 흰 외곽선 — 카드 위에서도 연기 보이게
        textShadow:
          '1px 0 0 #F8F2DE, -1px 0 0 #F8F2DE, 0 1px 0 #F8F2DE, 0 -1px 0 #F8F2DE',
        transition: `top ${PUFF_LIFE_MS}ms linear, opacity ${PUFF_LIFE_MS}ms ease-out, left ${PUFF_LIFE_MS}ms ease-in-out`,
      }}
    >
      {puff.glyph}
    </span>
  )
}
