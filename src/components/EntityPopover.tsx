import { useEffect, useState } from 'react'
import { getEntity, getEntityEdgeSummary } from '../lib/selectors'
import { useUIStore } from '../store/uiStore'
import { silhouetteFor } from '../assets/silhouettes'

interface Props {
  entityId: string
}

export function EntityPopover({ entityId }: Props) {
  const entity = getEntity(entityId)
  const summary = getEntityEdgeSummary(entityId)
  const selectEdge = useUIStore((s) => s.selectEdge)
  const memo = useUIStore((s) => s.memos[entityId])
  const commitMemoRevision = useUIStore((s) => s.commitMemoRevision)
  const clearMemo = useUIStore((s) => s.clearMemo)

  // 가드 — 옛 localStorage 구조에선 revisions 없을 수 있음.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const anyMemo = memo as any
  const safeRevisions = Array.isArray(memo?.revisions)
    ? memo!.revisions
    : anyMemo?.text
    ? [{ text: anyMemo.text, createdAt: memo?.updatedAt ?? Date.now() }]
    : []

  // 입력 상태 — 현재 입력 중인 텍스트.
  const currentText =
    safeRevisions[safeRevisions.length - 1]?.text ?? ''
  const [draft, setDraft] = useState(currentText)
  const [showHistory, setShowHistory] = useState(false)

  // 실루엣 — tooooools.app 스타일.
  // 한 장에 좌→우 변화 표현: 좌측 점, 중앙 짧은 stripe, 우측 긴 stripe.
  // 마우스 인터랙션 없음 — 정적 이미지로 단계 변화 한눈에.
  const silhouetteUrl = silhouetteFor(entityId)

  // entityId 바뀌면 draft 리셋.
  useEffect(() => {
    setDraft(currentText)
    setShowHistory(false)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entityId])

  if (!entity) return null

  const hasChanges = draft.trim() !== currentText
  const revisionCount = safeRevisions.length

  const handleSave = () => {
    if (draft.trim()) {
      commitMemoRevision(entityId, draft)
    }
  }

  const handleDelete = () => {
    clearMemo(entityId)
    setDraft('')
    setShowHistory(false)
  }

  return (
    <div className="font-mono text-sm space-y-3">
      <div>
        <div className="text-xs uppercase tracking-wider text-black/50">
          Entity
        </div>
        <div className="text-base font-bold">{entity.name}</div>
        <div className="text-xs text-black/60 mt-0.5">{entity.id}</div>
        <div className="text-xs mt-1">
          jurisdiction:{' '}
          <span className="text-ink font-bold">{entity.jurisdiction}</span>
        </div>
      </div>

      {/* 실루엣 — 세로 라인 halftone (Card.tsx와 동일 구조).
          1.6px 두께 stripe × 3px 간격, 인물 형태로만 mask 통과.
          마우스 인터랙션 없음. SVG pattern 한 번 정의 — 가벼움. */}
      <div className="border-t border-black/15 pt-2">
        <div
          className="flex items-center justify-between mb-1"
          style={{ fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace" }}
        >
          <div className="text-xs uppercase tracking-wider text-black/50">
            Silhouette
          </div>
        </div>
        <div
          style={{
            background: '#F0E5CC',
            border: '1px solid #C7B89A',
            padding: 0,
            userSelect: 'none',
            width: '100%',
            height: 380,
            overflow: 'hidden',
          }}
        >
          <svg
            viewBox="0 0 320 380"
            preserveAspectRatio="xMidYMid slice"
            style={{ display: 'block', width: '100%', height: '100%' }}
          >
            <defs>
              {/* 수직 stripe pattern — Card.tsx와 동일.
                  3px 간격으로 1.6px 두께 stripe. */}
              <pattern
                id={`halftone-${entityId}`}
                patternUnits="userSpaceOnUse"
                width="3"
                height="3"
              >
                <rect width="3" height="3" fill="transparent" />
                <rect width="1.6" height="3" fill="#2A2520" />
              </pattern>

              {/* silhouette mask — alpha 채널 활용, slice로 영역 가득. */}
              <mask id={`silmask-${entityId}`} maskUnits="userSpaceOnUse">
                <image
                  href={silhouetteUrl}
                  x="0" y="0" width="320" height="380"
                  preserveAspectRatio="xMidYMid slice"
                />
              </mask>
            </defs>

            {/* halftone으로 채운 사각형을 silhouette mask로 잘라냄 */}
            <rect
              x="0" y="0" width="320" height="380"
              fill={`url(#halftone-${entityId})`}
              mask={`url(#silmask-${entityId})`}
            />
          </svg>
        </div>
      </div>

      {/* 수사관 메모 ── revision 시스템 ────────────────────────────── */}
      <div className="border-t border-black/15 pt-2">
        <div className="flex items-center justify-between mb-1">
          <div className="text-xs uppercase tracking-wider text-black/50">
            Investigator's note
            {revisionCount > 0 && (
              <span className="ml-2 text-black/40 normal-case">
                rev {revisionCount}
              </span>
            )}
          </div>
          {revisionCount >= 1 && (
            <button
              onClick={() => setShowHistory((s) => !s)}
              className="text-xs text-black/60 hover:text-black underline"
              style={{ fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace" }}
            >
              {showHistory ? '◢ hide history' : '◣ history'}
            </button>
          )}
        </div>

        {/* 히스토리 — 모든 revision 표시 (가장 오래된 게 위, 최신이 아래) */}
        {showHistory && safeRevisions.length > 0 && (
          <div
            style={{
              background: '#F0E5CC',
              border: '1px solid #C7B89A',
              padding: '8px 10px',
              marginBottom: 8,
              fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
              fontSize: 11,
            }}
          >
            <div className="text-xs text-black/50 mb-2">revision log</div>
            {safeRevisions.map((rev, i) => {
              const isLatest = i === safeRevisions.length - 1
              return (
                <div
                  key={i}
                  className="mb-2 pb-2"
                  style={{
                    borderBottom: isLatest ? 'none' : '1px dashed #C7B89A',
                  }}
                >
                  <div
                    className="text-xs text-black/50 mb-1"
                    style={{ letterSpacing: '0.5px' }}
                  >
                    {i === 0 ? '✎ first' : `↳ rev ${i + 1}`} ·{' '}
                    {new Date(rev.createdAt).toLocaleString()}
                    {isLatest && (
                      <>
                        <span className="ml-2 text-black/70 font-bold">
                          ← current
                        </span>
                        <button
                          onClick={handleDelete}
                          title="메모 통째 삭제"
                          style={{
                            marginLeft: 8,
                            background: 'transparent',
                            border: 'none',
                            color: '#8A6A6A',
                            cursor: 'pointer',
                            fontFamily: 'inherit',
                            fontSize: 12,
                            padding: '0 4px',
                            lineHeight: 1,
                          }}
                        >
                          ✕
                        </button>
                      </>
                    )}
                  </div>
                  <div
                    className="text-xs text-black/80 whitespace-pre-wrap"
                    style={{ lineHeight: 1.5 }}
                  >
                    {rev.text}
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* 편집 영역 */}
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="이 entity에 대한 메모를 적으세요..."
          rows={3}
          style={{
            width: '100%',
            padding: '6px 8px',
            fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
            fontSize: 12,
            color: '#2A2520',
            background: '#FAF6EC',
            border: '1px solid #C7B89A',
            outline: 'none',
            resize: 'vertical',
            lineHeight: 1.4,
          }}
        />

        <div className="flex items-center justify-between mt-2 gap-2">
          <div className="text-xs text-black/40">
            {memo
              ? `updated ${new Date(memo.updatedAt).toLocaleTimeString()}`
              : 'no note yet'}
          </div>
          <div className="flex gap-1.5 items-center">
            <button
              onClick={handleSave}
              disabled={!hasChanges || !draft.trim()}
              className="text-xs px-2 py-1 border-none disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: '#2A2520',
                color: '#FAF6EC',
                fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
                fontWeight: 700,
              }}
            >
              {revisionCount === 0 ? '✎ save' : '↻ revise'}
            </button>
          </div>
        </div>
      </div>

      {/* Connected edges */}
      <div className="border-t border-black/15 pt-2">
        <div className="text-xs uppercase tracking-wider text-black/50 mb-1">
          Connected edges
        </div>
        <div className="text-xs mb-2">
          total {summary.total} · {summary.verified} verified ·{' '}
          <span className="text-flow">{summary.demoted} demoted</span>
        </div>
        <ul className="space-y-1 max-h-72 overflow-auto">
          {summary.edges.map(({ index, edge, direction }) => {
            const other = direction === 'out' ? edge.to : edge.from
            const arrow = direction === 'out' ? '→' : '←'
            const demoted = edge.verification.status === 'demoted'
            return (
              <li key={index}>
                <button
                  onClick={() => selectEdge(index)}
                  className="text-left w-full hover:bg-black/5 px-1 py-0.5 text-xs"
                >
                  <span className="text-black/50">[{edge.type}]</span> {arrow}{' '}
                  <span className="text-black/80">{other}</span>{' '}
                  {demoted ? (
                    <span className="text-flow">⚠ demoted</span>
                  ) : (
                    <span className="text-black/40">verified</span>
                  )}
                </button>
              </li>
            )
          })}
        </ul>
      </div>
    </div>
  )
}
