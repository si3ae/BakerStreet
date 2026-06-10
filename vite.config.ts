import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
//
// /api/* 요청을 백엔드(localhost:8000)로 우회.
// SSE는 keepalive 길어서 timeout 키움. proxy가 응답을 버퍼링하지 않도록.
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ws: false,
        // SSE 친화: response timeout 길게, 압축 해제 안 함
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            // 일부 환경에서 SSE 압축이 chunk 정렬을 깨므로 끔
            delete proxyRes.headers['content-encoding']
          })
        },
      },
    },
  },
})
