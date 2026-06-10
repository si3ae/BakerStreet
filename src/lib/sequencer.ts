import { useGraphStore } from '../store/graphStore'
import { useUIStore } from '../store/uiStore'
import { bakerstreetData } from '../data'
import { TYPE_SPEED_MS } from '../components/InvestigatorLog'
import { fetchGemmaQuip } from './nim'
import type { Edge, Evidence } from '../types/bakerstreet'

// ─────────────────────────────────────────────────────────────────────────
// Sequencer — JSON 텍스트 그대로 흘림. 한 라인 완료 → 다음 라인 시작 (직렬).
//
// 원칙: 라인 N의 typewriter가 끝나야 라인 N+1을 emit. 실제 NIM streaming
// 환경(Stage 7)에서도 토큰 흐름이 끝나야 다음 라인이 도착하는 게 자연.
//
// 타이밍 계산:
//   per-line wait = (main.length + details.length) * TYPE_SPEED_MS + LINE_BUFFER
// edge 점화는 로그 emit과 동시 (사용자가 시각/청각 동기 인지).
// ─────────────────────────────────────────────────────────────────────────

const delay = (ms: number) => new Promise((r) => setTimeout(r, ms))

const LINE_BUFFER_MS = 400         // 라인 typewriter 완료 후 추가 대기
const GEMMA_PRE_DELAY_MS = 1200    // 마지막 edge → GEMMA 라인 사이 휴지
const FINALIZE_DELAY_MS = 800      // GEMMA 라인 완료 → complete 진입 사이

// 한 라인 typewriter 완료까지 걸리는 ms.
function lineDuration(text: string, details?: string): number {
  const len = text.length + (details?.length ?? 0)
  return len * TYPE_SPEED_MS + LINE_BUFFER_MS
}

// ─────────────────────────────────────────────────────────────────────────
// 중복 시퀀스 abort 메커니즘.
// streamActivateEdges 호출 시마다 새 runId. 루프 안에서 매번 확인 →
// 다른 runId가 시작되면 자신은 조용히 종료.
// 사용자가 REPLAY를 연타하거나 NEW CASE → BEGIN을 빠르게 누르면 이전 호출이
// 살아있을 수 있음. 그 둘이 동시에 돌면 로그 라인이 겹쳐 나옴.
// ─────────────────────────────────────────────────────────────────────────

let currentRunId = 0

export interface StreamActivateOptions {
  onComplete?: () => void
}

// edge → 로그 라인 — JSON에서 직접 추출. 합성 문구 없음.
function edgeToLog(edge: Edge): {
  level: 'WARN' | 'ALERT'
  text: string
  details?: string
} {
  const ev: Evidence | undefined = edge.evidences[0]
  const isDemoted = edge.verification.status === 'demoted'

  if (isDemoted) {
    // 첫 줄: failure code 짧게.
    // 둘째 줄: verification.details[0] 원문.
    const code = ev?.verification.failure_codes?.[0] ?? 'VERIFICATION_FAILED'
    const detailLine =
      Array.isArray(ev?.verification.details) && ev.verification.details.length > 0
        ? ev.verification.details[0]
        : undefined
    return {
      level: 'ALERT',
      text: code,
      details: detailLine,
    }
  }

  // verified: kind + 양 endpoint만 짧게.
  const kind = ev?.kind ?? 'evidence'
  return {
    level: 'WARN',
    text: `${kind}: ${edge.from} ↔ ${edge.to}`,
  }
}

