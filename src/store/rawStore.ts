import { create } from 'zustand'
import type { RawRecord } from '../types/bakerstreet'
import { bakerstreetData } from '../data'

interface RawState {
  records: Record<string, RawRecord>
  getRecord: (id: string) => RawRecord | undefined
  getReferencingEdgeIndices: (recordId: string) => number[]
}

export const useRawStore = create<RawState>((_set, get) => ({
  records: bakerstreetData.raw_store,

  getRecord: (id) => get().records[id],

  // record가 어떤 edge들의 evidence ref로 인용되고 있는지 reverse lookup.
  // edge id가 없으므로 인덱스로 반환. RawPanel에서 활용 (Stage 5는 미사용, 6에서).
  getReferencingEdgeIndices: (recordId) => {
    const edges = bakerstreetData.edges
    const result: number[] = []
    edges.forEach((edge, idx) => {
      const referenced = edge.evidences.some((ev) =>
        ev.refs.includes(recordId)
      )
      if (referenced) result.push(idx)
    })
    return result
  },
}))