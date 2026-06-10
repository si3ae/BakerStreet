import type { Entity } from '../types/bakerstreet'

// ─────────────────────────────────────────────────────────────────────────
// design v8 (수사 보드 컨셉): 카드는 코르크보드에 핀으로 꽂힌 종이 조각.
// scatter layout — 결정론적 grid + jitter + 미세 회전.
// force / column 모두 폐기. 발표용 reproducibility + 일관된 미적 톤 우선.
// ─────────────────────────────────────────────────────────────────────────

// viewBox — 와이드 발표 화면. 카드 240×300 × 6×3 grid + 핸드폰만한 jitter 여유.
export const VIEW_W = 1700
export const VIEW_H = 1100

// 등록증 명함 비율. 세로로 약간 김 → mugshot + 라벨 위아래 배치.
export const CARD_W = 240
export const CARD_H = 300

// 카드 안 실루엣 슬롯 (정사각, 카드 가운데에 배치).
export const SLOT_SIZE = 140

// edge 좌표 계산용 — 카드 회전이 있어도 center는 회전 중심과 같으므로
// rotation을 따로 받지 않아도 정확.
export const cardCenter = (x: number, y: number) => ({
  cx: x + CARD_W / 2,
  cy: y + CARD_H / 2,
})

// ─────────────────────────────────────────────────────────────────────────
// 결정론적 PRNG — 같은 seed로 항상 같은 모양.
// ─────────────────────────────────────────────────────────────────────────
function makeSeededRandom(seed: number): () => number {
  let s = seed >>> 0
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = s
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export interface Placement {
  x: number              // 카드 좌상단 (회전 전 기준)
  y: number
  rotation: number       // 도. -5 ~ +5
}

// ─────────────────────────────────────────────────────────────────────────
// scatter layout —
//   - 4×4 grid 점을 만든 뒤 (16개 슬롯 ≥ 15 entities), 셔플해서 카드 할당.
//   - 각 셀 중앙에서 jitter ±(셀 폭의 18%) 만큼 흔들기.
//   - rotation은 cell당 -5 ~ +5도 균등 분포.
// ─────────────────────────────────────────────────────────────────────────
export function computeScatterLayout(
  entities: Entity[]
): Record<string, Placement> {
  const rand = makeSeededRandom(20260515)

  const COLS = 5
  const ROWS = 3
  const totalCells = COLS * ROWS

  // 보드 가장자리 여백. 카드 회전 + tag slot까지 고려해 넉넉히.
  const marginX = 100
  const marginY = 100

  const cellW = (VIEW_W - marginX * 2) / COLS
  const cellH = (VIEW_H - marginY * 2) / ROWS

  // 카드 회전 시 외접 박스가 늘어남. 안전한 jitter.
  const jitterX = cellW * 0.12
  const jitterY = cellH * 0.12

  // 셀 인덱스 셔플 — 결정론적. Fisher-Yates with seeded rand.
  const cellOrder = Array.from({ length: totalCells }, (_, i) => i)
  for (let i = cellOrder.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1))
    ;[cellOrder[i], cellOrder[j]] = [cellOrder[j], cellOrder[i]]
  }

  const placements: Record<string, Placement> = {}
  entities.forEach((entity, idx) => {
    const cellIdx = cellOrder[idx % totalCells]
    const c = cellIdx % COLS
    const r = Math.floor(cellIdx / COLS)

    // 셀 중심 좌표
    const cellCx = marginX + cellW * (c + 0.5)
    const cellCy = marginY + cellH * (r + 0.5)

    // jitter
    const jx = (rand() - 0.5) * 2 * jitterX
    const jy = (rand() - 0.5) * 2 * jitterY

    // 카드 좌상단 = (중심 + jitter) - (카드 절반)
    const x = cellCx + jx - CARD_W / 2
    const y = cellCy + jy - CARD_H / 2

    // rotation -5 ~ +5도
    const rotation = (rand() - 0.5) * 10

    placements[entity.id] = { x, y, rotation }
  })

  return placements
}