export async function streamActivateEdges(options: StreamActivateOptions = {}) {
  const { onComplete } = options

  // 새 runId 발급. 루프 안에서 이게 바뀌면 (= 다른 호출이 시작됨) abort.
  const myRunId = ++currentRunId
  const isAborted = () => currentRunId !== myRunId

  const ui = useUIStore.getState()
  const graph = useGraphStore.getState()

  ui.resetScene()
  ui.setStreamingState('activating')

  // shared_attribute → flow 순. 의심이 쌓이고 흐름이 드러나는 시퀀스.
  const ordered = [
    ...graph.edges.filter((e) => e.type === 'shared_attribute'),
    ...graph.edges.filter((e) => e.type === 'flow'),
  ]

  for (const edge of ordered) {
    if (isAborted()) return
    const { level, text, details } = edgeToLog(edge)
    ui.appendLog(level, text, details)
    graph.activateEdge(edge.id, 'stream')
    await delay(lineDuration(text, details))
  }
  if (isAborted()) return

  // GEMMA 라인 — NIM에서 실시간 streaming. 실패 시 frozen JSON으로 fallback.
  await delay(GEMMA_PRE_DELAY_MS)
  if (isAborted()) return

  const caseInput = ui.caseInput
  const totalEdges = graph.edges.length
  const verifiedEdges = graph.edges.filter((e) => e.verification.status !== 'demoted').length
  const demotedEdges = graph.edges.filter((e) => e.verification.status === 'demoted').length
  const jurisdictions = new Set(graph.nodes.map((n) => n.jurisdiction)).size
  const evidenceSummary =
    `${graph.nodes.length} entities across ${jurisdictions} jurisdictions, ` +
    `${totalEdges} evidence links (${verifiedEdges} verified, ${demotedEdges} demoted). ` +
    `Suspected pattern: ${graph.patterns.join(', ')}.`

  // 대표 demoted 단서 한두 개 — 모델에 구체성 제공.
  const keyFindings: string[] = graph.edges
    .filter((e) => e.verification.status === 'demoted')
    .slice(0, 3)
    .map((e) => {
      const ev = e.evidences[0]
      const code = ev?.verification.failure_codes?.[0] ?? 'FAIL'
      const detail = ev?.verification.details?.[0] ?? ''
      return `${code}: ${detail}`
    })

  const streamId = ui.appendLogStream('GEMMA')
  let receivedAny = false
  try {
    const stream = fetchGemmaQuip({
      case_id: caseInput.caseId || 'BS-UNTITLED',
      subject: caseInput.subject || 'shell company cluster',
      date_from: caseInput.dateFrom || '',
      date_to: caseInput.dateTo || '',
      evidence_summary: evidenceSummary,
      key_findings: keyFindings,
    })
    for await (const token of stream) {
      if (isAborted()) return
      useUIStore.getState().appendLogStreamChunk(streamId, token)
      receivedAny = true
    }
  } catch (err) {
    if (isAborted()) return
    console.warn('NIM streaming failed, falling back to frozen JSON:', err)
    if (!receivedAny) {
      useUIStore
        .getState()
        .appendLogStreamChunk(streamId, bakerstreetData.meta.gemma_summary)
    }
  }

  if (isAborted()) return
  const finalLine =
    useUIStore.getState().logLines.find((l) => l.id === streamId)?.text ?? ''
  await delay(lineDuration(finalLine))
  if (isAborted()) return

  // AI 판결 추천 — 단순 휴리스틱.
  // patterns에 cycle/hub 같은 경고 패턴이 있고 demoted edge가 충분히 있으면 CONFIRMED.
  // demoted 0개면 CLEAN. 그 사이는 SUSPECTED.
  const demotedCount = graph.edges.filter(
    (e) => e.verification.status === 'demoted'
  ).length
  const totalCount = graph.edges.length
  const demotedRatio = totalCount > 0 ? demotedCount / totalCount : 0
  let aiVerdict: 'CONFIRMED' | 'SUSPECTED' | 'CLEAN' = 'SUSPECTED'
  if (graph.patterns.length > 0 && demotedRatio >= 0.3) {
    aiVerdict = 'CONFIRMED'
  } else if (demotedCount === 0) {
    aiVerdict = 'CLEAN'
  }
  useUIStore.getState().setAiVerdict(aiVerdict)

  await delay(FINALIZE_DELAY_MS)
  if (isAborted()) return
  useUIStore.getState().setStreamingState('complete')
  onComplete?.()
}
