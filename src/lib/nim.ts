// ─────────────────────────────────────────────────────────────────────────
// NIM client — /api/gemma/quip 호출 + SSE 파싱.
//
// 백엔드 프로토콜 (backend/main.py와 동일):
//   data: {"type": "token", "text": "..."}
//   data: {"type": "done"}
//   data: {"type": "error", "message": "..."}
//
// AsyncGenerator로 토큰을 yield. 끝나면 자연 종료. error 이벤트는 throw.
// ─────────────────────────────────────────────────────────────────────────

export interface QuipInput {
  case_id: string
  subject: string
  date_from: string
  date_to: string
  evidence_summary: string
  key_findings: string[]
}

interface SSEToken { type: 'token'; text: string }
interface SSEDone { type: 'done' }
interface SSEError { type: 'error'; message: string }
type SSEEvent = SSEToken | SSEDone | SSEError

/** /api/gemma/quip 호출. AsyncGenerator로 토큰 yield. */
export async function* fetchGemmaQuip(
  input: QuipInput,
  signal?: AbortSignal,
): AsyncGenerator<string, void, void> {
  const res = await fetch('/api/gemma/quip', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
    signal,
  })
  if (!res.ok || !res.body) {
    throw new Error(`HTTP ${res.status}`)
  }

  const reader = res.body.getReader()
  const decoder = new TextDecoder('utf-8')
  let buffer = ''

  try {
    while (true) {
      const { value, done } = await reader.read()
      if (done) break
      buffer += decoder.decode(value, { stream: true })

      // SSE 이벤트 구분자는 빈 줄 (\n\n). 그 단위로 처리.
      let sepIdx: number
      while ((sepIdx = buffer.indexOf('\n\n')) !== -1) {
        const chunk = buffer.slice(0, sepIdx)
        buffer = buffer.slice(sepIdx + 2)

        // 각 chunk 안에 `data: {...}` 한 줄 (또는 여러 줄). 단순화 — 한 줄만 가정.
        const line = chunk.split('\n').find((l) => l.startsWith('data:'))
        if (!line) continue
        const json = line.slice(5).trim()
        if (!json) continue

        let ev: SSEEvent
        try {
          ev = JSON.parse(json) as SSEEvent
        } catch {
          continue          // 깨진 chunk 무시
        }

        if (ev.type === 'token') {
          yield ev.text
        } else if (ev.type === 'done') {
          return
        } else if (ev.type === 'error') {
          throw new Error(ev.message)
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
