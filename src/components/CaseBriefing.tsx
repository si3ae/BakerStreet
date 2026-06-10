import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useUIStore } from '../store/uiStore'
import { useGraphStore } from '../store/graphStore'
import {
  bakerstreetData,
  AVAILABLE_CASES,
  CURRENT_CASE_ID,
  switchCase,
  type CaseId,
} from '../data'

// ─────────────────────────────────────────────────────────────────────────
// CASE BRIEFING — 입력 폼.
//
// 사용자가 사건 정보를 입력하고 시작하는 화면. 입력값은 uiStore.caseInput에
// 저장되어 InvestigatorLog 헤더와 우측 패널에 표시.
//
// Stage 8: dataset picker 추가 — alpha/bravo/charlie 합성 데이터셋 선택.
// 선택 시 URL 갈아끼우고 reload, 모든 store가 새로 hydrate.
//
// 종이 컨셉 + 빨간 도장 + 핀.
// 등장: y: 80 → 0. 시작 클릭 시: y: 0 → -900 (위로 솟구침).
// ─────────────────────────────────────────────────────────────────────────

const PAPER_BG = '#F5EFE0'
const PAPER_EDGE = '#C7B89A'
const INK = '#2A2520'
const STAMP_RED = '#B22222'
const MUTED = '#6B6052'

const DEFAULT_CASE_ID = 'BS-2026-0512-A'
const DEFAULT_SUBJECT = 'shell company cluster'
const DEFAULT_FROM = '2024-01-01'
const DEFAULT_TO = '2024-12-31'

