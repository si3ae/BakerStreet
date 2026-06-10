import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  useUIStore,
  type ArchivedCase,
  type Verdict,
} from '../store/uiStore'

// ─────────────────────────────────────────────────────────────────────────
// ArchivePanel — 봉인된 케이스 저장소.
//
// 좌측: 케이스 목록 (caseId · subject · 판결 · 봉인 시각)
// 우측: 선택된 케이스 상세 — logs / memos / verdict
// 액션: 재오픈 (작업 재개), 재판결 (verdict 수정), 삭제
//
// 발표 컨셉: "수사관이 과거 사건을 다시 들춰본다. 판결이 틀렸다면 다시 결재."
// ─────────────────────────────────────────────────────────────────────────

const PAPER_BG = '#F0E5CC'
const PAPER_EDGE = '#C7B89A'
const INK = '#2A2520'

const VERDICT_COLOR: Record<Exclude<Verdict, 'UNRESOLVED'>, string> = {
  CONFIRMED: '#B22222',
  SUSPECTED: '#C97A3A',
  HOLD: '#6B6052',
  CLEAN: '#3A6B4A',
}

export function ArchivePanel() {
  const archiveOpen = useUIStore((s) => s.archiveOpen)
  const setArchiveOpen = useUIStore((s) => s.setArchiveOpen)
  const archivedCases = useUIStore((s) => s.archivedCases)
  const restoreFromArchive = useUIStore((s) => s.restoreFromArchive)
  const updateArchivedVerdict = useUIStore((s) => s.updateArchivedVerdict)
  const deleteFromArchive = useUIStore((s) => s.deleteFromArchive)

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null)

  // 최신 archive 먼저 표시. 옛 localStorage에 archivedCases 필드 없을 수 있어
  // 가드 — undefined면 빈 배열로 처리.
  const safeArchivedCases = Array.isArray(archivedCases) ? archivedCases : []
  const sortedCases = [...safeArchivedCases].sort(
    (a, b) => b.archivedAt - a.archivedAt
  )
  const selected = sortedCases.find((c) => c.archiveId === selectedId)
  console.log('[archive] render', {
    open: archiveOpen,
    count: safeArchivedCases.length,
    selectedId,
    selectedFound: !!selected,
    ids: sortedCases.map((c) => c.archiveId),
  })

  return (
    <AnimatePresence>
      {archiveOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(20, 18, 14, 0.78)',
            zIndex: 200,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 40,
            fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
          }}
          onClick={() => setArchiveOpen(false)}
        >
          {/* 모달 본체 — 클릭 전파 막음 */}
          <motion.div
            initial={{ scale: 0.95, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 20 }}
            transition={{ duration: 0.25, ease: [0.2, 0.8, 0.2, 1] }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 1100,
              height: '88vh',
              background: PAPER_BG,
              border: `1px solid ${PAPER_EDGE}`,
              boxShadow: '0 12px 40px rgba(0,0,0,0.5)',
              display: 'flex',
              flexDirection: 'column',
              color: INK,
            }}
          >
            {/* 헤더 */}
            <div
              style={{
                padding: '18px 24px',
                borderBottom: `1px solid ${PAPER_EDGE}`,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ fontSize: 18, fontWeight: 700, letterSpacing: 2 }}>
                  ▤ CASE ARCHIVE
                </div>
                <div style={{ fontSize: 11, color: '#6B6052', marginTop: 2 }}>
                  봉인된 사건 보관함 · {archivedCases.length} sealed cases
                </div>
              </div>
              <button
                onClick={() => setArchiveOpen(false)}
                style={{
                  background: 'transparent',
                  border: `1px solid ${PAPER_EDGE}`,
                  padding: '4px 12px',
                  fontFamily: 'inherit',
                  fontSize: 12,
                  letterSpacing: 1.5,
                  cursor: 'pointer',
                  color: INK,
                }}
              >
                ✕ CLOSE
              </button>
            </div>

            {/* 본문 — 좌측 목록 / 우측 상세 */}
            <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
              {/* 좌측 목록 */}
              <div
                style={{
                  width: 320,
                  borderRight: `1px solid ${PAPER_EDGE}`,
                  overflow: 'auto',
                  flexShrink: 0,
                }}
              >
                {sortedCases.length === 0 ? (
                  <div
                    style={{
                      padding: 32,
                      color: '#8A7B5F',
                      fontSize: 12,
                      fontStyle: 'italic',
                      textAlign: 'center',
                    }}
                  >
                    아직 봉인된 케이스가 없습니다.
                    <br />
                    수사를 완료하고 verdict를 결재하면
                    <br />
                    여기에 보관됩니다.
                  </div>
                ) : (
                  sortedCases.map((c) => (
                    <CaseListItem
                      key={c.archiveId}
                      archived={c}
                      selected={c.archiveId === selectedId}
                      onSelect={() => setSelectedId(c.archiveId)}
                    />
                  ))
                )}
              </div>

              {/* 우측 상세 */}
              <div style={{ flex: 1, overflow: 'auto', minWidth: 0 }}>
                {selected ? (
                  <CaseDetail
                    key={selected.archiveId}
                    archived={selected}
                    onRestore={() => restoreFromArchive(selected.archiveId)}
                    onUpdateVerdict={(v) =>
                      updateArchivedVerdict(selected.archiveId, v)
                    }
                    onRequestDelete={() => setConfirmDeleteId(selected.archiveId)}
                    isDeleting={confirmDeleteId === selected.archiveId}
                    onConfirmDelete={() => {
                      deleteFromArchive(selected.archiveId)
                      setConfirmDeleteId(null)
                      setSelectedId(null)
                    }}
                    onCancelDelete={() => setConfirmDeleteId(null)}
                  />
                ) : (
                  <div
                    style={{
                      padding: 32,
                      color: '#8A7B5F',
                      fontSize: 12,
                      fontStyle: 'italic',
                    }}
                  >
                    좌측에서 케이스를 선택하세요.
                  </div>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// ── 좌측 목록 한 줄 ─────────────────────────────────────────────────────
function CaseListItem({
  archived,
  selected,
  onSelect,
}: {
  archived: ArchivedCase
  selected: boolean
  onSelect: () => void
}) {
  const v = archived.verdict.investigatorChoice
  const color =
    v !== 'UNRESOLVED' ? VERDICT_COLOR[v] : '#8A7B5F'
  return (
    <button
      onClick={onSelect}
      style={{
        display: 'block',
        width: '100%',
        textAlign: 'left',
        padding: '12px 16px',
        border: 'none',
        borderBottom: `1px solid ${PAPER_EDGE}`,
        background: selected ? '#E6D9BC' : 'transparent',
        fontFamily: 'inherit',
        cursor: 'pointer',
        color: INK,
      }}
    >
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 2 }}>
        {archived.caseInput.caseId || '(no id)'}
      </div>
      <div style={{ fontSize: 11, color: '#6B6052', marginBottom: 6 }}>
        {archived.caseInput.subject || '(no subject)'}
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 8,
        }}
      >
        <div
          style={{
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: 1.5,
            color,
            padding: '2px 6px',
            border: `1px solid ${color}`,
          }}
        >
          {v}
          {archived.verdict.isOverruled && ' ★'}
        </div>
        <div style={{ fontSize: 10, color: '#8A7B5F' }}>
          {new Date(archived.archivedAt).toLocaleDateString()}
        </div>
      </div>
    </button>
  )
}

