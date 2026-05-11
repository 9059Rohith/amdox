"""
Forecast router — Prophet + LSTM demand forecasting endpoints
Target: MAPE < 12% on 90-day horizon
"""
from fastapi import APIRouter, HTTPException, BackgroundTasks
from pydantic import BaseModel
from typing import List, Optional, Dict, Any
from datetime import datetime, date
import logging

from services.prophet_model import ProphetForecastService
from services.lstm_model import LSTMForecastService
from services.model_registry import ModelRegistry

logger = logging.getLogger(__name__)
router = APIRouter()

prophet_service = ProphetForecastService()
lstm_service = LSTMForecastService()
model_registry = ModelRegistry()


class TrainingDataPoint(BaseModel):
    ds: date
    y: float
    sku: str
    tenant_id: str


class TrainRequest(BaseModel):
    tenant_id: str
    sku: str
    history: List[TrainingDataPoint]
    model_type: str = "prophet"  # "prophet" | "lstm" | "both"


class PredictRequest(BaseModel):
    tenant_id: str
    sku: str
    horizon_days: int = 90
    model_type: str = "prophet"


class ForecastPoint(BaseModel):
    ds: str
    yhat: float
    yhat_lower: float
    yhat_upper: float


class PredictResponse(BaseModel):
    tenant_id: str
    sku: str
    model_type: str
    horizon_days: int
    mape: Optional[float]
    forecasts: List[ForecastPoint]
    generated_at: str


@router.post("/train")
async def train_model(request: TrainRequest, background_tasks: BackgroundTasks):
    """
    Train Prophet (primary) or LSTM (secondary for high-volume SKUs).
    Training is async — returns job_id immediately.
    """
    if len(request.history) < 30:
        raise HTTPException(status_code=422, detail="Minimum 30 data points required for training")

    job_id = f"{request.tenant_id}:{request.sku}:{datetime.utcnow().timestamp()}"

    if request.model_type in ("prophet", "both"):
        background_tasks.add_task(
            prophet_service.train,
            tenant_id=request.tenant_id,
            sku=request.sku,
            history=[(str(p.ds), p.y) for p in request.history],
        )

    if request.model_type in ("lstm", "both"):
        background_tasks.add_task(
            lstm_service.train,
            tenant_id=request.tenant_id,
            sku=request.sku,
            history=[p.y for p in request.history],
        )

    return {
        "job_id": job_id,
        "status": "training_queued",
        "model_type": request.model_type,
        "data_points": len(request.history),
    }


@router.post("/predict", response_model=PredictResponse)
async def predict(request: PredictRequest):
    """
    Generate SKU-level demand forecast.
    Uses Prophet by default; LSTM for high-volume SKUs.
    Target MAPE < 12% on 90-day horizon.
    """
    try:
        if request.model_type == "lstm":
            result = await lstm_service.predict(
                tenant_id=request.tenant_id,
                sku=request.sku,
                horizon_days=request.horizon_days,
            )
        else:
            result = await prophet_service.predict(
                tenant_id=request.tenant_id,
                sku=request.sku,
                horizon_days=request.horizon_days,
            )

        return PredictResponse(
            tenant_id=request.tenant_id,
            sku=request.sku,
            model_type=request.model_type,
            horizon_days=request.horizon_days,
            mape=result.get("mape"),
            forecasts=result.get("forecasts", []),
            generated_at=datetime.utcnow().isoformat(),
        )
    except KeyError:
        raise HTTPException(status_code=404, detail=f"No trained model found for SKU {request.sku}")
    except Exception as e:
        logger.error(f"Prediction error for {request.sku}: {e}")
        raise HTTPException(status_code=500, detail=str(e))


@router.get("/models")
async def list_models(tenant_id: str):
    """List all trained models for a tenant."""
    return await model_registry.list_models(tenant_id)


@router.delete("/models/{sku}")
async def delete_model(tenant_id: str, sku: str):
    """Delete a trained model."""
    await model_registry.delete_model(tenant_id, sku)
    return {"status": "deleted", "sku": sku}
