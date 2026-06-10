import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import travelingTypewriterUrl from './assets/fonts/TravelingTypewriter.ttf?url'

// ─────────────────────────────────────────────────────────────────────────
// 폰트 로딩 — Vite의 @font-face url 처리가 환경별로 들쭉날쭉해서
// 직접 FontFace API로 박음. 브라우저 콘솔에 결과 로그 → 디버깅 쉬움.
//
// 폰트 내부 family name이 'Traveling _Typewriter' (Traveling 뒤 공백+언더스코어).
// CSS도 정확히 그 이름으로 참조.
// ─────────────────────────────────────────────────────────────────────────
const tw = new FontFace(
  'Traveling _Typewriter',
  `url(${travelingTypewriterUrl}) format('truetype')`,
  { display: 'swap' }
)
tw.load()
  .then((loaded) => {
    document.fonts.add(loaded)
    console.log('[font] Traveling _Typewriter loaded')
  })
  .catch((err) => {
    console.warn('[font] Traveling _Typewriter failed to load:', err)
  })

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