export function CaseBriefing() {
  const streamingState = useUIStore((s) => s.streamingState)
  const setStreamingState = useUIStore((s) => s.setStreamingState)
  const setCaseInput = useUIStore((s) => s.setCaseInput)
  const nodes = useGraphStore((s) => s.nodes)
  const { meta, stats } = bakerstreetData

  const [caseId, setCaseId] = useState('')
  const [subject, setSubject] = useState('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')

  const jurisdictions = new Set(nodes.map((n) => n.jurisdiction)).size

  const handleBegin = () => {
    setCaseInput({
      caseId: caseId.trim() || DEFAULT_CASE_ID,
      subject: subject.trim() || DEFAULT_SUBJECT,
      dateFrom: dateFrom.trim() || DEFAULT_FROM,
      dateTo: dateTo.trim() || DEFAULT_TO,
    })
    setStreamingState('idle')
  }

  const handleDatasetSwitch = (newCaseId: CaseId) => {
    if (newCaseId === CURRENT_CASE_ID) return
    switchCase(newCaseId)  // URL 갈아끼우고 reload
  }

  return (
    <AnimatePresence>
      {streamingState === 'briefing' && (
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            zIndex: 80,
            pointerEvents: 'auto',
          }}
        >
          <motion.div
            key="briefing"
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: -900, opacity: 0 }}
            transition={{ duration: 0.7, ease: [0.2, 0.8, 0.2, 1] }}
          >
          <div
            style={{
              width: 580,
              padding: '32px 44px 32px',
              background: PAPER_BG,
              border: `1px solid ${PAPER_EDGE}`,
              boxShadow:
                '0 8px 24px rgba(0,0,0,0.25), 0 1px 0 rgba(255,255,255,0.6) inset',
              fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
              color: INK,
              position: 'relative',
              maxHeight: '92vh',
              overflow: 'auto',
            }}
          >
            {/* 핀 */}
            <Pin top={14} left={18} />
            <Pin top={14} left="auto" right={18} />

            {/* 상단 도장 */}
            <div style={{ textAlign: 'center', marginBottom: 4 }}>
              <div
                style={{
                  display: 'inline-block',
                  border: `3px solid ${STAMP_RED}`,
                  padding: '6px 24px',
                  color: STAMP_RED,
                  fontSize: 22,
                  fontWeight: 800,
                  letterSpacing: 6,
                  transform: 'rotate(-1.5deg)',
                }}
              >
                NEW INVESTIGATION
              </div>
            </div>
            <div
              style={{
                textAlign: 'center',
                fontSize: 11,
                letterSpacing: 2.5,
                color: MUTED,
                marginBottom: 24,
              }}
            >
              fill in to begin · empty fields use defaults
            </div>

            {/* 입력 필드 */}
            <FormRow label="CASE ID">
              <input
                value={caseId}
                onChange={(e) => setCaseId(e.target.value)}
                placeholder={DEFAULT_CASE_ID}
                style={inputStyle}
              />
            </FormRow>
            <FormRow label="SUBJECT">
              <input
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder={DEFAULT_SUBJECT}
                style={inputStyle}
              />
            </FormRow>
            <FormRow label="DATE RANGE">
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                  placeholder={DEFAULT_FROM}
                  style={{ ...inputStyle, flex: 1 }}
                />
                <span style={{ color: MUTED, alignSelf: 'center' }}>—</span>
                <input
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                  placeholder={DEFAULT_TO}
                  style={{ ...inputStyle, flex: 1 }}
                />
              </div>
            </FormRow>

            {/* DATASET picker — Stage 8 추가 */}
            <FormRow label="DATASET">
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {AVAILABLE_CASES.map((c) => {
                  const isActive = c.id === CURRENT_CASE_ID
                  return (
                    <button
                      key={c.id}
                      onClick={() => handleDatasetSwitch(c.id)}
                      title={c.tagline}
                      style={{
                        fontFamily: 'inherit',
                        fontSize: 11,
                        fontWeight: 700,
                        letterSpacing: 1.5,
                        padding: '5px 12px',
                        background: isActive ? INK : '#FAF6EC',
                        color: isActive ? '#FAF6EC' : INK,
                        border: `1px solid ${isActive ? INK : PAPER_EDGE}`,
                        cursor: isActive ? 'default' : 'pointer',
                        flex: '0 0 auto',
                      }}
                    >
                      {c.label}
                      {isActive && <span style={{ marginLeft: 6, fontSize: 9 }}>●</span>}
                    </button>
                  )
                })}
              </div>
            </FormRow>
            <div
              style={{
                fontSize: 10,
                color: MUTED,
                marginTop: 2,
                marginLeft: 146,  // FormRow label width(130) + gap(16)
                fontStyle: 'italic',
                lineHeight: 1.4,
              }}
            >
              {AVAILABLE_CASES.find((c) => c.id === CURRENT_CASE_ID)?.tagline}
            </div>

            {/* 시스템이 자동 제공하는 정보 (편집 불가) */}
            <div
              style={{
                marginTop: 18,
                paddingTop: 12,
                borderTop: '1px dashed rgba(0,0,0,0.18)',
              }}
            >
              <div
                style={{
                  fontSize: 10,
                  color: MUTED,
                  letterSpacing: 1.5,
                  marginBottom: 8,
                }}
              >
                SYSTEM-PROVIDED
              </div>
              <SystemRow label="ENTITY POOL">
                {nodes.length} entities · {jurisdictions} jurisdictions
              </SystemRow>
              <SystemRow label="EVIDENCE INDEX">
                {stats.edges_total} links · {stats.evidences_total} evidence
                items
              </SystemRow>
              <SystemRow label="ANALYST MODEL">{meta.model_used}</SystemRow>
            </div>

            {/* 버튼 */}
            <div style={{ textAlign: 'center', marginTop: 28 }}>
              <button
                onClick={handleBegin}
                style={{
                  fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: 3,
                  padding: '12px 36px',
                  background: STAMP_RED,
                  color: '#FAF6EC',
                  border: 'none',
                  cursor: 'pointer',
                  boxShadow: '0 3px 0 rgba(0,0,0,0.25)',
                }}
              >
                ▶ BEGIN INVESTIGATION
              </button>
            </div>
          </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}

// ── 보조 컴포넌트 ──────────────────────────────────────────────────────

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '6px 10px',
  fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
  fontSize: 13,
  color: INK,
  background: '#FAF6EC',
  border: `1px solid ${PAPER_EDGE}`,
  outline: 'none',
}

function FormRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        alignItems: 'center',
        padding: '8px 0',
      }}
    >
      <div
        style={{
          width: 130,
          flexShrink: 0,
          color: MUTED,
          letterSpacing: 1.5,
          fontSize: 11,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function SystemRow({
  label,
  children,
}: {
  label: string
  children: React.ReactNode
}) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 16,
        padding: '4px 0',
        fontSize: 12,
        lineHeight: 1.5,
      }}
    >
      <div
        style={{
          width: 130,
          flexShrink: 0,
          color: MUTED,
          letterSpacing: 1.5,
          fontSize: 11,
        }}
      >
        {label}
      </div>
      <div style={{ flex: 1 }}>{children}</div>
    </div>
  )
}

function Pin({
  top,
  left,
  right,
}: {
  top: number
  left?: number | 'auto'
  right?: number
}) {
  return (
    <div
      style={{
        position: 'absolute',
        top,
        left: left as number | undefined,
        right,
        width: 12,
        height: 12,
        background: '#A03030',
        borderRadius: '50%',
        boxShadow: '0 2px 2px rgba(0,0,0,0.3)',
      }}
    />
  )
}
