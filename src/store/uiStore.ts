import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { EvidenceKind, VerificationStatus } from '../types/bakerstreet'

// ─────────────────────────────────────────────────────────────────────────
// uiStore — 수사 보드 UI 상태 + 케이스 영속 저장.
//
// 영속 부분 (localStorage):
//   - caseInput (briefing 입력값)
//   - logLines (수사 로그 히스토리)
//   - memos (카드별 수사관 메모)
//   - verdict (판결 + AI 추천 + overrule 여부)
//
// 비영속 부분 (메모리만):
//   - selection, activeEdges, ripples, tags, streamingState, cardZoom
//   - 시각 상태는 매번 처음부터 다시.
// ─────────────────────────────────────────────────────────────────────────

export type StreamingState =
  | 'splash' | 'briefing' | 'idle' | 'activating' | 'complete' | 'sealing'

export interface Ripple {
  id: string
  entityId: string
  timestamp: number
}

export interface Tag {
  id: string
  kind: EvidenceKind
  status: VerificationStatus
  edgeId: string
  timestamp: number
}

export type LogLevel =
  | 'INFO' | 'SCAN' | 'WARN' | 'ALERT' | 'GEMMA' | 'VERDICT'

export interface LogLine {
  id: string
  timestamp: string
  level: LogLevel
  text: string
  details?: string
}

export interface CaseInput {
  caseId: string
  subject: string
  dateFrom: string
  dateTo: string
}

// ── 판결 ────────────────────────────────────────────────────────────────
// 4가지 판결 + UNRESOLVED (아직 결재 전).
//   CONFIRMED   = 페이퍼컴퍼니로 확정 — 빨간 도장
//   SUSPECTED   = 의심되지만 증거 부족 — 주황 도장 (보류)
//   CLEAN       = 무혐의 — 녹색 도장
//   HOLD        = 보류 — 회색 도장
export type Verdict = 'UNRESOLVED' | 'CONFIRMED' | 'SUSPECTED' | 'CLEAN' | 'HOLD'

export interface VerdictRecord {
  // AI(Gemma) 추천. 시퀀스 끝나면 자동으로 채워짐. CONFIRMED일 가능성 높음.
  aiSuggested: Verdict
  // 수사관(사용자)의 최종 결정. 'UNRESOLVED'면 결재 전.
  investigatorChoice: Verdict
  // AI ≠ 수사관일 때 true. 도장에 OVERRULED 표시.
  isOverruled: boolean
  // 결재 시각 (도장 박힌 시각). null이면 아직 결재 안 됨.
  sealedAt: number | null
}

// ── 메모 ────────────────────────────────────────────────────────────────
// 카드(entity)별 수사관 메모. 수정 기록(revisions) 보존 — 언제 어떻게 생각이
// 바뀌었는지 추적. 최초 작성 + 모든 수정본이 시간순으로 쌓임.
export interface MemoRevision {
  text: string
  createdAt: number
}

export interface Memo {
  entityId: string
  revisions: MemoRevision[]    // [0] = 최초 작성, [-1] = 최신
  updatedAt: number            // 가장 최근 수정 시각 (= revisions[-1].createdAt)
}

// ── 아카이브 ────────────────────────────────────────────────────────────
// 봉인된(sealed) 케이스 한 묶음. verdict가 봉인되면 자동으로 archive에 push.
// 같은 caseId 있으면 덮어씀 (수정).
export interface ArchivedCase {
  archiveId: string            // 내부 ID — 같은 caseId 여러 번 저장 가능하게
  caseInput: CaseInput
  logLines: LogLine[]
  memos: Record<string, Memo>
  verdict: VerdictRecord       // sealedAt 반드시 채워져 있음
  archivedAt: number           // 마지막 archive 시각
}

interface UIState {
  // 비영속 — selection
  selectedEntityId: string | null
  selectedEdgeIndex: number | null

  // 비영속 — 시각 상태
  activeEdges: string[]
  ripples: Ripple[]
  tags: Record<string, Tag[]>
  streamingState: StreamingState
  cardZoom: number
  archiveOpen: boolean         // 아카이브 모달 열림 여부

