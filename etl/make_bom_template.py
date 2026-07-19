"""N3: BOM template generator for the owner.

The anti-fraud theoretical-usage reconciliation needs a recipe/BOM table:
  menu item (Moka) -> ingredient item_key + qty_per_portion + unit

No recipe data exists in any source file, so this generates a fill-in
template the owner completes once:

  output/bom_template.csv        — fill this in (one row per menu-ingredient)
  output/bom_ingredient_reference.csv — the 263 valid ingredient item_keys

The warehouse tabs `master_recipe` / `master_recipe_item` (already added to
TAB_HEADERS) receive the result after review.
"""
from __future__ import annotations

import pandas as pd

from common import write_csv

EXAMPLE_ROWS = [
    # menu_name, portion_size, selling_price, ingredient_item_key, qty_per_portion, unit, note
    ("CONTOH: Ayam Geprek", "1 porsi", 25000, "DADA AYAM MARINASI", 150, "g", "contoh — ganti dengan menu asli"),
    ("CONTOH: Ayam Geprek", "1 porsi", 25000, "MINYAK GORENG", 30, "ml", "contoh — ganti dengan menu asli"),
    ("CONTOH: Kopi Susu Gula Aren", "1 gelas", 18000, "FULL ARABICA (LAJU DEMANGAN)", 18, "g", "contoh — ganti dengan menu asli"),
    ("CONTOH: Kopi Susu Gula Aren", "1 gelas", 18000, "GULA CAIR", 20, "ml", "contoh — ganti dengan menu asli"),
]


def main() -> None:
    items = pd.read_csv(__file__.replace("make_bom_template.py", "output\\master_items.csv"))

    bom = pd.DataFrame(EXAMPLE_ROWS, columns=[
        "menu_name", "portion_size", "selling_price",
        "ingredient_item_key", "qty_per_portion", "unit", "note",
    ])
    write_csv(bom, "bom_template.csv")

    ref = items[["item_key", "item_name", "category_id", "base_unit"]].sort_values("item_key")
    write_csv(ref, "bom_ingredient_reference.csv")

    print(f"bom_template.csv: {len(bom)} example rows — owner replaces with real menus")
    print(f"bom_ingredient_reference.csv: {len(ref)} valid ingredient keys")


if __name__ == "__main__":
    main()
