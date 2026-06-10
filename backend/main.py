"""
BakerStreet — FastAPI 백엔드
================================
NVIDIA NIM의 Gemma 3 4B IT를 호출하고 응답을 SSE로 프론트에 스트리밍.

엔드포인트:
  POST /api/gemma/quip       — case 정보 + evidence 요약을 받아 한국어+영어 noir 톤
                              quip을 SSE 스트림으로 토큰 단위 응답.

로컬 dev:
  cd backend
  python -m venv .venv && source .venv/bin/activate   # (Windows: .venv\\Scripts\\activate)
  pip install -r requirements.txt
  cp .env.example .env       # 그 다음 .env 안에 NIM_API_KEY 넣기
  uvicorn main:app --reload --port 8000

Vite proxy가 /api → http://localhost:8000으로 우회시켜 줌. CORS 안전.
"""

import os
import json
import asyncio
from contextlib import asynccontextmanager
from typing import AsyncIterator, Optional

import httpx
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

# ─────────────────────────────────────────────────────────────────────────
# 설정
# ─────────────────────────────────────────────────────────────────────────

load_dotenv()  # backend/.env 로드

NIM_ENDPOINT = "https://integrate.api.nvidia.com/v1/chat/completions"
GEMMA_PRIMARY = "google/gemma-3-4b-it"
GEMMA_FALLBACK = "google/gemma-2-2b-it"

NIM_API_KEY: Optional[str] = os.getenv("NIM_API_KEY")
if not NIM_API_KEY:
    # 서버 시작 시 에러 내지 않고 경고만 — 개발 중 .env 없어도 import는 되게.
    # 실제 호출 시 401로 떨어짐.
    print("⚠ NIM_API_KEY missing — set it in backend/.env")

# httpx client는 앱 lifespan 단위로 재사용. NIM은 cold start가 길어 timeout 넉넉히.
TIMEOUT_S = 60.0

# ─────────────────────────────────────────────────────────────────────────
# httpx client lifecycle
# ─────────────────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(_app: FastAPI):
    timeout = httpx.Timeout(TIMEOUT_S, connect=10.0)
    async with httpx.AsyncClient(timeout=timeout) as client:
        _app.state.http = client
        yield


app = FastAPI(lifespan=lifespan)

# 개발용 CORS — Vite proxy 통해 들어오면 same-origin이라 사실 불필요하지만,
# proxy 없이 직접 호출하는 케이스(curl 등)도 허용.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173", "http://localhost:5174"],
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["*"],
)


# ─────────────────────────────────────────────────────────────────────────
# 요청 모델
# ─────────────────────────────────────────────────────────────────────────

class QuipRequest(BaseModel):
    """프론트의 caseInput + JSON에서 추출한 evidence 요약."""
    case_id: str = Field(..., description="사용자가 briefing에서 입력한 case ID")
    subject: str = Field(..., description="조사 대상 설명")
    date_from: str = Field(...)
    date_to: str = Field(...)
    # 보드의 현재 상황을 prompt에 박을 짧은 요약.
    # ex: '15 entities, 8 jurisdictions, 16 evidence links, 8 demoted, pattern: cycle + hub'
    evidence_summary: str = Field(...)
    # 선택: 시퀀스의 핵심 demoted 로그 한두 줄 — 모델이 구체적 근거 인용할 수 있게.
    key_findings: list[str] = Field(default_factory=list)


# ─────────────────────────────────────────────────────────────────────────
# Prompt 설계
# ─────────────────────────────────────────────────────────────────────────

SYSTEM_PROMPT = """당신은 셸컴퍼니(shell company) 금융 사기 수사를 돕는 AI 수사관 'Sherlock'입니다.
출력 톤: 셜록 홈즈 풍의 noir, 한국어가 주이고 핵심 술어/고유명사는 영어 원문 유지.

원칙:
- 단정하지 말 것. "~로 보입니다", "정황상 ~의심됩니다" 같은 추론 어조.
- 한국어 + 일부 영어 단어(entities, jurisdiction, pattern 같은 분석 용어).
- 셜록 톤이지만 과장된 캐릭터 흉내 금지. 차분하고 건조한 관찰자.
- 출력은 한 줄 ~ 두 줄. 명확하고 짧게.

예시 톤:
  "BVI와 Cayman을 오가는 흐름이 한 명의 registered agent로 수렴하는군요. 우연이라기엔 너무 깔끔합니다."
"""


