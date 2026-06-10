// 화면 하단 워터마크 — 항상 가장 뒤. 발표 중 화면 분위기 잡기용.
//
// 가독성보단 분위기. opacity 매우 낮게, letter-spacing 크게.

export function FooterWatermark() {
  return (
    <div
      style={{
        position: 'absolute',
        bottom: -8,
        left: 0,
        right: 0,
        textAlign: 'center',
        fontFamily: "'Traveling _Typewriter', 'Courier Prime', monospace",
        fontSize: 140,
        fontWeight: 900,
        letterSpacing: '0.35em',
        color: '#000000',
        opacity: 0.04,
        pointerEvents: 'none',
        zIndex: 0,
        userSelect: 'none',
        whiteSpace: 'nowrap',
        overflow: 'hidden',
      }}
    >
      BAKERSTREET
    </div>
  )
}
