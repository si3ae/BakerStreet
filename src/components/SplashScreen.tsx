import { useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '../store/uiStore'
import cityscape from '../assets/cityscape.png?url'

// ─────────────────────────────────────────────────────────────────────────
// SPLASH — 80년대 phosphor 모니터 톤.
//
// 세로 구성:
//   [상단]  cityscape (빌딩 ASCII) — 네온 그린
//   [중단]  BAKERSTREET ANSI Shadow 로고 — 네온 그린 + glow
//   [하단]  부팅 로그 — 네온 그린
//
// 전부 단일 톤 (#39FF14 phosphor green) + CRT scanline.
// ─────────────────────────────────────────────────────────────────────────

const LOGO = String.raw` ██████╗  █████╗ ██╗  ██╗███████╗██████╗ ███████╗████████╗██████╗ ███████╗███████╗████████╗
 ██╔══██╗██╔══██╗██║ ██╔╝██╔════╝██╔══██╗██╔════╝╚══██╔══╝██╔══██╗██╔════╝██╔════╝╚══██╔══╝
██████╔╝███████║█████╔╝ █████╗  ██████╔╝███████╗   ██║   ██████╔╝█████╗  █████╗     ██║   
██╔══██╗██╔══██║██╔═██╗ ██╔══╝  ██╔══██╗╚════██║   ██║   ██╔══██╗██╔══╝  ██╔══╝     ██║   
██████╔╝██║  ██║██║  ██╗███████╗██║  ██║███████║   ██║   ██║  ██║███████╗███████╗   ██║   
╚═════╝ ╚═╝  ╚═╝╚═╝  ╚═╝╚══════╝╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═╝╚══════╝╚══════╝   ╚═╝   `

const BOOT_LINES = [
  '> initializing BAKERSTREET v0.6 ...',
  '> loading raw_store [ok]',
  '> connecting nemotron-4 [ok]',
  '> loading gemma-3-4b [ok]',
  '> verifying evidence registry [ok]',
  '> ready.',
]

const LINE_INTERVAL_MS = 380
const SPLASH_TOTAL_MS = LINE_INTERVAL_MS * BOOT_LINES.length + 500

const NEON = '#39FF14'             // phosphor green
const BG = '#050805'                // 깊은 검정 (살짝 녹색 기 띄움)

export function SplashScreen() {
  const streamingState = useUIStore((s) => s.streamingState)
  const setStreamingState = useUIStore((s) => s.setStreamingState)
  const [lineCount, setLineCount] = useState(0)

  useEffect(() => {
    if (streamingState !== 'splash') return
    if (lineCount >= BOOT_LINES.length) return
    const t = setTimeout(() => setLineCount((n) => n + 1), LINE_INTERVAL_MS)
    return () => clearTimeout(t)
  }, [streamingState, lineCount])

  useEffect(() => {
    if (streamingState !== 'splash') return
    const t = setTimeout(() => setStreamingState('briefing'), SPLASH_TOTAL_MS)
    return () => clearTimeout(t)
  }, [streamingState, setStreamingState])

  return (
    <AnimatePresence>
      {streamingState === 'splash' && (
        <motion.div
          key="splash"
          initial={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          style={{
            position: 'absolute',
            inset: 0,
            background: BG,
            fontFamily: "'Courier Prime', monospace",
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 20,
            zIndex: 100,
            overflow: 'hidden',
            padding: '40px 20px',
          }}
        >
          {/* CRT scanline overlay — 항상 위에 깔림 */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              backgroundImage:
                'repeating-linear-gradient(0deg, rgba(0,0,0,0.30) 0px, rgba(0,0,0,0.30) 1px, transparent 1px, transparent 3px)',
              pointerEvents: 'none',
              zIndex: 10,
            }}
          />

          {/* radial vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              background:
                'radial-gradient(ellipse at center, transparent 0%, rgba(5,8,5,0.7) 100%)',
              pointerEvents: 'none',
              zIndex: 9,
            }}
          />

          {/* 1. 빌딩 — 화면 상단 */}
          <img
            src={cityscape}
            alt=""
            style={{
              maxWidth: 440,
              width: '32%',
              height: 'auto',
              opacity: 0.85,
              filter: 'drop-shadow(0 0 6px rgba(57,255,20,0.6))',
              imageRendering: 'pixelated',
              position: 'relative',
              zIndex: 1,
            }}
          />

          {/* 2. BAKERSTREET 로고 — 빌딩 아래 간격 확보 */}
          <motion.pre
            animate={{ opacity: [1, 1, 0.88, 1, 1] }}
            transition={{ duration: 1.6, repeat: Infinity, ease: 'linear' }}
            style={{
              margin: 0,
              marginTop: 40,
              fontSize: 13,
              lineHeight: 1.05,
              color: NEON,
              textShadow:
                '0 0 6px rgba(57,255,20,0.85), 0 0 14px rgba(57,255,20,0.5), 0 0 28px rgba(57,255,20,0.3)',
              letterSpacing: 0,
              position: 'relative',
              zIndex: 1,
            }}
          >
            {LOGO}
          </motion.pre>

          {/* 3. 부팅 로그 */}
          <div
            style={{
              minHeight: 170,
              width: 520,
              fontSize: 13,
              lineHeight: 1.65,
              color: NEON,
              textShadow: '0 0 4px rgba(57,255,20,0.5)',
              position: 'relative',
              zIndex: 1,
              marginTop: 8,
            }}
          >
            {BOOT_LINES.slice(0, lineCount).map((line, i) => (
              <div key={i}>
                {line}
                {i === lineCount - 1 && lineCount < BOOT_LINES.length && (
                  <span
                    style={{
                      display: 'inline-block',
                      width: 8,
                      height: 13,
                      background: NEON,
                      marginLeft: 4,
                      verticalAlign: 'middle',
                      animation: 'blinkCaret 0.7s steps(2) infinite',
                      boxShadow: '0 0 6px rgba(57,255,20,0.9)',
                    }}
                  />
                )}
              </div>
            ))}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
