import { useEffect } from 'react'
import { BoardCanvas } from './components/BoardCanvas'
import { DetailPanel } from './components/DetailPanel'
import { InvestigatorLog } from './components/InvestigatorLog'
import { SherlockBot } from './components/SherlockBot'
import { VerdictStamp } from './components/VerdictStamp'
import { SplashScreen } from './components/SplashScreen'
import { CaseBriefing } from './components/CaseBriefing'
import { FooterWatermark } from './components/FooterWatermark'
import { ResizableSplit } from './components/ResizableSplit'
import { ArchivePanel } from './components/ArchivePanel'
import { SealingSequence } from './components/SealingSequence'
import type { ReportData } from './components/ReportPaper'
import { useUIStore } from './store/uiStore'
import { streamActivateEdges } from './lib/sequencer'
import { bakerstreetData } from './data'

const IDLE_TO_SEQUENCE_MS = 1000

// ─────────────────────────────────────────────────────────────────────────
// ReportData 빌더 — 봉인 모션에서 보여줄 리포트 본문.
// 데이터 소스: frozen JSON (bakerstreetData) + 사용자 verdict.
// 핵심 근거 = demoted edge 첫 5개의 details. 보조 = 나머지.
// (NIM 연결되면 Gemma가 직접 본문 생성하도록 확장 예정.)
// ─────────────────────────────────────────────────────────────────────────
function buildReport(
  choice: 'CONFIRMED' | 'SUSPECTED' | 'HOLD' | 'CLEAN',
  aiSuggested: string,
  isOverruled: boolean,
  caseId: string,
  subject: string,
): ReportData {
  const demoted = bakerstreetData.edges.filter(
    (e) => e.verification.status === 'demoted'
  )
  const verified = bakerstreetData.edges.filter(
    (e) => e.verification.status !== 'demoted'
  )

  const evidenceLine = (e: typeof demoted[0]): string => {
    const ev = e.evidences[0]
    const code = ev?.verification.failure_codes?.[0] ?? 'FAIL'
    const detail =
      ev?.verification.details?.[0] ?? `${ev?.kind ?? 'edge'} ${e.from}↔${e.to}`
    return `[${code}] ${detail}`
  }
  const verifiedLine = (e: typeof verified[0]): string => {
    const ev = e.evidences[0]
    return `${ev?.kind ?? 'edge'}: ${e.from} ↔ ${e.to}`
  }

  const headline =
    choice === 'CONFIRMED'
      ? `${demoted.length}건의 검증 실패와 ${bakerstreetData.meta.gemma_pattern.join(' + ')} 패턴이 셸 컴퍼니 구조와 일치합니다.`
      : choice === 'SUSPECTED'
      ? `의심 정황이 있으나 추가 확인이 필요합니다. ${demoted.length}건의 검증 실패 발견.`
      : choice === 'HOLD'
      ? `판결 보류. 결정적 증거 부족 — ${demoted.length}건의 의심 정황 기록.`
      : `유의미한 사기 정황 미발견. ${verified.length}건 검증 완료.`

  return {
    caseId: caseId || 'BS-UNTITLED',
    subject: subject || 'shell company cluster',
    verdict: choice,
    isOverruled,
    aiSuggested,
    headline,
    keyEvidence: demoted.slice(0, 5).map(evidenceLine),
    supporting: [
      ...demoted.slice(5).map(evidenceLine),
      ...verified.slice(0, 6).map(verifiedLine),
    ],
  }
}

