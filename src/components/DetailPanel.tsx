import { useUIStore } from '../store/uiStore'
import { EntityPopover } from './EntityPopover'
import { EdgePopover } from './EdgePopover'

export function DetailPanel() {
  const selectedEntityId = useUIStore((s) => s.selectedEntityId)
  const selectedEdgeIndex = useUIStore((s) => s.selectedEdgeIndex)
  const clearSelection = useUIStore((s) => s.clearSelection)

  const hasSelection =
    selectedEntityId !== null || selectedEdgeIndex !== null

  return (
    <div className="h-full flex flex-col bg-paper/60">
      <div className="px-4 py-3 border-b border-black/15 flex items-center justify-between shrink-0">
        <span className="font-mono text-xs uppercase tracking-wider text-black/50">
          Detail
        </span>
        {hasSelection && (
          <button
            onClick={clearSelection}
            className="font-mono text-xs px-2 py-0.5 border border-black/30 hover:bg-black/5"
          >
            clear
          </button>
        )}
      </div>
      <div className="px-4 py-4 flex-1 overflow-auto">
        {selectedEntityId !== null && (
          <EntityPopover entityId={selectedEntityId} />
        )}
        {selectedEdgeIndex !== null && (
          <EdgePopover edgeIndex={selectedEdgeIndex} />
        )}
        {!hasSelection && (
          <div className="font-mono text-xs text-black/50 italic">
            Click a card or edge.
          </div>
        )}
      </div>
    </div>
  )
}
