# ADR-005: Prophet + LSTM Dual-Model for Demand Forecasting

**Date:** 2026-04-03  
**Status:** Accepted  
**Deciders:** ML Lead, Backend Lead

## Context

Demand forecasting for SKU-level inventory requires a model that can:
- Handle 90-day forecast horizons with MAPE < 12%
- Support trend + seasonality (weekly, yearly)
- Scale to hundreds of SKUs per tenant
- Retrain weekly without manual intervention

Alternatives:

| Model | MAPE (typical) | Training time | Interpretability | Seasonality |
|-------|---------------|---------------|-----------------|-------------|
| **Prophet** | 8-14% | Minutes | High | Excellent |
| **LSTM (PyTorch)** | 6-11% | Minutes-hours | Low | Good |
| **ARIMA** | 12-20% | Minutes | Medium | Manual |
| **XGBoost** | 9-16% | Fast | Medium | Poor |
| **Naive seasonal** | 18-30% | Instant | Perfect | Static |

## Decision

We adopt a **dual-model strategy**:

1. **Prophet** (Meta) as the **primary model** for all SKUs. Rationale:
   - Automatic trend + seasonality detection (weekly, yearly)
   - Handles missing data and outliers gracefully
   - Human-interpretable components (useful for business sign-off)
   - Achieves target MAPE < 12% on 90-day horizon with default tuning

2. **LSTM (PyTorch)** as the **secondary model** for high-volume SKUs (> 365 data points). Rationale:
   - Captures complex non-linear demand patterns
   - Better performance on high-volume SKUs where data is abundant
   - 30-day sliding window with 50 epochs is fast enough for weekly retraining

**Model selection logic:**
```python
if len(history) >= 365 and is_high_volume(sku):
    use LSTM
else:
    use Prophet
```

**Retraining:** BullMQ cron every Sunday 02:00 UTC. New model replaces old only if new MAPE < old MAPE + 1% (anti-regression guard).

**Separate service:** ML logic runs as an independent FastAPI service (`apps/ml-service`) to isolate Python/PyTorch dependencies from the Node.js API. NestJS consumes it via internal HTTP, caching predictions in Redis (TTL 24h).

## Consequences

**Positive:**
- MAPE < 12% target is achievable with Prophet on most SKUs.
- LSTM provides uplift for data-rich, high-volume SKUs.
- Independent deployability — ML service can be scaled/updated independently.
- Redis caching means prediction latency for end users is < 10ms.

**Negative:**
- Two runtime environments (Python + Node.js) increase operational complexity.
- LSTM requires > 365 days of data to outperform Prophet.
- Model versioning and rollback must be managed via the model registry.

## References

- Prophet paper: https://peerj.com/preprints/3190/
- PyTorch LSTM: https://pytorch.org/tutorials/beginner/nlp/sequence_models_tutorial.html
- MAPE target rationale: based on industry benchmarks for 90-day horizon (Makridakis M4 Competition)
