import type { BakerStreetData, Edge } from '../types/bakerstreet'

// ────────────────────────────────────────────────────────────────────────────
// Stage 8 — 다중 case 매핑 (Nemotron 합성 alpha/bravo/charlie)
//
// 발표 시연 안전성 + 재시연 다양성 위해 3개 case 풀.
// 동일한 셸 컴퍼니 구조 위에 다른 표층 (회사명/주소/agent).
//
// URL 쿼리 ?case=<id> 로 선택. 기본 alpha-2026.
// CaseBriefing의 dataset picker가 URL 갈아끼우고 reload — 모든 store 새로 hydrate.
// 이 방식이 zustand store 부분 reset보다 단순/안전.
// ────────────────────────────────────────────────────────────────────────────

import alphaRaw from './bakerstreet_frontend_alpha-2026.json'
import bravoRaw from './bakerstreet_frontend_bravo-2026.json'
import charlieRaw from './bakerstreet_frontend_charlie-2026.json'

export type CaseId = 'alpha-2026' | 'bravo-2026' | 'charlie-2026'

export interface CaseDescriptor {
  id: CaseId
  label: string         // 사용자에게 보여줄 짧은 라벨
  tagline: string       // 한 줄 설명 (각 case의 회사 톤 차이 힌트)
}

export const AVAILABLE_CASES: CaseDescriptor[] = [
  {
    id: 'alpha-2026',
    label: 'ALPHA',
    tagline: 'Aurelia, Stormgate, Polaris — primary demo',
  },
  {
    id: 'bravo-2026',
    label: 'BRAVO',
    tagline: 'alternative cluster — backup pool 1',
  },
  {
    id: 'charlie-2026',
    label: 'CHARLIE',
    tagline: 'alternative cluster — backup pool 2',
  },
]

export const DEFAULT_CASE_ID: CaseId = 'alpha-2026'

const RAW_BY_CASE: Record<CaseId, unknown> = {
  'alpha-2026': alphaRaw,
  'bravo-2026': bravoRaw,
  'charlie-2026': charlieRaw,
}

/**
 * URL 쿼리에서 case 선택값 읽기. 잘못된 값이거나 없으면 default.
 *
 * SSR 안전: window 없으면 default.
 */
export function getCurrentCaseId(): CaseId {
  if (typeof window === 'undefined') return DEFAULT_CASE_ID
  const params = new URLSearchParams(window.location.search)
  const q = params.get('case')
  if (q && AVAILABLE_CASES.some((c) => c.id === q)) {
    return q as CaseId
  }
  return DEFAULT_CASE_ID
}

/** case_id에 해당하는 데이터를 edges에 derived id 주입한 형태로 반환. */
export function getCaseData(caseId: CaseId): BakerStreetData {
  const raw = RAW_BY_CASE[caseId] as unknown as BakerStreetData
  const edgesWithId: Edge[] = raw.edges.map((e) => ({
    ...e,
    id: `${e.from}__${e.to}__${e.type}`,
  }))
  return {
    ...raw,
    edges: edgesWithId,
  }
}

/**
 * case 변경 — URL 갈아끼우고 reload. zustand persist의 state도 case별로 분리됨
 * (uiStore의 persist key를 case_id-aware로 짤 수 있지만 일단 reload로 충분).
 */
export function switchCase(caseId: CaseId): void {
  if (typeof window === 'undefined') return
  const url = new URL(window.location.href)
  url.searchParams.set('case', caseId)
  window.location.href = url.toString()
}

// ────────────────────────────────────────────────────────────────────────────
// 현재 case 데이터 — 기존 코드 (`import { bakerstreetData } from '../data'`)
// 가 그대로 동작하도록 default export 유지.
// ────────────────────────────────────────────────────────────────────────────

export const CURRENT_CASE_ID: CaseId = getCurrentCaseId()
export const bakerstreetData: BakerStreetData = getCaseData(CURRENT_CASE_ID)
