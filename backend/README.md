# BakerStreet Backend

NVIDIA NIM의 Gemma 3 4B IT를 호출해서 사건 분석 quip을 SSE 스트리밍으로 프론트에 흘리는 FastAPI 백엔드.

## 설치 & 실행

```bash
cd backend

# 가상환경
python -m venv .venv
# macOS / Linux:
source .venv/bin/activate
# Windows (PowerShell):
.venv\Scripts\Activate.ps1
# Windows (cmd):
.venv\Scripts\activate.bat

# 의존성
pip install -r requirements.txt

# .env 생성 (NIM_API_KEY 채우기)
cp .env.example .env
# 그 다음 에디터로 열어서 nvapi-xxx 키 박기

# 서버 실행
uvicorn main:app --reload --port 8000
```

`http://localhost:8000/api/health` 열어 `{"ok": true, "nim_key_configured": true}` 나오면 정상.

## 프론트 연결

Vite dev 서버 (`npm run dev`)가 `/api/*`를 백엔드로 자동 우회. 별도 설정 X.

## 엔드포인트

### `POST /api/gemma/quip`

요청:
```json
{
  "case_id": "BS-2026-0512-A",
  "subject": "shell company cluster",
  "date_from": "2024-01-01",
  "date_to": "2024-12-31",
  "evidence_summary": "15 entities, 8 jurisdictions, ...",
  "key_findings": ["FLOW_DIRECTION_MISMATCH: ..."]
}
```

응답 (SSE, `text/event-stream`):
```
data: {"type": "token", "text": "흠"}

data: {"type": "token", "text": "..."}

data: {"type": "done"}
```

실패 시:
```
data: {"type": "error", "message": "..."}
```

primary 모델(`google/gemma-3-4b-it`) 실패 시 자동으로 `google/gemma-2-2b-it` fallback 시도.
