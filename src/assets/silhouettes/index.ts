// entity.id → silhouette URL 매핑.
// 12장의 mugshot을 15 entities에 결정론적으로 분배.
// 같은 entity는 매 실행마다 같은 실루엣.
//
// Vite의 import.meta.glob — 빌드 시점에 모든 매칭 파일을 자동 import.
// 개별 `import url01 from ...` 보다 안전 (한 장 누락 케이스 발생했음).
const modules = import.meta.glob('./silhouette_*.png', {
  eager: true,
  query: '?url',
  import: 'default',
}) as Record<string, string>

// path 정렬해서 silhouette_01, 02, ..., 12 순서 보장.
const SILHOUETTES: string[] = Object.keys(modules)
  .sort()
  .map((k) => modules[k])

// 매핑 테이블 — 부팅 시 한 번. entity.id 정렬 후 round-robin.
// 15 entities × 12 slots이라 앞쪽 12개는 1:1, 뒤 3개는 slot 01~03을 재사용.
import { bakerstreetData } from '../../data'

const ENTITY_TO_SILHOUETTE: Record<string, string> = (() => {
  const ids = bakerstreetData.entities
    .map((e) => e.id)
    .slice()
    .sort()
  const table: Record<string, string> = {}
  ids.forEach((id, i) => {
    table[id] = SILHOUETTES[i % SILHOUETTES.length]
  })
  return table
})()

export function silhouetteFor(entityId: string): string {
  return ENTITY_TO_SILHOUETTE[entityId] ?? SILHOUETTES[0]
}
