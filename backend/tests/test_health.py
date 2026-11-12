"""Foundation smoke tests for backend startup, DB initialization, and health API."""

from pathlib import Path
import tempfile

from fastapi.testclient import TestClient

from app.config import get_settings
from app.main import create_app


def test_health_endpoint_and_cors(monkeypatch) -> None:
    """Verify /api/health initializes SQLite, returns +05:30 timestamp, and allows frontend CORS."""
    with tempfile.TemporaryDirectory() as tmpdir:
        db_file = Path(tmpdir) / "test_queueless.db"
        monkeypatch.setenv("DATABASE_PATH", str(db_file))
        get_settings.cache_clear()

        app = create_app()
        with TestClient(app) as client:
            response = client.get(
                "/api/health",
                headers={"Origin": "http://localhost:5173"},
            )

        assert response.status_code == 200
        payload = response.json()
        assert payload["status"] == "ok"
        assert payload["database"] == "connected"
        assert payload["timestamp"].endswith("+05:30")
        assert response.headers.get("access-control-allow-origin") == "http://localhost:5173"
        assert db_file.exists()

        get_settings.cache_clear()
