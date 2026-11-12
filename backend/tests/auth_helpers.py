"""Reusable test helpers for provisioning authenticated Student, Staff, and Manager clients."""

from fastapi import FastAPI
from fastapi.testclient import TestClient

from app.auth_service import bootstrap_manager_account
from app.config import get_settings
from app.security import LOGIN_RATE_LIMITER


def create_student_client(
    app: FastAPI,
    *,
    email: str = "student@campus.edu",
    full_name: str = "Demo Student",
    password: str = "StudentPass123",
    student_roll_no: str | None = "CS2026-01",
) -> TestClient:
    """Register and return an authenticated STUDENT TestClient with CSRF header set."""
    client = TestClient(app)
    res = client.post(
        "/api/auth/register",
        json={
            "full_name": full_name,
            "email": email,
            "password": password,
            "confirm_password": password,
            "student_roll_no": student_roll_no,
        },
    )
    assert res.status_code == 201, res.text
    csrf_token = res.json()["csrf_token"]
    client.headers.update({"X-CSRF-Token": csrf_token})
    return client


def create_manager_client(
    app: FastAPI,
    *,
    email: str = "manager@campus.edu",
    full_name: str = "Canteen Manager",
    password: str = "ManagerPass123",
    allow_additional: bool = True,
    base_url: str = "http://testserver",
) -> TestClient:
    """Bootstrap a MANAGER account via server service and sign in cleanly."""
    LOGIN_RATE_LIMITER.clear_all()
    bootstrap_manager_account(
        full_name=full_name,
        email=email,
        password=password,
        settings=get_settings(),
        allow_additional=allow_additional,
    )
    client = TestClient(app, base_url=base_url)
    res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    csrf_token = res.json()["csrf_token"]
    client.headers.update({"X-CSRF-Token": csrf_token})
    return client


def create_staff_client(
    app: FastAPI,
    manager_client: TestClient,
    *,
    email: str = "staff@campus.edu",
    full_name: str = "Kitchen Staff",
    password: str = "StaffPass123",
) -> TestClient:
    """Provision a CANTEEN_STAFF account via authenticated manager and sign in."""
    LOGIN_RATE_LIMITER.clear_all()
    created = manager_client.post(
        "/api/manager/staff",
        json={
            "full_name": full_name,
            "email": email,
            "password": password,
            "role": "CANTEEN_STAFF",
        },
    )
    assert created.status_code == 201, created.text
    client = TestClient(app)
    res = client.post(
        "/api/auth/login",
        json={"email": email, "password": password},
    )
    assert res.status_code == 200, res.text
    csrf_token = res.json()["csrf_token"]
    client.headers.update({"X-CSRF-Token": csrf_token})
    return client
