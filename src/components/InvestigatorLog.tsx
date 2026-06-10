import { useEffect, useRef, useState } from 'react'
import { useUIStore, type LogLine, type LogLevel } from '../store/uiStore'
// ─────────────────────────────────────────────────────────────────────────
// Stage 6 C — 수사관 터미널 로그
//
// 라벨별 색:
//   INFO    — 회색 (배경 정보)
//   SCAN    — 파랑 (분석 중)
//   WARN    — 주황 (의심 신호 발견)
//   ALERT   — 빨강 (검증 실패/강한 신호)
//   GEMMA   — 짙은 빨강 + italic (홈즈 quip)
//   VERDICT — 굵은 빨강 + 큰 글씨 (결론)
//
// 각 라인은 typewriter 효과로 한 글자씩. 새 라인이 들어오면 자동 스크롤.
// ─────────────────────────────────────────────────────────────────────────

const LEVEL_STYLE: Record<LogLevel, { color: string; weight: number; italic: boolean }> = {
  INFO:    { color: '#6B6052', weight: 400, italic: false },
  SCAN:    { color: '#4A6FA5', weight: 400, italic: false },
  WARN:    { color: '#C97A3A', weight: 600, italic: false },
  ALERT:   { color: '#B22222', weight: 700, italic: false },
  GEMMA:   { color: '#5A8FA8', weight: 500, italic: true },     // 시안 — ALERT와 구분
  VERDICT: { color: '#B22222', weight: 800, italic: false },
}

export const TYPE_SPEED_MS = 70   // per char. sequencer가 직렬화 대기 시간 계산에 사용.

// 하나의 로그 라인. 마운트 시점부터 typewriter로 글자 늘림.
// details가 있으면 메인 line 다 친 뒤 둘째 줄도 typewriter.
function LogLineView({ line }: { line: LogLine }) {
  const fullMain = line.text
  const fullDetails = line.details ?? ''
  const totalLen = fullMain.length + fullDetails.length
  const [typed, setTyped] = useState(0)

  useEffect(() => {
    if (typed >= totalLen) return
    const t = setTimeout(() => setTyped((n) => Math.min(n + 1, totalLen)), TYPE_SPEED_MS)
    return () => clearTimeout(t)
  }, [typed, totalLen])

  const style = LEVEL_STYLE[line.level]
  const mainVisible = fullMain.slice(0, Math.min(typed, fullMain.length))
  const detailsVisible =
    typed > fullMain.length ? fullDetails.slice(0, typed - fullMain.length) : ''
  const isTypingMain = typed < fullMain.length
  const isTypingDetails =
    typed >= fullMain.length && typed < totalLen && fullDetails.length > 0

  return (
    <div
      style={{
        fontSize: line.level === 'VERDICT' ? 17 : 14,
        lineHeight: 1.55,
        fontFamily: "'Courier Prime', monospace",
        marginBottom: 3,
      }}
    >
      <div
        style={{
          color: style.color,
          fontWeight: style.weight,
          fontStyle: style.italic ? 'italic' : 'normal',
          whiteSpace: 'pre-wrap',
          wordBreak: 'break-word',
        }}
      >
        <span style={{ color: '#9B8E78', marginRight: 8 }}>
          [{line.timestamp}]
        </span>
        <span
          style={{
            display: 'inline-block',
            minWidth: 60,
            color: style.color,
            marginRight: 8,
            fontWeight: 700,
          }}
        >
          {line.level}
        </span>
        <span>{mainVisible}</span>
        {isTypingMain && <BlinkCaret color={style.color} />}
      </div>
      {fullDetails && detailsVisible && (
        <div
          style={{
            color: style.color,
            opacity: 0.75,
            paddingLeft: 90,           // [time] + LEVEL 너비만큼 들여쓰기
            whiteSpace: 'pre-wrap',
            wordBreak: 'break-word',
            fontSize: 13,
            marginTop: 1,
          }}
        >
          <span>{detailsVisible}</span>
          {isTypingDetails && <BlinkCaret color={style.color} />}
        </div>
      )}
    </div>
  )
}

function BlinkCaret({ color }: { color: string }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 7,
        height: 12,
        background: color,
        verticalAlign: 'baseline',
        marginLeft: 2,
        animation: 'blinkCaret 0.7s steps(2) infinite',
      }}
    />
  )
}

export function InvestigatorLog() {
  const logLines = useUIStore((s) => s.logLines)
  const caseInput = useUIStore((s) => s.caseInput)
  const scrollRef = useRef<HTMLDivElement>(null)

  // 새 라인 들어올 때마다 바닥으로 스크롤
  useEffect(() => {
    const el = scrollRef.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [logLines.length])

  return (
    <div
      style={{
        background: '#1F1B16',          // 짙은 갈색 — 종이가 아니라 터미널 톤
        border: '1px solid #3A3328',
        padding: '12px 14px',
        height: '100%',
        overflowY: 'auto',
        boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.4)',
      }}
      ref={scrollRef}
    >
      <style>{`@keyframes blinkCaret { 0%, 100% { opacity: 1 } 50% { opacity: 0 } }`}</style>

      {/* 헤더 */}
      <div
        style={{
          color: '#8A7B5F',
          fontFamily: "'Courier Prime', monospace",
          fontSize: 13,
          borderBottom: '1px dashed #4A4135',
          paddingBottom: 6,
          marginBottom: 8,
          letterSpacing: '1px',
        }}
      >
        <div>◉ INVESTIGATOR LOG · BAKERSTREET</div>
        {caseInput.caseId && (
          <div style={{ marginTop: 4, fontSize: 12, color: '#6B5E48' }}>
            case {caseInput.caseId} · {caseInput.subject} ·{' '}
            {caseInput.dateFrom}~{caseInput.dateTo}
          </div>
        )}
      </div>

      {logLines.length === 0 && (
        <div
          style={{
            color: '#5A5142',
            fontFamily: "'Courier Prime', monospace",
            fontSize: 12,
            fontStyle: 'italic',
          }}
        >
          waiting for incoming signals...
        </div>
      )}

      {logLines.map((line) => (
        <LogLineView key={line.id} line={line} />
      ))}
    </div>
  )
}
