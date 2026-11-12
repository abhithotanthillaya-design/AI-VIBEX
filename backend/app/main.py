"""FastAPI application entry point for QUEUELESS."""

from collections.abc import AsyncIterator
from contextlib import asynccontextmanager
import sqlite3

from fastapi import FastAPI, HTTPException, Request, status
from fastapi.encoders import jsonable_encoder
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.config import get_settings
from app.database import init_db
from app.routes.demo import router as demo_router
from app.routes.health import router as health_router
from app.routes.kitchen import router as kitchen_router
from app.routes.manager import router as manager_router
from app.routes.menu import router as menu_router
from app.routes.orders import router as orders_router
from app.seed import seed_menu_items


@asynccontextmanager
async def lifespan(_app: FastAPI) -> AsyncIterator[None]:
    """Initialize database schema and seed default menu items on startup."""
    init_db()
    seed_menu_items()
    yield


def create_app() -> FastAPI:
    """Build and configure the FastAPI application instance."""
    settings = get_settings()
    application = FastAPI(
        title=settings.app_name,
        version="0.1.0",
        lifespan=lifespan,
    )

    application.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origin_list,
        allow_credentials=False,
        allow_methods=["GET", "POST", "PATCH", "PUT", "DELETE", "OPTIONS"],
        allow_headers=["*"],
    )

    @application.exception_handler(HTTPException)
    async def http_exception_handler(
        _request: Request, exc: HTTPException
    ) -> JSONResponse:
        if isinstance(exc.detail, dict):
            error_code = str(exc.detail.get("error", "request_error"))
            message = str(exc.detail.get("message", "Request could not be completed."))
        else:
            error_code = "request_error"
            message = str(exc.detail)
        return JSONResponse(
            status_code=exc.status_code,
            content={
                "error": error_code,
                "message": message,
            },
        )

    @application.exception_handler(RequestValidationError)
    async def validation_exception_handler(
        _request: Request, exc: RequestValidationError
    ) -> JSONResponse:
        safe_details = jsonable_encoder(exc.errors())
        first_msg = (
            str(safe_details[0].get("msg", "Invalid request payload or parameters."))
            if safe_details
            else "Invalid request payload or parameters."
        )
        return JSONResponse(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            content={
                "error": "validation_error",
                "message": first_msg,
                "details": safe_details,
            },
        )

    @application.exception_handler(sqlite3.Error)
    async def sqlite_exception_handler(
        _request: Request, _exc: sqlite3.Error
    ) -> JSONResponse:
        return JSONResponse(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            content={
                "error": "database_error",
                "message": "A database error occurred while processing the request.",
            },
        )

    application.include_router(health_router, prefix="/api")
    application.include_router(menu_router, prefix="/api")
    application.include_router(orders_router, prefix="/api")
    application.include_router(kitchen_router, prefix="/api")
    application.include_router(manager_router, prefix="/api")
    application.include_router(demo_router, prefix="/api")
    return application


app = create_app()

