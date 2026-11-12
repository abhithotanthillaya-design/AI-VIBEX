"""One-time CLI utility to provision the initial QUEUELESS Manager account securely.

Never hardcode credentials in source files. Supply via command flags, interactive prompt,
or temporary environment variables (BOOTSTRAP_MANAGER_NAME / BOOTSTRAP_MANAGER_EMAIL / BOOTSTRAP_MANAGER_PASSWORD).
"""

import argparse
import getpass
import os
import sys

from app.auth_service import AuthError, bootstrap_manager_account
from app.config import get_settings
from app.database import init_db


def main() -> int:
    parser = argparse.ArgumentParser(
        description="Provision the initial QUEUELESS Manager account in SQLite.",
    )
    parser.add_argument(
        "--full-name",
        default=os.environ.get("BOOTSTRAP_MANAGER_NAME", ""),
        help="Manager full name (or set BOOTSTRAP_MANAGER_NAME)",
    )
    parser.add_argument(
        "--email",
        default=os.environ.get("BOOTSTRAP_MANAGER_EMAIL", ""),
        help="Manager email address (or set BOOTSTRAP_MANAGER_EMAIL)",
    )
    parser.add_argument(
        "--password",
        default=os.environ.get("BOOTSTRAP_MANAGER_PASSWORD", ""),
        help="Manager password (omit to enter interactively via hidden prompt)",
    )
    parser.add_argument(
        "--allow-additional",
        action="store_true",
        help="Explicitly allow creating another Manager even if one already exists",
    )

    args = parser.parse_args()
    full_name = args.full_name.strip()
    if not full_name:
        full_name = input("Manager full name: ").strip()

    email = args.email.strip()
    if not email:
        email = input("Manager email: ").strip()

    password = args.password
    if not password:
        password = getpass.getpass("Manager password (min 8 chars, letters + numbers): ")
        confirm = getpass.getpass("Confirm password: ")
        if password != confirm:
            print("Error: Passwords do not match.", file=sys.stderr)
            return 1

    init_db()
    try:
        user = bootstrap_manager_account(
            full_name=full_name,
            email=email,
            password=password,
            settings=get_settings(),
            allow_additional=args.allow_additional,
        )
    except AuthError as exc:
        print(f"Error ({exc.code}): {exc.message}", file=sys.stderr)
        return 1

    print(
        f"Manager account created successfully: id={user.id} email={user.email} role={user.role}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())

