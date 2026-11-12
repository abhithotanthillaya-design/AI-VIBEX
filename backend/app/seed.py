"""Idempotent seed data for the QUEUELESS campus canteen menu."""

from dataclasses import dataclass
import sqlite3

from app.database import write_transaction


@dataclass(frozen=True)
class SeedMenuItem:
    """Immutable definition for a seeded canteen menu item."""

    id: str
    name: str
    description: str
    category: str
    price: int
    prep_minutes: int
    available: bool
    image_url: str
    is_veg: bool = True


SEED_MENU_ITEMS: tuple[SeedMenuItem, ...] = (
    SeedMenuItem(
        id="item_1",
        name="Veg Grilled Sandwich",
        description="Crisp multi-grain toast layered with spiced potato, cucumber, tomato, and mint chutney.",
        category="Fast Food",
        price=5000,
        prep_minutes=4,
        available=True,
        image_url="/images/menu/veg-grilled-sandwich.jpg",
    ),
    SeedMenuItem(
        id="item_2",
        name="Masala Dosa",
        description="Golden crisp rice crepe stuffed with tempered potato masala, coconut chutney, and hot sambar.",
        category="Meals",
        price=6500,
        prep_minutes=6,
        available=True,
        image_url="/images/menu/masala-dosa.jpg",
    ),
    SeedMenuItem(
        id="item_3",
        name="Samosa Chaat",
        description="Crushed Punjabi samosas topped with spiced chickpeas, chilled yogurt, tamarind glaze, and crisp sev.",
        category="Snacks",
        price=4500,
        prep_minutes=3,
        available=True,
        image_url="/images/menu/samosa-chaat.jpg",
    ),
    SeedMenuItem(
        id="item_4",
        name="Paneer Kathi Roll",
        description="Char-grilled tandoori paneer cubes, pickled onions, and mint chutney wrapped in flaky paratha.",
        category="Fast Food",
        price=8500,
        prep_minutes=6,
        available=True,
        image_url="/images/menu/paneer-kathi-roll.jpg",
    ),
    SeedMenuItem(
        id="item_5",
        name="Rajma Chawal Bowl",
        description="Slow-simmered red kidney bean curry over steamed basmati rice with fresh kachumber salad.",
        category="Meals",
        price=9000,
        prep_minutes=5,
        available=True,
        image_url="/images/menu/rajma-chawal.jpg",
    ),
    SeedMenuItem(
        id="item_6",
        name="Chole Bhature",
        description="Aromatic spiced chickpea curry paired with two puffed golden bhaturas and pickled chillies.",
        category="Meals",
        price=9500,
        prep_minutes=7,
        available=True,
        image_url="/images/menu/chole-bhature.jpg",
    ),
    SeedMenuItem(
        id="item_7",
        name="Poha & Peanut Crunch",
        description="Light flattened rice tempered with mustard seeds, curry leaves, roasted peanuts, and fresh lemon.",
        category="Snacks",
        price=3500,
        prep_minutes=3,
        available=True,
        image_url="/images/menu/poha.jpg",
    ),
    SeedMenuItem(
        id="item_8",
        name="Schezwan Veg Maggi",
        description="Wok-tossed canteen favorite noodles with crunchy bell peppers, sweet corn, and smoky Schezwan spice.",
        category="Fast Food",
        price=5500,
        prep_minutes=4,
        available=True,
        image_url="/images/menu/schezwan-maggi.jpg",
    ),
    SeedMenuItem(
        id="item_9",
        name="Masala Chai",
        description="Freshly brewed Assam tea infused with crushed ginger, green cardamom pods, and warm milk.",
        category="Beverages",
        price=2000,
        prep_minutes=2,
        available=True,
        image_url="/images/menu/masala-chai.jpg",
    ),
    SeedMenuItem(
        id="item_10",
        name="Classic Cold Coffee",
        description="Chilled whipped espresso blended with creamy milk and a rich cocoa drizzle.",
        category="Beverages",
        price=6000,
        prep_minutes=2,
        available=True,
        image_url="/images/menu/cold-coffee.jpg",
    ),
    SeedMenuItem(
        id="item_11",
        name="Fresh Lime Soda",
        description="Sparkling chilled soda balanced with hand-pressed lime, black salt, and fresh mint leaves.",
        category="Beverages",
        price=3000,
        prep_minutes=1,
        available=True,
        image_url="/images/menu/fresh-lime-soda.jpg",
    ),
    SeedMenuItem(
        id="item_12",
        name="Butter Pav Bhaji",
        description="Rich spiced vegetable mash topped with butter, served alongside two toasted laadi pav.",
        category="Meals",
        price=8000,
        prep_minutes=6,
        available=False,
        image_url="/images/menu/pav-bhaji.jpg",
    ),
)


def seed_menu_items(conn: sqlite3.Connection | None = None) -> int:
    """Insert seeded menu items if missing without duplicating existing rows.

    Returns the number of newly inserted rows.
    """
    sql = """
        INSERT OR IGNORE INTO menu_items (
            id, name, description, category, price, prep_minutes, available, is_veg, is_deleted, image_url
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?)
    """
    params = [
        (
            item.id,
            item.name,
            item.description,
            item.category,
            item.price,
            item.prep_minutes,
            1 if item.available else 0,
            1 if item.is_veg else 0,
            item.image_url,
        )
        for item in SEED_MENU_ITEMS
    ]

    if conn is not None:
        before = conn.total_changes
        conn.executemany(sql, params)
        return conn.total_changes - before

    with write_transaction() as tx_conn:
        before = tx_conn.total_changes
        tx_conn.executemany(sql, params)
        return tx_conn.total_changes - before