def build_user_prompt(req: QuipRequest) -> str:
    findings = "\n".join(f"- {x}" for x in req.key_findings) if req.key_findings else "(없음)"
    return f"""사건 정보:
- Case ID: {req.case_id}
- Subject: {req.subject}
- 기간: {req.date_from} ~ {req.date_to}

증거 요약:
{req.evidence_summary}

핵심 단서 (검증 실패 케이스):
{findings}

위 정보를 바탕으로 사건의 패턴에 대한 한 줄 관찰을 noir 톤으로 출력하세요.
"""


# ─────────────────────────────────────────────────────────────────────────
# NIM streaming 호출
# ─────────────────────────────────────────────────────────────────────────

async def stream_nim(model: str, messages: list[dict]) -> AsyncIterator[str]:
    """NIM streaming → 토큰 단위로 yield. SSE 라인 파싱.

    NIM은 OpenAI 호환 SSE: 각 라인이 `data: {json}` 또는 `data: [DONE]`.
    json의 choices[0].delta.content가 토큰.
    """
    if not NIM_API_KEY:
        raise HTTPException(500, "NIM_API_KEY not configured")

    payload = {
        "model": model,
        "messages": messages,
        "max_tokens": 400,
        "temperature": 0.7,
        "top_p": 0.9,
        "stream": True,
    }
    headers = {
        "Authorization": f"Bearer {NIM_API_KEY}",
        "Accept": "text/event-stream",
        "Content-Type": "application/json",
    }

    client: httpx.AsyncClient = app.state.http
    async with client.stream("POST", NIM_ENDPOINT, json=payload, headers=headers) as r:
        if r.status_code != 200:
            body = await r.aread()
            raise HTTPException(r.status_code, f"NIM error: {body.decode(errors='replace')}")

        async for line in r.aiter_lines():
            if not line or not line.startswith("data:"):
                continue
            data = line[5:].strip()
            if data == "[DONE]":
                return
            try:
                obj = json.loads(data)
                delta = obj["choices"][0]["delta"].get("content", "")
                if delta:
                    yield delta
            except (json.JSONDecodeError, KeyError, IndexError):
                # 잘못된 라인은 무시 — keepalive 등.
                continue


# ─────────────────────────────────────────────────────────────────────────
# 엔드포인트
# ─────────────────────────────────────────────────────────────────────────

async def quip_event_stream(req: QuipRequest) -> AsyncIterator[bytes]:
    """프론트로 보낼 SSE 이벤트.

    프로토콜 (커스텀, OpenAI 호환은 아님 — 프론트가 단순화하기 위함):
      data: {"type": "token", "text": "..."}\\n\\n
      data: {"type": "done"}\\n\\n
      data: {"type": "error", "message": "..."}\\n\\n

    Gemma는 OpenAI API에서 `system` role을 거부 (System role not supported).
    그래서 system instruction을 user 메시지 앞에 prepend로 합침.
    """
    combined_prompt = SYSTEM_PROMPT + "\n\n---\n\n" + build_user_prompt(req)
    messages = [
        {"role": "user", "content": combined_prompt},
    ]

    async def send(obj: dict) -> bytes:
        return f"data: {json.dumps(obj, ensure_ascii=False)}\n\n".encode()

    try:
        try:
            async for token in stream_nim(GEMMA_PRIMARY, messages):
                yield await send({"type": "token", "text": token})
        except (httpx.TimeoutException, httpx.HTTPError, HTTPException) as primary_err:
            # primary 실패 시 fallback 모델로 한 번 더.
            print(f"primary failed: {primary_err!r} — trying fallback")
            try:
                async for token in stream_nim(GEMMA_FALLBACK, messages):
                    yield await send({"type": "token", "text": token})
            except Exception as fallback_err:
                yield await send({"type": "error", "message": f"both NIM calls failed: {fallback_err!r}"})
                return
        yield await send({"type": "done"})
    except asyncio.CancelledError:
        # 클라이언트 disconnect — 조용히 종료.
        raise
    except Exception as e:
        yield await send({"type": "error", "message": repr(e)})


@app.post("/api/gemma/quip")
async def quip(req: QuipRequest):
    return StreamingResponse(
        quip_event_stream(req),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",      # nginx/proxy 버퍼링 끄기
        },
    )


@app.get("/api/health")
async def health():
    return {
        "ok": True,
        "nim_key_configured": bool(NIM_API_KEY),
        "primary_model": GEMMA_PRIMARY,
        "fallback_model": GEMMA_FALLBACK,
    }