  // 영속 — 작업 중인 케이스
  caseInput: CaseInput
  logLines: LogLine[]
  memos: Record<string, Memo>      // entityId → memo
  verdict: VerdictRecord

  // 영속 — 아카이브
  archivedCases: ArchivedCase[]

  // actions — selection
  selectEntity: (id: string | null) => void
  selectEdge: (index: number | null) => void
  clearSelection: () => void

  // actions — 시각 상태
  addActiveEdge: (edgeId: string) => void
  addRipple: (entityId: string) => void
  removeRipple: (rippleId: string) => void
  addTag: (entityId: string, payload: Omit<Tag, 'id' | 'timestamp'>) => void
  setStreamingState: (s: StreamingState) => void
  cycleCardZoom: () => void
  zoomInCard: () => void
  zoomOutCard: () => void
  resetCardZoom: () => void
  setArchiveOpen: (open: boolean) => void

  // actions — 로그
  appendLog: (level: LogLevel, text: string, details?: string) => void
  appendLogStream: (level: LogLevel) => string
  appendLogStreamChunk: (id: string, chunk: string) => void

  // actions — case
  setCaseInput: (input: CaseInput) => void

  // actions — verdict
  setAiVerdict: (v: Verdict) => void
  sealVerdict: (choice: Verdict) => void

  // actions — 메모
  // commitMemoRevision: 새 revision을 추가. 빈 텍스트면 무시.
  // clearMemo: 메모 통째 삭제 (모든 revision 사라짐).
  commitMemoRevision: (entityId: string, text: string) => void
  clearMemo: (entityId: string) => void

  // actions — 아카이브
  // archiveCurrentCase: 현재 케이스를 아카이브에 push. sealedAt 없으면 무시.
  // restoreFromArchive: 아카이브의 케이스를 currentCase로 복원. 작업 재개용.
  // updateArchivedVerdict: 아카이브 안의 verdict 수정 (재판결).
  // deleteFromArchive: 아카이브에서 삭제.
  archiveCurrentCase: () => void
  restoreFromArchive: (archiveId: string) => void
  updateArchivedVerdict: (archiveId: string, choice: Verdict) => void
  deleteFromArchive: (archiveId: string) => void

  // actions — reset
  resetScene: () => void
  resetEverything: () => void      // localStorage까지 비움
}

let _idCounter = 0
const nextId = (prefix: string) => `${prefix}_${++_idCounter}`

