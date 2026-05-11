"""
Amdox ERP ML Service - FastAPI
Provides Prophet + LSTM demand forecasting endpoints
"""
from fastapi import FastAPI, HTTPException, BackgroundTasks, Depends
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import os
import logging
from datetime import datetime

from routers import forecast, health
from services.model_registry import ModelRegistry

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

app = FastAPI(
    title="Amdox ERP ML Service",
    description="Demand forecasting API using Prophet + LSTM",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("ALLOWED_ORIGINS", "*").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include routers
app.include_router(health.router, prefix="", tags=["Health"])
app.include_router(forecast.router, prefix="/api/v1/forecast", tags=["Forecasting"])


@app.on_event("startup")
async def startup_event():
    logger.info("ML Service starting up...")
    registry = ModelRegistry()
    await registry.load_models()
    logger.info("Model registry initialized")


@app.on_event("shutdown")
async def shutdown_event():
    logger.info("ML Service shutting down...")
