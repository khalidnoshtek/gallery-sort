"""
OCR via Tesseract.

Phase 0: returns empty text. Phase 1: pytesseract + image preprocessing
(deskew, threshold) for receipts and documents.
"""
from __future__ import annotations

from typing import List, Optional

from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter()


class OcrItem(BaseModel):
    id: str
    imagePath: str


class OcrRequest(BaseModel):
    items: List[OcrItem]
    language: Optional[str] = "eng"


class OcrResult(BaseModel):
    id: str
    text: str
    language: Optional[str]
    chars: int


class OcrResponse(BaseModel):
    results: List[OcrResult]


@router.post("", response_model=OcrResponse)
def ocr(req: OcrRequest) -> OcrResponse:
    return OcrResponse(
        results=[OcrResult(id=it.id, text="", language=req.language, chars=0) for it in req.items]
    )