let _logSeconds = 0
function nextTimestamp(): string {
  const total = 14 * 3600 + 22 * 60 + _logSeconds
  _logSeconds += 1 + Math.floor(Math.random() * 2)
  const hh = Math.floor(total / 3600) % 24
  const mm = Math.floor(total / 60) % 60
  const ss = total % 60
  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}`
}

const DEFAULT_VERDICT: VerdictRecord = {
  aiSuggested: 'UNRESOLVED',
  investigatorChoice: 'UNRESOLVED',
  isOverruled: false,
  sealedAt: null,
}

export const useUIStore = create<UIState>()(
  persist(
    (set) => ({
      // 비영속
      selectedEntityId: null,
      selectedEdgeIndex: null,
      activeEdges: [],
      ripples: [],
      tags: {},
      // case URL param이 있으면 (dataset switch reload) splash 건너뛰고 briefing부터.
      // 처음 방문 (case param 없음) 은 splash 정상 표시.
      streamingState: (
        typeof window !== 'undefined' &&
        new URLSearchParams(window.location.search).get('case')
          ? 'briefing'
          : 'splash'
      ) as StreamingState,
      cardZoom: 1.0,
      archiveOpen: false,

      // 영속 — 작업 중
      caseInput: { caseId: '', subject: '', dateFrom: '', dateTo: '' },
      logLines: [],
      memos: {},
      verdict: DEFAULT_VERDICT,

      // 영속 — 아카이브
      archivedCases: [],

      // selection
      selectEntity: (id) => set({ selectedEntityId: id, selectedEdgeIndex: null }),
      selectEdge: (index) => set({ selectedEdgeIndex: index, selectedEntityId: null }),
      clearSelection: () => set({ selectedEntityId: null, selectedEdgeIndex: null }),

      setArchiveOpen: (open) => set({ archiveOpen: open }),

      // 시각
      addActiveEdge: (edgeId) =>
        set((state) =>
          state.activeEdges.includes(edgeId)
            ? state
            : { activeEdges: [...state.activeEdges, edgeId] }
        ),
      addRipple: (entityId) =>
        set((state) => ({
          ripples: [...state.ripples, { id: nextId('rip'), entityId, timestamp: Date.now() }],
        })),
      removeRipple: (rippleId) =>
        set((state) => ({ ripples: state.ripples.filter((r) => r.id !== rippleId) })),
      addTag: (entityId, payload) =>
        set((state) => {
          const existing = state.tags[entityId] ?? []
          const tag: Tag = { ...payload, id: nextId('tag'), timestamp: Date.now() }
          return { tags: { ...state.tags, [entityId]: [...existing, tag] } }
        }),
      setStreamingState: (s) => set({ streamingState: s }),
      cycleCardZoom: () =>
        set((state) => ({
          cardZoom: state.cardZoom < 2.2 - 0.01
            ? Math.round((state.cardZoom + 0.4) * 10) / 10
            : 1.0,
        })),
      zoomInCard: () =>
        set((state) => ({
          cardZoom: Math.min(3.0, Math.round((state.cardZoom + 0.2) * 10) / 10),
        })),
      zoomOutCard: () =>
        set((state) => ({
          cardZoom: Math.max(1.0, Math.round((state.cardZoom - 0.2) * 10) / 10),
        })),
      resetCardZoom: () => set({ cardZoom: 1.0 }),

      // 로그
      appendLog: (level, text, details) =>
        set((state) => ({
          logLines: [
            ...state.logLines,
            { id: nextId('log'), timestamp: nextTimestamp(), level, text, details },
          ],
        })),
      appendLogStream: (level) => {
        const id = nextId('log')
        set((state) => ({
          logLines: [
            ...state.logLines,
            { id, timestamp: nextTimestamp(), level, text: '' },
          ],
        }))
        return id
      },
      appendLogStreamChunk: (id, chunk) =>
        set((state) => ({
          logLines: state.logLines.map((l) =>
            l.id === id ? { ...l, text: l.text + chunk } : l
          ),
        })),

      // case
      setCaseInput: (input) => set({ caseInput: input }),

      // verdict
      setAiVerdict: (v) =>
        set((state) => ({ verdict: { ...state.verdict, aiSuggested: v } })),
      sealVerdict: (choice) =>
        set((state) => {
          const isOver =
            state.verdict.aiSuggested !== 'UNRESOLVED' &&
            state.verdict.aiSuggested !== choice
          const next = {
            ...state.verdict,
            investigatorChoice: choice,
            isOverruled: isOver,
            sealedAt: Date.now(),
          }
          console.log('[verdict] sealVerdict called:', { choice, next })
          return { verdict: next }
        }),

      // 메모
      commitMemoRevision: (entityId, text) => {
        const trimmed = text.trim()
        if (!trimmed) return        // 빈 텍스트는 commit 안 함 (clearMemo 따로 호출)
        set((state) => {
          const existing = state.memos[entityId]
          const now = Date.now()
          const newRevision: MemoRevision = { text: trimmed, createdAt: now }
          // 마지막 revision과 동일한 텍스트면 commit 안 함 (중복 방지).
          if (
            existing &&
            existing.revisions.length > 0 &&
            existing.revisions[existing.revisions.length - 1].text === trimmed
          ) {
            return state
          }
          const revisions = existing
            ? [...existing.revisions, newRevision]
            : [newRevision]
          return {
            memos: {
              ...state.memos,
              [entityId]: { entityId, revisions, updatedAt: now },
            },
          }
        })
      },
      clearMemo: (entityId) =>
        set((state) => ({
          memos: Object.fromEntries(
            Object.entries(state.memos).filter(([k]) => k !== entityId)
          ),
        })),

      // ── 아카이브 ───────────────────────────────────────────────────
      archiveCurrentCase: () =>
        set((state) => {
          if (state.verdict.sealedAt === null) return state
          // 같은 caseId 이미 있으면 덮어씀 (수정 케이스).
          const existingIdx = state.archivedCases.findIndex(
            (c) => c.caseInput.caseId === state.caseInput.caseId
          )
          const entry: ArchivedCase = {
            archiveId:
              existingIdx >= 0
                ? state.archivedCases[existingIdx].archiveId
                : nextId('arch'),
            caseInput: state.caseInput,
            logLines: state.logLines,
            memos: state.memos,
            verdict: state.verdict,
            archivedAt: Date.now(),
          }
          const archivedCases =
            existingIdx >= 0
              ? state.archivedCases.map((c, i) => (i === existingIdx ? entry : c))
              : [...state.archivedCases, entry]
          return { archivedCases }
        }),

      restoreFromArchive: (archiveId) =>
        set((state) => {
          const target = state.archivedCases.find((c) => c.archiveId === archiveId)
          if (!target) return state
          _logSeconds = 0
          return {
            caseInput: target.caseInput,
            logLines: target.logLines,
            memos: target.memos,
            verdict: target.verdict,
            // 시각 상태는 'complete'로 (이미 봉인된 케이스니까).
            streamingState: 'complete',
            activeEdges: [],
            ripples: [],
            tags: {},
            selectedEntityId: null,
            selectedEdgeIndex: null,
            archiveOpen: false,
          }
        }),

      updateArchivedVerdict: (archiveId, choice) =>
        set((state) => ({
          archivedCases: state.archivedCases.map((c) => {
            if (c.archiveId !== archiveId) return c
            const isOver =
              c.verdict.aiSuggested !== 'UNRESOLVED' &&
              c.verdict.aiSuggested !== choice
            return {
              ...c,
              verdict: {
                ...c.verdict,
                investigatorChoice: choice,
                isOverruled: isOver,
                sealedAt: Date.now(),
              },
              archivedAt: Date.now(),
            }
          }),
        })),

      deleteFromArchive: (archiveId) =>
        set((state) => ({
          archivedCases: state.archivedCases.filter(
            (c) => c.archiveId !== archiveId
          ),
        })),

      // reset
      resetScene: () => {
        _logSeconds = 0
        set({
          activeEdges: [],
          ripples: [],
          tags: {},
          streamingState: 'idle',
          logLines: [],
          verdict: DEFAULT_VERDICT,
          selectedEntityId: null,
          selectedEdgeIndex: null,
        })
      },
      resetEverything: () => {
        _logSeconds = 0
        set({
          activeEdges: [],
          ripples: [],
          tags: {},
          streamingState: 'splash',
          logLines: [],
          memos: {},
          verdict: DEFAULT_VERDICT,
          caseInput: { caseId: '', subject: '', dateFrom: '', dateTo: '' },
          selectedEntityId: null,
          selectedEdgeIndex: null,
          cardZoom: 1.0,
        })
      },
    }),
    {
      name: 'bakerstreet:case',
      storage: createJSONStorage(() => localStorage),
      // 영속 대상만 골라서 저장 (시각 상태는 제외).
      partialize: (state) => ({
        caseInput: state.caseInput,
        logLines: state.logLines,
        memos: state.memos,
        verdict: state.verdict,
        archivedCases: state.archivedCases,
      }),
      // hydrate된 데이터에 누락 필드 있으면 초기값으로 fill — 옛 localStorage 호환.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<UIState>
        return {
          ...current,
          ...p,
          archivedCases: Array.isArray(p.archivedCases) ? p.archivedCases : [],
          memos: p.memos && typeof p.memos === 'object' ? p.memos : {},
          logLines: Array.isArray(p.logLines) ? p.logLines : [],
        }
      },
    }
  )
)