// ── 우측 상세 ───────────────────────────────────────────────────────────
function CaseDetail({
  archived,
  onRestore,
  onUpdateVerdict,
  onRequestDelete,
  isDeleting,
  onConfirmDelete,
  onCancelDelete,
}: {
  archived: ArchivedCase
  onRestore: () => void
  onUpdateVerdict: (v: Verdict) => void
  onRequestDelete: () => void
  isDeleting: boolean
  onConfirmDelete: () => void
  onCancelDelete: () => void
}) {
  const v = archived.verdict
  const memoEntries = Object.values(archived.memos)
  const logCount = archived.logLines.length

  return (
    <div style={{ padding: 24, fontSize: 13, lineHeight: 1.55 }}>
      {/* 헤더 */}
      <div style={{ marginBottom: 20 }}>
        <div style={{ fontSize: 11, color: '#6B6052', letterSpacing: 2 }}>
          CASE ID
        </div>
        <div style={{ fontSize: 20, fontWeight: 700, marginTop: 2 }}>
          {archived.caseInput.caseId || '(no id)'}
        </div>
        <div style={{ fontSize: 13, color: '#4A4135', marginTop: 4 }}>
          {archived.caseInput.subject}
        </div>
        <div style={{ fontSize: 11, color: '#8A7B5F', marginTop: 4 }}>
          기간: {archived.caseInput.dateFrom} ~ {archived.caseInput.dateTo}
          {' · '}
          archived {new Date(archived.archivedAt).toLocaleString()}
        </div>
      </div>

      {/* Verdict 영역 */}
      <Section title="VERDICT">
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div
            style={{
              fontSize: 24,
              fontWeight: 900,
              color:
                v.investigatorChoice !== 'UNRESOLVED'
                  ? VERDICT_COLOR[v.investigatorChoice]
                  : '#8A7B5F',
              letterSpacing: 2,
            }}
          >
            {v.investigatorChoice}
          </div>
          {v.isOverruled && (
            <div
              style={{
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: 2,
                color: '#FAF6EC',
                background: '#2A2520',
                padding: '2px 8px',
              }}
            >
              ★ OVERRULED ★
            </div>
          )}
        </div>
        <div style={{ fontSize: 11, color: '#6B6052', marginTop: 6 }}>
          AI suggested: {v.aiSuggested}
          {' · sealed '}
          {v.sealedAt ? new Date(v.sealedAt).toLocaleString() : '(?)'}
        </div>

        {/* Verdict 변경 버튼들 */}
        <div style={{ marginTop: 12, display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <div style={{ fontSize: 11, color: '#6B6052', alignSelf: 'center', marginRight: 4 }}>
            re-seal as:
          </div>
          {(['CONFIRMED', 'SUSPECTED', 'HOLD', 'CLEAN'] as const).map((opt) => (
            <button
              key={opt}
              onClick={() => onUpdateVerdict(opt)}
              disabled={opt === v.investigatorChoice}
              style={{
                fontFamily: 'inherit',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: 1.5,
                padding: '4px 8px',
                border: `1.5px solid ${VERDICT_COLOR[opt]}`,
                background:
                  opt === v.investigatorChoice ? VERDICT_COLOR[opt] : 'transparent',
                color:
                  opt === v.investigatorChoice ? '#FAF6EC' : VERDICT_COLOR[opt],
                cursor: opt === v.investigatorChoice ? 'default' : 'pointer',
                opacity: opt === v.investigatorChoice ? 1 : 0.85,
              }}
            >
              {opt}
            </button>
          ))}
        </div>
      </Section>

      {/* 로그 요약 */}
      <Section title={`INVESTIGATION LOG (${logCount} lines)`}>
        <div
          style={{
            maxHeight: 200,
            overflow: 'auto',
            border: `1px solid ${PAPER_EDGE}`,
            padding: '8px 12px',
            background: '#FAF6EC',
            fontSize: 11,
            lineHeight: 1.5,
          }}
        >
          {archived.logLines.slice(0, 50).map((l) => (
            <div key={l.id} style={{ marginBottom: 2 }}>
              <span style={{ color: '#9B8E78' }}>[{l.timestamp}]</span>{' '}
              <span style={{ fontWeight: 700, color: levelColor(l.level) }}>
                {l.level}
              </span>{' '}
              {l.text}
              {l.details && (
                <div
                  style={{
                    paddingLeft: 32,
                    fontSize: 10,
                    color: '#6B6052',
                    opacity: 0.7,
                  }}
                >
                  {l.details}
                </div>
              )}
            </div>
          ))}
          {archived.logLines.length > 50 && (
            <div style={{ color: '#8A7B5F', fontStyle: 'italic', marginTop: 6 }}>
              ... ({archived.logLines.length - 50} more lines)
            </div>
          )}
        </div>
      </Section>

      {/* 메모 */}
      <Section title={`INVESTIGATOR MEMOS (${memoEntries.length})`}>
        {memoEntries.length === 0 ? (
          <div style={{ fontSize: 11, color: '#8A7B5F', fontStyle: 'italic' }}>
            메모가 적혀 있지 않습니다.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {memoEntries.map((m) => {
              // 가드 — 옛 localStorage 구조에선 revisions 없을 수 있음 (text만).
              // 그 경우 text를 revision 1개처럼 표시.
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              const anyM = m as any
              const revisions = Array.isArray(m.revisions)
                ? m.revisions
                : anyM.text
                ? [{ text: anyM.text, createdAt: m.updatedAt ?? Date.now() }]
                : []
              const latest = revisions[revisions.length - 1]
              if (!latest) return null
              return (
                <div
                  key={m.entityId}
                  style={{
                    border: `1px solid ${PAPER_EDGE}`,
                    padding: '10px 12px',
                    background: '#FAF6EC',
                    fontSize: 12,
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: '#6B6052',
                      letterSpacing: 1,
                      marginBottom: 4,
                    }}
                  >
                    {m.entityId} · {revisions.length} revision
                    {revisions.length > 1 ? 's' : ''}
                  </div>
                  <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.5 }}>
                    {latest.text}
                  </div>
                  <div style={{ fontSize: 10, color: '#8A7B5F', marginTop: 4 }}>
                    last edited {new Date(latest.createdAt).toLocaleString()}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </Section>

      {/* 액션 버튼들 */}
      <div
        style={{
          display: 'flex',
          gap: 8,
          marginTop: 24,
          paddingTop: 16,
          borderTop: `1px solid ${PAPER_EDGE}`,
        }}
      >
        <button
          onClick={onRestore}
          style={{
            fontFamily: 'inherit',
            fontSize: 12,
            fontWeight: 700,
            letterSpacing: 1.5,
            padding: '8px 16px',
            background: INK,
            color: '#FAF6EC',
            border: 'none',
            cursor: 'pointer',
          }}
        >
          ↻ RESTORE (작업 재개)
        </button>
        {!isDeleting ? (
          <button
            onClick={onRequestDelete}
            style={{
              fontFamily: 'inherit',
              fontSize: 12,
              padding: '8px 16px',
              background: 'transparent',
              color: '#B22222',
              border: '1px solid #B22222',
              cursor: 'pointer',
              letterSpacing: 1.5,
            }}
          >
            ✕ DELETE
          </button>
        ) : (
          <>
            <button
              onClick={onConfirmDelete}
              style={{
                fontFamily: 'inherit',
                fontSize: 12,
                fontWeight: 700,
                padding: '8px 16px',
                background: '#B22222',
                color: '#FAF6EC',
                border: 'none',
                cursor: 'pointer',
                letterSpacing: 1.5,
              }}
            >
              CONFIRM DELETE
            </button>
            <button
              onClick={onCancelDelete}
              style={{
                fontFamily: 'inherit',
                fontSize: 12,
                padding: '8px 16px',
                background: 'transparent',
                border: `1px solid ${PAPER_EDGE}`,
                cursor: 'pointer',
                color: INK,
              }}
            >
              cancel
            </button>
          </>
        )}
      </div>
    </div>
  )
}

function Section({
  title,
  children,
}: {
  title: string
  children: React.ReactNode
}) {
  return (
    <div style={{ marginBottom: 18 }}>
      <div
        style={{
          fontSize: 11,
          color: '#6B6052',
          letterSpacing: 2,
          borderBottom: `1px dashed ${PAPER_EDGE}`,
          paddingBottom: 4,
          marginBottom: 10,
        }}
      >
        {title}
      </div>
      {children}
    </div>
  )
}

function levelColor(level: string): string {
  switch (level) {
    case 'WARN': return '#C97A3A'
    case 'ALERT': return '#B22222'
    case 'GEMMA': return '#5A8FA8'
    case 'VERDICT': return '#B22222'
    default: return '#4A4135'
  }
}
