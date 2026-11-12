"""SQLite connection, transaction, and schema management."""

from contextlib import contextmanager
from pathlib import Path
import sqlite3
import threading
from typing import Iterator

from app.config import get_settings

# Process-wide lock combined with SQLite BEGIN IMMEDIATE prevents race
# conditions when concurrent requests allocate pickup slots.
_WRITE_LOCK = threading.Lock()


def get_db_path() -> Path:
    """Resolve and ensure parent directory exists for the SQLite file."""
    settings = get_settings()
    db_path = Path(settings.database_path)
    if not db_path.is_absolute():
        backend_root = Path(__file__).resolve().parent.parent
        db_path = backend_root / db_path
    db_path.parent.mkdir(parents=True, exist_ok=True)
    return db_path


def get_connection() -> sqlite3.Connection:
    """Open a configured SQLite connection."""
    conn = sqlite3.connect(
        str(get_db_path()),
        timeout=15.0,
        isolation_level=None,
        check_same_thread=False,
    )
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON;")
    conn.execute("PRAGMA journal_mode = WAL;")
    return conn


@contextmanager
def db_session() -> Iterator[sqlite3.Connection]:
    """Provide a read/write SQLite connection with automatic cleanup."""
    conn = get_connection()
    try:
        yield conn
    finally:
        conn.close()


@contextmanager
def write_transaction() -> Iterator[sqlite3.Connection]:
    """Provide an atomic, serialized write transaction for SQLite."""
    with _WRITE_LOCK:
        conn = get_connection()
        try:
            conn.execute("BEGIN IMMEDIATE;")
            yield conn
            conn.commit()
        except Exception:
            if conn.in_transaction:
                conn.rollback()
            raise
        finally:
            conn.close()


def init_db() -> None:
    """Create database tables and indexes if they do not exist."""
    with write_transaction() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS menu_items (
                id TEXT PRIMARY KEY,
                name TEXT NOT NULL,
                description TEXT NOT NULL,
                category TEXT NOT NULL DEFAULT 'Snacks',
                price INTEGER NOT NULL CHECK (price >= 0),
                prep_minutes INTEGER NOT NULL CHECK (prep_minutes > 0),
                available INTEGER NOT NULL DEFAULT 1 CHECK (available IN (0, 1)),
                is_veg INTEGER NOT NULL DEFAULT 1 CHECK (is_veg IN (0, 1)),
                is_vegan INTEGER NOT NULL DEFAULT 0 CHECK (is_vegan IN (0, 1)),
                is_jain INTEGER NOT NULL DEFAULT 0 CHECK (is_jain IN (0, 1)),
                allergen_info TEXT,
                is_deleted INTEGER NOT NULL DEFAULT 0 CHECK (is_deleted IN (0, 1)),
                image_url TEXT
            );

            CREATE TABLE IF NOT EXISTS canteen_settings (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS closed_slots (
                slot_start TEXT PRIMARY KEY,
                reason TEXT,
                closed_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS orders (
                id TEXT PRIMARY KEY,
                pickup_code TEXT NOT NULL UNIQUE,
                customer_name TEXT NOT NULL,
                status TEXT NOT NULL CHECK (
                    status IN ('PLACED', 'ACCEPTED', 'PREPARING', 'READY', 'COLLECTED', 'CANCELLED')
                ),
                pickup_slot_start TEXT NOT NULL,
                pickup_slot_end TEXT NOT NULL,
                total_amount INTEGER NOT NULL CHECK (total_amount >= 0),
                total_prep_units INTEGER NOT NULL CHECK (total_prep_units > 0),
                notes TEXT,
                payment_method TEXT NOT NULL DEFAULT 'COUNTER_CASH',
                payment_status TEXT NOT NULL DEFAULT 'PAY_AT_COUNTER',
                payment_reference TEXT,
                pickup_token_hash TEXT,
                pickup_token_used_at TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            );

            CREATE TABLE IF NOT EXISTS order_items (
                id TEXT PRIMARY KEY,
                order_id TEXT NOT NULL,
                menu_item_id TEXT NOT NULL,
                item_name TEXT NOT NULL,
                quantity INTEGER NOT NULL CHECK (quantity > 0),
                unit_price INTEGER NOT NULL CHECK (unit_price >= 0),
                prep_minutes INTEGER NOT NULL CHECK (prep_minutes > 0),
                FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
                FOREIGN KEY (menu_item_id) REFERENCES menu_items(id)
            );

            CREATE INDEX IF NOT EXISTS idx_orders_status
                ON orders(status);
            CREATE INDEX IF NOT EXISTS idx_orders_pickup_slot
                ON orders(pickup_slot_start, created_at);
            CREATE INDEX IF NOT EXISTS idx_order_items_order_id
                ON order_items(order_id);
            """
        )

        # Safe additive migration for existing SQLite databases from Phases 1-5.
        existing_cols = {
            str(row["name"])
            for row in conn.execute("PRAGMA table_info(menu_items);").fetchall()
        }
        if "is_veg" not in existing_cols:
            conn.execute(
                "ALTER TABLE menu_items ADD COLUMN is_veg INTEGER NOT NULL DEFAULT 1;"
            )
        if "is_vegan" not in existing_cols:
            conn.execute(
                "ALTER TABLE menu_items ADD COLUMN is_vegan INTEGER NOT NULL DEFAULT 0;"
            )
        if "is_jain" not in existing_cols:
            conn.execute(
                "ALTER TABLE menu_items ADD COLUMN is_jain INTEGER NOT NULL DEFAULT 0;"
            )
        if "allergen_info" not in existing_cols:
            conn.execute(
                "ALTER TABLE menu_items ADD COLUMN allergen_info TEXT;"
            )
        if "is_deleted" not in existing_cols:
            conn.execute(
                "ALTER TABLE menu_items ADD COLUMN is_deleted INTEGER NOT NULL DEFAULT 0;"
            )

        existing_order_cols = {
            str(row["name"])
            for row in conn.execute("PRAGMA table_info(orders);").fetchall()
        }
        if "payment_method" not in existing_order_cols:
            conn.execute(
                "ALTER TABLE orders ADD COLUMN payment_method TEXT NOT NULL DEFAULT 'COUNTER_CASH';"
            )
        if "payment_status" not in existing_order_cols:
            conn.execute(
                "ALTER TABLE orders ADD COLUMN payment_status TEXT NOT NULL DEFAULT 'PAY_AT_COUNTER';"
            )
        if "payment_reference" not in existing_order_cols:
            conn.execute(
                "ALTER TABLE orders ADD COLUMN payment_reference TEXT;"
            )
        if "pickup_token_hash" not in existing_order_cols:
            conn.execute(
                "ALTER TABLE orders ADD COLUMN pickup_token_hash TEXT;"
            )
        if "pickup_token_used_at" not in existing_order_cols:
            conn.execute(
                "ALTER TABLE orders ADD COLUMN pickup_token_used_at TEXT;"
            )
        conn.execute(
            "CREATE UNIQUE INDEX IF NOT EXISTS idx_orders_pickup_token_hash ON orders(pickup_token_hash);"
        )


def check_db_health() -> bool:
    """Verify the SQLite database responds to a basic query."""
    try:
        with db_session() as conn:
            conn.execute("SELECT 1;").fetchone()
        return True
    except sqlite3.Error:
        return False

