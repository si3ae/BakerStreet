import { create } from 'zustand'
import type { Entity, Edge } from '../types/bakerstreet'
import { bakerstreetData } from '../data'
import { useUIStore } from './uiStore'

// 노드 = entity + 좌표 + 회전. 좌표/회전은 layout 단계에서 채움.
export interface Node extends Entity {
  x: number
  y: number
  rotation: number
}

export type ActivateTrigger = 'user' | 'stream'

interface GraphState {
  nodes: Node[]
  edges: Edge[]
  patterns: string[]            // gemma_pattern (array) — 예: ["cycle", "hub"]

  // selector helpers
  getNode: (id: string) => Node | undefined
  getConnectedEdges: (entityId: string) => Edge[]
  getEdgeById: (edgeId: string) => Edge | undefined

  // Stage 6: edge 점화. graph 자체는 불변, uiStore만 변경.
  // design v7 §"activateEdge's Scope" — verifyEvidence는 호출하지 않음.
  // Stage 4에서 이미 검증이 끝나 edge.verification / evidence.verification에
  // 박혀 있으므로 그 status를 그대로 시각화에 사용.
  activateEdge: (edgeId: string, trigger: ActivateTrigger) => void
}

// 초기 hydrate — 좌표/회전 0으로 두고 initLayout에서 채움.
const initialNodes: Node[] = bakerstreetData.entities.map((e) => ({
  ...e,
  x: 0,
  y: 0,
  rotation: 0,
}))

// 현재 store 정의에서 zustand의 `set`은 직접 안 쓴다.
// 좌표 주입은 아래의 setNodePositions에서 useGraphStore.setState로,
// activateEdge는 uiStore만 변경하므로 set 불필요.
export const useGraphStore = create<GraphState>((_set, get) => ({
  nodes: initialNodes,
  edges: bakerstreetData.edges,
  patterns: bakerstreetData.meta.gemma_pattern,

  getNode: (id) => get().nodes.find((n) => n.id === id),
  getConnectedEdges: (entityId) =>
    get().edges.filter((e) => e.from === entityId || e.to === entityId),
  getEdgeById: (edgeId) => get().edges.find((e) => e.id === edgeId),

  activateEdge: (edgeId, _trigger) => {
    const edge = get().edges.find((e) => e.id === edgeId)
    if (!edge) return

    const ui = useUIStore.getState()

    // 1) activeEdges에 추가 (EdgeLayer가 가시성 분기)
    ui.addActiveEdge(edge.id)

    // 2) 양 endpoint에 ripple
    ui.addRipple(edge.from)
    ui.addRipple(edge.to)

    // 3) evidence별로 tag — 각 evidence의 kind/status를 그대로 사용.
    //    한 edge에 evidence가 여러 개면 각각 별개 tag.
    //    양 endpoint 모두에 동일한 tag 세트를 push.
    for (const ev of edge.evidences) {
      const payload = {
        kind: ev.kind,
        status: ev.verification.status,
        edgeId: edge.id,
      } as const
      ui.addTag(edge.from, payload)
      ui.addTag(edge.to, payload)
    }
  },
}))

// 외부에서 좌표+회전을 한 번에 주입 (layout 계산용)
export const setNodePlacements = (
  placements: Record<string, { x: number; y: number; rotation: number }>
) => {
  useGraphStore.setState((state) => ({
    nodes: state.nodes.map((n) =>
      placements[n.id]
        ? {
            ...n,
            x: placements[n.id].x,
            y: placements[n.id].y,
            rotation: placements[n.id].rotation,
          }
        : n
    ),
  }))
}
