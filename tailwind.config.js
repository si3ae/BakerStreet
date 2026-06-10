/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        // design.md Visual Identity
        paper: '#FDF5E6',      // background (Old Lace)
        flow: '#B22222',       // flow edges (red)
        ink: '#4A6FA5',        // shared_attribute edges
        demoted: '#9CA3AF',    // verification-failed (gray)
      },
      fontFamily: {
        // 'font-mono' 클래스 = 종이/잉크 영역 폰트 (Traveling Typewriter 우선).
        // ttf 안 박혀 있거나 로드 실패 시 Courier Prime/Special Elite로 fallback.
        mono: ['"Traveling _Typewriter"', '"Courier Prime"', '"Special Elite"', 'monospace'],
      },
    },
  },
  plugins: [],
}