function App() {
  const { stats, meta } = bakerstreetData
  const streamingState = useUIStore((s) => s.streamingState)
  const verdict = useUIStore((s) => s.verdict)
  const sealVerdict = useUIStore((s) => s.sealVerdict)
  const archiveCurrentCase = useUIStore((s) => s.archiveCurrentCase)
  const setArchiveOpen = useUIStore((s) => s.setArchiveOpen)
  const archivedCases = useUIStore((s) => s.archivedCases)
  const appendLog = useUIStore((s) => s.appendLog)
  const setStreamingState = useUIStore((s) => s.setStreamingState)
  const resetScene = useUIStore((s) => s.resetScene)
  const cardZoom = useUIStore((s) => s.cardZoom)
  const zoomInCard = useUIStore((s) => s.zoomInCard)
  const zoomOutCard = useUIStore((s) => s.zoomOutCard)
  const caseInput = useUIStore((s) => s.caseInput)

  useEffect(() => {
    if (streamingState !== 'idle') return
    const t = setTimeout(() => streamActivateEdges(), IDLE_TO_SEQUENCE_MS)
    return () => clearTimeout(t)
  }, [streamingState])

  const handleReplay = () => {
    streamActivateEdges()
  }

  const handleNewCase = () => {
    resetScene()
    setStreamingState('briefing')
  }

  // 판결 결재 — 4가지 버튼 중 하나 클릭 시.
  // sealing 상태로 진입 → SealingSequence가 표시됨 → 사용자가 'Seal & Send' →
  // 모션 끝나면 onSealingComplete가 briefing으로 보냄.
  const handleSeal = (choice: 'CONFIRMED' | 'SUSPECTED' | 'CLEAN' | 'HOLD') => {
    const isOverruled =
      verdict.aiSuggested !== 'UNRESOLVED' && verdict.aiSuggested !== choice
    appendLog(
      'VERDICT',
      isOverruled
        ? `OVERRULED — investigator: ${choice} (AI suggested: ${verdict.aiSuggested})`
        : `sealed by investigator: ${choice}`
    )
    sealVerdict(choice)
    setTimeout(() => archiveCurrentCase(), 0)
    setStreamingState('sealing')
  }

  // SealingSequence가 모든 모션 끝낸 후 호출.
  const handleSealingComplete = () => {
    resetScene()
    setStreamingState('briefing')
  }

  const isBoardVisible =
    streamingState === 'idle' ||
    streamingState === 'activating' ||
    streamingState === 'complete' ||
    streamingState === 'sealing'
  const isPlaying = streamingState === 'activating'
  const isSealed = verdict.sealedAt !== null
  const canSeal = streamingState === 'complete' && !isSealed

  return (
    <div
      className="h-screen w-screen overflow-hidden relative"
      style={{ background: '#EFE4CC' }}
    >
      {/* 워터마크 — 가장 뒤 */}
      <FooterWatermark />

      {/* 아카이브 모달 — 최상위 z-index 200, 모든 컨텐츠 위 */}
      <ArchivePanel />

      {/* SealingSequence — verdict 봉인 시 클라이맥스 모션 */}
      <SealingSequence
        open={streamingState === 'sealing'}
        report={buildReport(
          (verdict.investigatorChoice === 'UNRESOLVED'
            ? 'CONFIRMED'
            : verdict.investigatorChoice) as 'CONFIRMED' | 'SUSPECTED' | 'HOLD' | 'CLEAN',
          verdict.aiSuggested,
          verdict.isOverruled,
          caseInput.caseId,
          caseInput.subject,
        )}
        onComplete={handleSealingComplete}
      />

      {/* Splash / Briefing — 화면 전체에 절대 위치.
          isBoardVisible 전까지 헤더/보드/패널 다 안 보임. */}
      <SplashScreen />
      <CaseBriefing />

      {/* 조사 화면 — splash/briefing 끝나면 등장 */}
      {isBoardVisible && (
        <div className="h-full flex flex-col">
          <header
            className="px-6 py-3 border-b border-black/20 font-mono shrink-0 flex items-center justify-between relative"
            style={{ zIndex: 2 }}
          >
            <div>
              <h1 className="text-lg">BAKERSTREET</h1>
              {isSealed && (
                <p className="text-xs mt-1 text-black/70">
                  {stats.edges_total} edges · {stats.edges_verified} verified ·{' '}
                  <span style={{ color: '#B22222' }}>
                    {stats.edges_demoted} demoted
                  </span>{' '}
                  · model {meta.model_used}
                </p>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
              {canSeal && (
                <>
                  {verdict.aiSuggested !== 'UNRESOLVED' && (
                    <span
                      className="font-mono text-xs"
                      style={{
                        color: '#6B6052',
                        letterSpacing: '1px',
                        marginRight: 4,
                      }}
                    >
                      AI suggests: <strong>{verdict.aiSuggested}</strong>
                    </span>
                  )}
                  <VerdictButton
                    label="CONFIRMED"
                    onClick={() => handleSeal('CONFIRMED')}
                    color="#B22222"
                    bg
                  />
                  <VerdictButton
                    label="SUSPECTED"
                    onClick={() => handleSeal('SUSPECTED')}
                    color="#C97A3A"
                  />
                  <VerdictButton
                    label="HOLD"
                    onClick={() => handleSeal('HOLD')}
                    color="#6B6052"
                  />
                  <VerdictButton
                    label="CLEAN"
                    onClick={() => handleSeal('CLEAN')}
                    color="#3A6B4A"
                  />
                </>
              )}
              <button
                onClick={handleReplay}
                disabled={isPlaying}
                className="font-mono text-xs px-3 py-1.5 border border-black/40 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ letterSpacing: '1.5px' }}
              >
                {isPlaying ? '◉ INVESTIGATING…' : '▶ REPLAY'}
              </button>
              {/* 보드 zoom — 빼기/현재값/더하기. 클릭마다 0.2 단위 */}
              <div style={{ display: 'flex', alignItems: 'stretch', border: '1px solid rgba(0,0,0,0.4)' }}>
                <button
                  onClick={zoomOutCard}
                  disabled={cardZoom <= 1.0 + 0.01}
                  className="font-mono text-xs px-2 hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ borderRight: '1px solid rgba(0,0,0,0.25)' }}
                  title="축소"
                >
                  −
                </button>
                <div
                  className="font-mono text-xs px-2 flex items-center"
                  style={{ minWidth: 44, justifyContent: 'center', letterSpacing: 0.5 }}
                >
                  {cardZoom.toFixed(1)}×
                </div>
                <button
                  onClick={zoomInCard}
                  disabled={cardZoom >= 3.0 - 0.01}
                  className="font-mono text-xs px-2 hover:bg-black/5 disabled:opacity-30 disabled:cursor-not-allowed"
                  style={{ borderLeft: '1px solid rgba(0,0,0,0.25)' }}
                  title="확대"
                >
                  +
                </button>
              </div>
              <button
                onClick={handleNewCase}
                disabled={isPlaying}
                className="font-mono text-xs px-3 py-1.5 border border-black/40 hover:bg-black/5 disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ letterSpacing: '1.5px' }}
              >
                ✚ NEW CASE
              </button>
              <button
                onClick={() => setArchiveOpen(true)}
                className="font-mono text-xs px-3 py-1.5 border border-black/40 hover:bg-black/5"
                style={{ letterSpacing: '1.5px' }}
                title="봉인된 케이스 보관함"
              >
                ▤ ARCHIVE
                {(archivedCases?.length ?? 0) > 0 && (
                  <span style={{ marginLeft: 6, color: '#B22222', fontWeight: 700 }}>
                    {archivedCases.length}
                  </span>
                )}
              </button>
            </div>
          </header>

          <main className="flex-1 min-h-0 flex relative" style={{ zIndex: 1 }}>
            {/* 보드 영역 — 가용 가로 폭만큼만, 우측 패널이 자리 차지 */}
            <div className="flex-1 min-w-0 min-h-0 relative">
              <BoardCanvas />
              <SherlockBot />
              <VerdictStamp />
            </div>

            {/* 우측 컬럼 */}
            <aside className="w-[380px] shrink-0 border-l border-black/20 flex flex-col">
              <ResizableSplit
                storageKey="bakerstreet:detail-log-split"
                initialTopPercent={40}
                minTopPx={120}
                top={<DetailPanel />}
                bottom={<InvestigatorLog />}
              />
            </aside>
          </main>
        </div>
      )}
    </div>
  )
}

// ── 보조 컴포넌트 ──────────────────────────────────────────────────────

function VerdictButton({
  label,
  onClick,
  color,
  bg = false,
}: {
  label: string
  onClick: () => void
  color: string
  bg?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className="font-mono text-xs px-3 py-1.5 hover:opacity-90"
      style={{
        letterSpacing: '1.5px',
        background: bg ? color : 'transparent',
        color: bg ? '#FAF6EC' : color,
        border: bg ? 'none' : `1.5px solid ${color}`,
        fontWeight: 700,
      }}
    >
      {label}
    </button>
  )
}

export default App
