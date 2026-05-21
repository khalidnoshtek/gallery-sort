"""
Image quality scoring: blur (variance of Laplacian), exposure (histogram).

Phase 0: stub returns mid-range scores. Phase 1: opencv-based detection.
"""
from __future__ import annotations

from typing import List

from fastapi import APIRouter
from pydantic import BaseModel


router = APIRouter()


class QualityItem(BaseModel):
    id: str
    imagePath: str


class QualityRequest(BaseModel):
    items: List[QualityItem]


class QualityResult(BaseModel):
    id: str
    blurScore: float
    exposureScore: float
    brightness: float
    isBlurry: bool
    isDark: bool
    isOverexposed: bool


class QualityResponse(BaseModel):
    results: List[QualityResult]


@router.post("", response_model=QualityResponse)
def quality(req: QualityRequest) -> QualityResponse:
    return QualityResponse(
        results=[
            QualityResult(
                id=it.id,
                blurScore=100.0,
                exposureScore=0.5,
                brightness=0.5,
                isBlurry=False,
                isDark=False,
                isOverexposed=False,
            )
            for it in req.items
        ]
    )
