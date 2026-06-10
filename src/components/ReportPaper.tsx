import { useState } from 'react'

// ─────────────────────────────────────────────────────────────────────────
// ReportPaper — 봉인되는 리포트 한 장.
//
// 구조 (flex column 3단):
//   [HEADER]   고정. 케이스 ID + verdict 라벨.
//   [BODY]     ← maxBodyHeight 안에서 스크롤. 헤드라인 + key evidence + supporting.
//   [FOOTER]   고정. 서명 자리 + AI 추천.
//
// SUPPORTING 펼치면 BODY 안에서만 늘어남. 종이 자체 height는 안정.
// 외부 (SealingSequence)가 SEAL 버튼을 종이 밑에 둠.
// ─────────────────────────────────────────────────────────────────────────

export interface ReportData {
  caseId: string
  subject: string
  verdict: 'CONFIRMED' | 'SUSPECTED' | 'HOLD' | 'CLEAN'
  isOverruled: boolean
  aiSuggested: string
  headline: string                // 한 줄 결론
  keyEvidence: string[]           // 핵심 근거 5줄
  supporting: string[]            // 접이식 보조 근거
}

const VERDICT_COLOR: Record<ReportData['verdict'], string> = {
  CONFIRMED: '#B22222',
  SUSPECTED: '#C97A3A',
  HOLD: '#6B6052',
  CLEAN: '#3A6B4A',
}

interface Props {
  data: ReportData
  /** 본문(스크롤 영역)의 max height (px). 헤더/풋터는 별도. 기본 360. */
  maxBodyHeight?: number
  /** FOOTER 자리에 추가로 들어갈 콘텐츠 (예: SEAL & SEND 버튼).
   *  FOOTER (BakerStreet Bureau · AI: ...) 줄 아래에 추가됨. */
  footerExtra?: React.ReactNode
}

export function ReportPaper({ data, maxBodyHeight = 360, footerExtra }: Props) {
  const [supportingOpen, setSupportingOpen] = useState(false)
  const color = VERDICT_COLOR[data.verdict]

  return (
    <div
      style={{
        width: 480,
        background: '#F5EFE0',
        fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
        color: '#2A2520',
        boxShadow: '0 8px 24px rgba(0,0,0,0.35), 0 1px 0 rgba(255,255,255,0.6) inset',
        border: '1px solid #C7B89A',
        backgroundImage:
          'repeating-linear-gradient(180deg, transparent 0 30px, rgba(0,0,0,0.018) 30px 31px)',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ─── HEADER (고정) ─── */}
      <div
        style={{
          flexShrink: 0,
          padding: '20px 32px 14px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'flex-start',
          borderBottom: '1px dashed rgba(199, 184, 154, 0.35)',
        }}
      >
        <div>
          <div style={{ fontSize: 10, color: '#8A7B5F', letterSpacing: 2, marginBottom: 2 }}>
            INVESTIGATION REPORT · CONFIDENTIAL
          </div>
          <div style={{ fontSize: 15, fontWeight: 700 }}>{data.caseId}</div>
          <div style={{ fontSize: 12, color: '#4A4135', marginTop: 2 }}>{data.subject}</div>
        </div>
        <div
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: 2.5,
            color,
            border: `1.5px solid ${color}`,
            padding: '4px 10px',
            whiteSpace: 'nowrap',
          }}
        >
          {data.verdict}
        </div>
      </div>

      {/* ─── BODY (스크롤 영역) ─── */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          maxHeight: maxBodyHeight,
          padding: '16px 32px',
          // 스크롤바 톤 (paper에 어울리게)
          scrollbarWidth: 'thin',
          scrollbarColor: '#B8A98C transparent',
        }}
      >
        {/* 헤드라인 */}
        <div
          style={{
            fontSize: 13,
            lineHeight: 1.6,
            marginBottom: 16,
            padding: '10px 12px',
            background: 'rgba(178, 34, 34, 0.05)',
            borderLeft: `3px solid ${color}`,
            fontStyle: 'italic',
          }}
        >
          {data.headline}
        </div>

        {/* 핵심 근거 */}
        <div style={{ marginBottom: 16 }}>
          <div style={{ fontSize: 10, color: '#6B6052', letterSpacing: 2, marginBottom: 6 }}>
            KEY EVIDENCE
          </div>
          <ol style={{ paddingLeft: 22, margin: 0, fontSize: 12, lineHeight: 1.65 }}>
            {data.keyEvidence.slice(0, 5).map((ev, i) => (
              <li key={i} style={{ marginBottom: 4, wordBreak: 'break-word' }}>
                {ev}
              </li>
            ))}
          </ol>
        </div>

        {/* 접이식 보조 근거 */}
        {data.supporting.length > 0 && (
          <div style={{ borderTop: '1px dashed #C7B89A', paddingTop: 10, marginTop: 8 }}>
            <button
              onClick={() => setSupportingOpen((s) => !s)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                background: 'transparent',
                border: 'none',
                fontFamily: 'inherit',
                fontSize: 10,
                color: '#6B6052',
                letterSpacing: 2,
                cursor: 'pointer',
                padding: 0,
              }}
            >
              <span
                style={{
                  transition: 'transform 0.2s',
                  transform: supportingOpen ? 'rotate(90deg)' : 'rotate(0deg)',
                  display: 'inline-block',
                  fontSize: 9,
                }}
              >
                ▶
              </span>
              SUPPORTING · {data.supporting.length} more
            </button>
            {supportingOpen && (
              <ul
                style={{
                  paddingLeft: 22,
                  margin: '8px 0 0',
                  fontSize: 11,
                  lineHeight: 1.55,
                  color: '#4A4135',
                  listStyle: '"·  "',
                }}
              >
                {data.supporting.map((s, i) => (
                  <li key={i} style={{ marginBottom: 3, wordBreak: 'break-word' }}>
                    {s}
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}
      </div>

      {/* ─── FOOTER (고정) ─── */}
      <div
        style={{
          flexShrink: 0,
          padding: '10px 32px 14px',
          borderTop: '1px dashed rgba(199, 184, 154, 0.45)',
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10,
          color: '#6B6052',
        }}
      >
        <span>BakerStreet Bureau · 221B</span>
        <span>
          AI: {data.aiSuggested}
          {data.isOverruled && (
            <strong style={{ color: '#B22222', marginLeft: 6 }}>★ OVERRULED</strong>
          )}
        </span>
      </div>

      {/* footerExtra — SEAL & SEND 같은 액션 버튼 자리 (종이 안) */}
      {footerExtra && (
        <div
          style={{
            flexShrink: 0,
            padding: '0 32px 18px',
            display: 'flex',
            justifyContent: 'center',
          }}
        >
          {footerExtra}
        </div>
      )}
    </div>
  )
}
