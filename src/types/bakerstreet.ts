// bakerstreet_frontend.json의 스키마 (인계 v2 §6)

export type EdgeType = 'flow' | 'shared_attribute'

export type VerificationStatus = 'verified' | 'demoted'

export type FailureCode =
  | 'FLOW_DIRECTION_MISMATCH'
  | 'REF_NOT_IN_WHITELIST'
  | 'KIND_TYPE_MISMATCH'
  | 'ENDPOINT_NOT_IN_RECORD'
  | 'STRUCTURAL_INVALID'
  | string // 안전망

// design.md v7 Evidence kind enum
export type FlowKind = 'wire transfer' | 'fund routing'
export type SharedAttributeKind =
  | 'shared registered agent'
  | 'common nominee director'
  | 'matching IP address'
  | 'shared beneficial owner'
  | 'same registration address'
  | 'co-incorporation timing'
export type EvidenceKind = FlowKind | SharedAttributeKind

export interface Verification {
  status: VerificationStatus
  failure_codes: FailureCode[]
  details?: string
}

export interface Evidence {
  kind: EvidenceKind
  refs: string[]
  verification: Verification
}

export interface Edge {
  // derived id `${from}__${to}__${type}`, data/index.ts에서 주입.
  // 원본 JSON에는 없지만 로딩 시점에 박아서 store 단에선 항상 존재 보장.
  id: string
  from: string
  to: string
  type: EdgeType
  evidences: Evidence[]
  verification: Verification
}

export interface Entity {
  id: string
  jurisdiction: string
  name: string
}

// raw_store 안의 record. payload는 type별로 다른 모양이라 unknown으로 두고
// 렌더 시점에 narrow.
export type RawRecordType = 'transaction' | 'account' | 'registration' | 'ip'

export interface RawRecord {
  id: string
  type: RawRecordType
  payload: Record<string, unknown>
}

export interface Stats {
  edges_total: number
  edges_verified: number
  edges_demoted: number
  evidences_total: number
  evidences_verified: number
  evidences_demoted: number
}

export interface Meta {
  generated_at: string
  model_used: string
  gemma_summary: string
  gemma_pattern: string[]
}

export interface VerificationFailure {
  // 자유로운 모양 — 일단 record로 받고 렌더 시점에 narrow
  [key: string]: unknown
}

export interface BakerStreetData {
  meta: Meta
  stats: Stats
  entities: Entity[]
  edges: Edge[]
  raw_store: Record<string, RawRecord>
  verification_failures: VerificationFailure[]
}