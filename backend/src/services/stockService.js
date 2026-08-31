import pool from '../config/db.js';

// Reduce inventory for an order's menu items using the recipe table.
// Use the order's restaurant to prefer that restaurant's stock.
export async function consumeOrderStock(orderId, restaurantId, userId) {
  const orderItems = await pool.query(
    `SELECT oi.menu_item_id, oi.quantity, oi.item_name
     FROM order_items oi WHERE oi.order_id=$1`,
    [orderId]
  );
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    for (const oi of orderItems.rows) {
      if (!oi.menu_item_id) continue;
      const recipes = await client.query(
        `SELECT io.id AS inv_id, io.name, io.restaurant_id, io.quantity AS current_qty, mc.quantity AS recipe_qty
         FROM menu_recipes mc JOIN inventory_items io ON io.id=mc.inventory_item_id
         WHERE mc.menu_item_id=$1 ORDER BY CASE WHEN io.restaurant_id=$2 THEN 0 ELSE 1 END`,
        [oi.menu_item_id, restaurantId]
      );
      for (const re of recipes.rows) {
        const consume = Number(re.recipe_qty) * Number(oi.quantity);
        const newQty = Math.max(0, Number(re.current_qty) - consume);
        await client.query(`UPDATE inventory_items SET quantity=$2 WHERE id=$1`, [re.inv_id, newQty]);
        await client.query(
          `INSERT INTO inventory_transactions (item_id, type, quantity, ref_type, ref_id, note, created_by)
           VALUES ($1,'SALE',$2,'orders',$3,'Sold on order', $4)`,
          [re.inv_id, consume, orderId, userId || null]
        );
      }
    }
    await client.query('COMMIT');
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}
