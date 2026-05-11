"""
Model registry — tracks trained models per tenant/SKU.
"""
import os
import json
import logging
from typing import Dict, List, Any
from datetime import datetime

logger = logging.getLogger(__name__)


class ModelRegistry:
    def __init__(self):
        self.model_dir = os.getenv("MODEL_DIR", "/tmp/models")
        self.registry_path = os.path.join(self.model_dir, "registry.json")
        self._registry: Dict[str, Any] = {}

    async def load_models(self):
        """Load registry from disk on startup."""
        os.makedirs(self.model_dir, exist_ok=True)
        if os.path.exists(self.registry_path):
            with open(self.registry_path, "r") as f:
                self._registry = json.load(f)
            logger.info(f"Loaded {len(self._registry)} models from registry")
        else:
            self._registry = {}
            logger.info("Empty model registry initialized")

    def _save(self):
        with open(self.registry_path, "w") as f:
            json.dump(self._registry, f, indent=2)

    def register(self, tenant_id: str, sku: str, model_type: str, mape: float):
        key = f"{tenant_id}:{sku}:{model_type}"
        self._registry[key] = {
            "tenant_id": tenant_id,
            "sku": sku,
            "model_type": model_type,
            "mape": mape,
            "trained_at": datetime.utcnow().isoformat(),
        }
        self._save()

    async def list_models(self, tenant_id: str) -> List[Dict]:
        return [v for k, v in self._registry.items() if v.get("tenant_id") == tenant_id]

    async def delete_model(self, tenant_id: str, sku: str):
        keys_to_delete = [k for k in self._registry if k.startswith(f"{tenant_id}:{sku}:")]
        for k in keys_to_delete:
            del self._registry[k]
        self._save()

        # Delete model files
        for model_type in ("prophet", "lstm"):
            path = os.path.join(self.model_dir, f"{model_type}_{tenant_id}_{sku}.pkl")
            if os.path.exists(path):
                os.remove(path)
