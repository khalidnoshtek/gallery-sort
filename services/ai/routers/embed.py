"""
CLIP embeddings for images and text queries.

Phase 0: returns deterministic stub vectors so the Node side can wire up.
Phase 1: switch to open_clip ViT-B/32 inference.
"""
from __future__ import annotations

import hashlib
import struct
from typing import List

from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter()
DIM = 512
MODEL = "stub:ViT-B-32"


class EmbedItem(BaseModel):
    id: str
    imagePath: str


class EmbedRequest(BaseModel):
    items: List[EmbedItem]


class EmbedResult(BaseModel):
    id: str
    vector: List[float]


class EmbedResponse(BaseModel):
    model: str
    dim: int
    results: List[EmbedResult]


def _stub_vector(seed: str) -> List[float]:
    h = hashlib.sha256(seed.encode()).digest()
    out: List[float] = []
    i = 0
    while len(out) < DIM:
        chunk = h + struct.pack("I", i)
        h = hashlib.sha256(chunk).digest()
        for j in range(0, len(h), 4):
            if len(out) >= DIM:
                break
            (v,) = struct.unpack("f", h[j:j + 4])
            out.append(float(v))
        i += 1
    norm = sum(x * x for x in out) ** 0.5 or 1.0
    return [x / norm for x in out]


@router.post("", response_model=EmbedResponse)
def embed(req: EmbedRequest) -> EmbedResponse:
    return EmbedResponse(
        model=MODEL,
        dim=DIM,
        results=[EmbedResult(id=it.id, vector=_stub_vector(it.imagePath)) for it in req.items],
    )


class TextEmbedRequest(BaseModel):
    query: str


class TextEmbedResponse(BaseModel):
    model: str
    dim: int
    vector: List[float]


@router.post("/text", response_model=TextEmbedResponse)
def embed_text(req: TextEmbedRequest) -> TextEmbedResponse:
    return TextEmbedResponse(model=MODEL, dim=DIM, vector=_stub_vector("query:" + req.query))
