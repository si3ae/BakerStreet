import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore, type Verdict } from '../store/uiStore'
import verdictPng from '../assets/verdict_stamp.png?url'

// ─────────────────────────────────────────────────────────────────────────
// VERDICT 도장 — 4가지 판결.
//   CONFIRMED  → 빨간 왁스 인장 (PNG, SHELL COMPANY / CASE SEALED)
//   SUSPECTED  → 주황 SVG 도장 (SUSPECTED / FOR REVIEW)
//   HOLD       → 회색 SVG 도장 (CASE ON HOLD)
//   CLEAN      → 녹색 SVG 도장 (NO FRAUD FOUND)
//
// AI ≠ 수사관이면 OVERRULED 표시 추가.
// ─────────────────────────────────────────────────────────────────────────

interface StampStyle {
  color: string
  primary: string      // 큰 글자
  secondary: string    // 작은 글자
}

const STAMP_STYLES: Record<Exclude<Verdict, 'UNRESOLVED'>, StampStyle> = {
  CONFIRMED: { color: '#B22222', primary: 'CONFIRMED', secondary: 'SHELL COMPANY' },
  SUSPECTED: { color: '#C97A3A', primary: 'SUSPECTED', secondary: 'FOR REVIEW' },
  HOLD:      { color: '#6B6052', primary: 'HOLD',      secondary: 'PENDING EVIDENCE' },
  CLEAN:     { color: '#3A6B4A', primary: 'CLEAN',     secondary: 'NO FRAUD FOUND' },
}

const STAMP_SIZE = 320

export function VerdictStamp() {
  const streamingState = useUIStore((s) => s.streamingState)
  const verdict = useUIStore((s) => s.verdict)

  const isSealed = verdict.sealedAt !== null
  const visible = streamingState === 'complete' && isSealed

  console.log('[verdict] VerdictStamp render:', {
    streamingState,
    sealedAt: verdict.sealedAt,
    choice: verdict.investigatorChoice,
    visible,
  })

  return (
    <AnimatePresence>
      {visible && verdict.investigatorChoice !== 'UNRESOLVED' && (
        <motion.div
          key="verdict"
          initial={{ scale: 1.6, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: -3 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.45, ease: [0.2, 0.8, 0.2, 1] }}
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            pointerEvents: 'none',
            zIndex: 20,
            filter: 'drop-shadow(0 6px 14px rgba(0,0,0,0.5))',
          }}
        >
          {/* CONFIRMED는 왁스 인장 PNG 그대로 */}
          {verdict.investigatorChoice === 'CONFIRMED' ? (
            <img
              src={verdictPng}
              alt="VERDICT — case sealed"
              style={{
                width: STAMP_SIZE,
                height: STAMP_SIZE,
                display: 'block',
              }}
            />
          ) : (
            <SvgStamp choice={verdict.investigatorChoice} />
          )}

          {/* OVERRULED 표시 — 어느 판결이든 AI와 다르면 */}
          {verdict.isOverruled && (
            <div
              style={{
                position: 'absolute',
                top: -16,
                left: '50%',
                transform: 'translateX(-50%) rotate(-8deg)',
                fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
                fontSize: 18,
                fontWeight: 900,
                letterSpacing: 4,
                color: '#FAF6EC',
                background: '#2A2520',
                padding: '3px 14px',
                whiteSpace: 'nowrap',
                boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
              }}
            >
              ★ OVERRULED ★
            </div>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// SVG 도장 — CONFIRMED 외 3가지. 원형 + 텍스트 + 가장자리.
function SvgStamp({ choice }: { choice: Exclude<Verdict, 'UNRESOLVED' | 'CONFIRMED'> }) {
  const style = STAMP_STYLES[choice]
  return (
    <svg
      width={STAMP_SIZE}
      height={STAMP_SIZE}
      viewBox="0 0 320 320"
      style={{ display: 'block' }}
    >
      {/* 바깥 원 */}
      <circle cx="160" cy="160" r="148"
              fill="rgba(245,239,224,0.92)"
              stroke={style.color}
              strokeWidth="6" />
      <circle cx="160" cy="160" r="138"
              fill="none"
              stroke={style.color}
              strokeWidth="2" />

      {/* 중앙 텍스트 */}
      <text x="160" y="155"
            textAnchor="middle"
            fontFamily="'Traveling _Typewriter', 'Courier Prime', monospace"
            fontSize="42"
            fontWeight="900"
            fill={style.color}
            letterSpacing="3">
        {style.primary}
      </text>
      <text x="160" y="195"
            textAnchor="middle"
            fontFamily="'Traveling _Typewriter', 'Courier Prime', monospace"
            fontSize="14"
            fontWeight="700"
            fill={style.color}
            letterSpacing="4">
        {style.secondary}
      </text>

      {/* 곡선 따라 돌아가는 상단 텍스트 */}
      <defs>
        <path id="topArc" d="M 40 160 A 120 120 0 0 1 280 160" fill="none"/>
        <path id="bottomArc" d="M 60 200 A 100 100 0 0 0 260 200" fill="none"/>
      </defs>
      <text fontFamily="'Traveling _Typewriter', 'Courier Prime', monospace" fontSize="13" fill={style.color}
            letterSpacing="6" fontWeight="700">
        <textPath href="#topArc" startOffset="50%" textAnchor="middle">
          · VERDICT ·
        </textPath>
      </text>
      <text fontFamily="'Traveling _Typewriter', 'Courier Prime', monospace" fontSize="11" fill={style.color}
            letterSpacing="4" fontWeight="700">
        <textPath href="#bottomArc" startOffset="50%" textAnchor="middle">
          BAKERSTREET BUREAU
        </textPath>
      </text>
    </svg>
  )
}
