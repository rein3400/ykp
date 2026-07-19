/**
 * PUBLIC (owner layer): recipe theoretical costs per menu item.
 * GET /api/warehouse/recipe-costs
 * cost_per_portion = Σ qty_per_portion × unit_cost(item), where unit_cost is
 * average_purchase_price (fallback latest_purchase_price) per base_unit.
 * Rows with a unit mismatch (qty_per_portion.unit ≠ item.base_unit) are
 * flagged incomplete=true so the owner page can treat their cost as partial.
 */
import { readTab, TABS } from '@/db/sheets';
import { list, handler } from '@/lib/http';

export const GET = handler(async () => {
  const [recipes, recipeItems, items] = await Promise.all([
    readTab<Record<string, string>>(TABS.recipe),
    readTab<Record<string, string>>(TABS.recipeItem),
    readTab<Record<string, string>>(TABS.items)
  ]);
  const itemById = new Map(items.map((i) => [i.item_id, i]));

  const rows = recipes
    .filter((r) => r.active_status === 'active' || r.active_status === '')
    .map((r) => {
      const lines = recipeItems.filter((ri) => ri.recipe_id === r.recipe_id);
      let cost = 0;
      let incomplete = false;
      for (const line of lines) {
        const item = itemById.get(line.item_id);
        if (!item) { incomplete = true; continue; }
        const unitCost = Number(item.average_purchase_price || 0) || Number(item.latest_purchase_price || 0);
        const lineUnit = (line.unit ?? '').toLowerCase();
        const baseUnit = (item.base_unit ?? '').toLowerCase();
        if (lineUnit && baseUnit && lineUnit !== baseUnit) incomplete = true;
        cost += Number(line.qty_per_portion || 0) * unitCost;
      }
      return {
        recipe_id: r.recipe_id,
        menu_name: r.menu_name,
        outlet_id: r.outlet_id,
        selling_price: r.selling_price ?? '0',
        cost_per_portion: String(Math.round(cost)),
        ingredient_count: String(lines.length),
        incomplete: incomplete ? 'true' : 'false'
      };
    });
  return list(rows);
});
