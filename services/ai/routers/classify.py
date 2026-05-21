"""
CLIP zero-shot classification.

Phase 0: returns deterministic stubs based on filename hints. Lets the Node
side wire up; real CLIP inference lands in Phase 1.

Phase 1 plan:
  - Load open_clip ViT-B/32 (laion2b_s34b_b79k) once at startup.
  - Pre-encode the curated label set.
  - Per request: load thumbnails, encode, cosine vs label embeddings, top-k.
  - Map top label -> MediaCategory + MediaIntent via LABEL_MAP.
"""
from __future__ import annotations

import os
from typing import List, Literal, Optional

from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter()


class ClassifyItem(BaseModel):
    id: str
    imagePath: str


class ClassifyRequest(BaseModel):
    items: List[ClassifyItem]
    labelSet: Optional[str] = None


class Tag(BaseModel):
    label: str
    score: float


class ClassifyResult(BaseModel):
    id: str
    topLabel: str
    topScore: float
    tags: List[Tag]
    category: str
    intent: Literal["KEEP_LONG_TERM", "EPHEMERAL", "UNKNOWN"]


class ClassifyResponse(BaseModel):
    results: List[ClassifyResult]


LABEL_SETS = {
    "default": [
        "a photo of people",
        "a landscape photo",
        "a photo of food",
        "a photo of a pet or animal",
        "a screenshot of a chat message",
        "a screenshot of a webpage",
        "a screenshot of a QR code",
        "a photo of a receipt or invoice",
        "a photo of a parking lot ticket",
        "a photo of a whiteboard with handwriting",
        "a photo of an ID card or document",
        "a meme image",
        "a photo of a product on a shelf",
        "a wedding photo",
        "a selfie",
    ],
}


# Maps a top label to (MediaCategory, MediaIntent). These mirror the Prisma
# enums in the Node side; keep in sync if either changes.
LABEL_MAP = {
    "a photo of people": ("PHOTO", "KEEP_LONG_TERM"),
    "a landscape photo": ("PHOTO", "KEEP_LONG_TERM"),
    "a photo of food": ("PHOTO", "UNKNOWN"),
    "a photo of a pet or animal": ("PHOTO", "KEEP_LONG_TERM"),
    "a screenshot of a chat message": ("SCREENSHOT", "EPHEMERAL"),
    "a screenshot of a webpage": ("SCREENSHOT", "EPHEMERAL"),
    "a screenshot of a QR code": ("TRANSACTIONAL", "EPHEMERAL"),
    "a photo of a receipt or invoice": ("RECEIPT", "EPHEMERAL"),
    "a photo of a parking lot ticket": ("TRANSACTIONAL", "EPHEMERAL"),
    "a photo of a whiteboard with handwriting": ("TRANSACTIONAL", "EPHEMERAL"),
    "a photo of an ID card or document": ("DOCUMENT", "EPHEMERAL"),
    "a meme image": ("MEME", "EPHEMERAL"),
    "a photo of a product on a shelf": ("TRANSACTIONAL", "EPHEMERAL"),
    "a wedding photo": ("PHOTO", "KEEP_LONG_TERM"),
    "a selfie": ("SELFIE", "UNKNOWN"),
}


@router.post("", response_model=ClassifyResponse)
def classify(req: ClassifyRequest) -> ClassifyResponse:
    results: List[ClassifyResult] = []
    for item in req.items:
        name = os.path.basename(item.imagePath).lower()
        if "screenshot" in name:
            top = "a screenshot of a chat message"
        elif "receipt" in name or "invoice" in name:
            top = "a photo of a receipt or invoice"
        elif "whatsapp" in item.imagePath.lower():
            top = "a screenshot of a chat message"
        else:
            top = "a photo of people"
        cat, intent = LABEL_MAP[top]
        results.append(
            ClassifyResult(
                id=item.id,
                topLabel=top,
                topScore=0.42,
                tags=[Tag(label=top, score=0.42)],
                category=cat,
                intent=intent,
            )
        )
    return ClassifyResponse(results=results)
