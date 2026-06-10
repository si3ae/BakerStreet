import { setNodePlacements, useGraphStore } from '../store/graphStore'
import { computeScatterLayout } from './layout'

// 앱 부팅 시 한 번 — 보드 위에 카드를 흩뿌림 + 회전 부여.
// design v8 (수사 보드 컨셉): 핀으로 꽂힌 종이 조각 같은 무질서한 배치.
export function initLayout() {
  const { nodes } = useGraphStore.getState()
  const placements = computeScatterLayout(nodes)
  setNodePlacements(placements)
}
