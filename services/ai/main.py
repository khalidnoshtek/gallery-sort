"""
Gallery Sort — local AI sidecar.

FastAPI app, bound to 127.0.0.1 only. Authenticated with a shared
per-machine token stored at ~/.gallery-sort/sidecar.token.

This file is the skeleton. Real model loading + inference land in Phase 1
(see ROADMAP.md). The endpoints exist now so the Node side can wire up
without errors; they return deterministic stubs when no model is loaded.
"""
from __future__ import annotations

import os
import pathlib
from typing import Optional, List

from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel

from routers import classify as classify_mod
from routers import embed as embed_mod
from routers import ocr as ocr_mod
from routers import quality as quality_mod


TOKEN_FILE = pathlib.Path.home() / ".gallery-sort" / "sidecar.token"


def load_token() -> str:
    if os.environ.get("AI_SIDECAR_TOKEN"):
        return os.environ["AI_SIDECAR_TOKEN"]
    if TOKEN_FILE.exists():
        return TOKEN_FILE.read_text().strip()
    raise RuntimeError(
        f"No sidecar token found. Expected env AI_SIDECAR_TOKEN or {TOKEN_FILE}. "
        "Start the Node side first; it will create the token."
    )


TOKEN = load_token()


app = FastAPI(title="Gallery Sort AI Sidecar", version="0.1.0")


def auth(authorization: Optional[str]) -> None:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="missing bearer token")
    if authorization.removeprefix("Bearer ").strip() != TOKEN:
        raise HTTPException(status_code=401, detail="bad token")


ALLOW_NON_LOOPBACK = os.environ.get("ALLOW_NON_LOOPBACK") == "1"


@app.middleware("http")
async def guard_loopback(request: Request, call_next):
    if ALLOW_NON_LOOPBACK:
        return await call_next(request)
    client = request.client.host if request.client else ""
    if client not in ("127.0.0.1", "::1", "localhost"):
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": "loopback only"}, status_code=403)
    return await call_next(request)


class HealthResponse(BaseModel):
    ok: bool
    models: List[str]
    busy: bool


@app.get("/health", response_model=HealthResponse)
def health():
    return HealthResponse(ok=True, models=["stub:classify", "stub:embed", "stub:ocr", "stub:quality"], busy=False)


app.include_router(classify_mod.router, prefix="/classify", tags=["classify"])
app.include_router(embed_mod.router, prefix="/embed", tags=["embed"])
app.include_router(ocr_mod.router, prefix="/ocr", tags=["ocr"])
app.include_router(quality_mod.router, prefix="/quality", tags=["quality"])


@app.middleware("http")
async def auth_middleware(request: Request, call_next):
    if request.url.path in ("/health", "/docs", "/openapi.json"):
        return await call_next(request)
    try:
        auth(request.headers.get("authorization"))
    except HTTPException as e:
        from fastapi.responses import JSONResponse
        return JSONResponse({"detail": e.detail}, status_code=e.status_code)
    return await call_next(request)


if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=7860, reload=False)
