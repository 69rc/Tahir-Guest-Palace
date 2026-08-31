import 'dotenv/config';
import bcrypt from 'bcryptjs';
import pool from '../config/db.js';

const NIGERIAN_FIRST = ['Ahmed', 'Fatima', 'Musa', 'Aisha', 'Ibrahim', 'Aminu', 'Hauwa', 'Sani', 'Zainab', 'Abdullahi', 'Maryam', 'Bello', 'Rabiu', 'Khadija', 'Yusuf', 'Sadiya', 'Nana', 'Umar', 'Halima', 'Bashir', 'Rashida', 'Kabiru', 'Aminat', 'Salim', 'Hadiza'];
const NIGERIAN_LAST = ['Musa', 'Suleiman', 'Abubakar', 'Ibrahim', 'Yahaya', 'Danladi', 'Lawal', 'Garba', 'Adamu', 'Mohammed', 'Isah', 'Bala', 'Sani', 'Yakubu', 'Okafor', 'Eze', 'Balogun', 'Ogunleye', 'Okonkwo', 'Nwachukwu'];

const rand = (arr) => arr[Math.floor(Math.random() * arr.length)];
const randInt = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;
const daysAgo = (n) => {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return d;
};
const dateStr = (d) => d.toISOString().slice(0, 10);
const ts = (d) => d.toISOString();

async function clean() {
  const tables = [
    'invoice_items', 'payments', 'invoices', 'expenses',
    'purchase_items', 'purchases', 'inventory_transactions', 'inventory_items', 'inventory_categories', 'suppliers',
    'order_items', 'orders', 'menu_items', 'menu_categories', 'restaurant_tables', 'restaurants',
    'housekeeping_tasks', 'check_outs', 'check_ins', 'reservations', 'rooms', 'room_types', 'guests',
    'audit_logs', 'users', 'role_permissions', 'permissions', 'roles',
  ];
  for (const t of tables) {
    await pool.query(`TRUNCATE ${t} RESTART IDENTITY CASCADE`);
  }
}

async function seed() {
  await clean();

  let genCounter = 0;
  function gen(prefix) {
    genCounter++;
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    return `${prefix}-${stamp}-${String(genCounter).padStart(5, '0')}`;
  }

  // ============ ROLES ============
  const roles = [
    ['ADMIN', 'Full system access'],
    ['GENERAL_MANAGER', 'Oversees all hotel operations'],
    ['MANAGER', 'Department manager'],
    ['RECEPTIONIST', 'Front desk and reservations'],
    ['RESTAURANT_MANAGER', 'Manages restaurant operations'],
    ['RESTAURANT_STAFF', 'Restaurant POS and orders'],
    ['ACCOUNTANT', 'Finance and reporting'],
    ['STOREKEEPER', 'Inventory and purchases'],
    ['HOUSEKEEPING', 'Housekeeping staff'],
  ];
  const roleId = {};
  for (const [name, desc] of roles) {
    const r = await pool.query('INSERT INTO roles (name, description) VALUES ($1,$2) RETURNING id', [name, desc]);
    roleId[name] = r.rows[0].id;
  }

  // ============ USERS ============
  const adminHash = await bcrypt.hash('admin123', 10);
  const users = [
    ['Admin', 'admin', 'admin@tahirpalace.com', '08000000001', roleId.ADMIN],
    ['GM Hassan', 'gm', 'gm@tahirpalace.com', '08000000002', roleId.GENERAL_MANAGER],
    ['Receiptionist Amina', 'reception', 'receiption@tahirpalace.com', '08000000003', roleId.RECEPTIONIST],
    ['Restaurant Manager Dan', 'restman', 'restman@tahirpalace.com', '08000000004', roleId.RESTAURANT_MANAGER],
    ['POS Staff Kabir', 'pos', 'pos@tahirpalace.com', '08000000005', roleId.RESTAURANT_STAFF],
    ['Accountant Zainab', 'account', 'account@tahirpalace.com', '08000000006', roleId.ACCOUNTANT],
    ['Storekeeper Bello', 'store', 'store@tahirpalace.com', '08000000007', roleId.STOREKEEPER],
    ['Housekeeping Halima', 'hskeeper', 'hk@tahirpalace.com', '08000000008', roleId.HOUSEKEEPING],
  ];
  const userId = {};
  for (const [n, u, e, ph, rid] of users) {
    const r = await pool.query(
      'INSERT INTO users (full_name, username, email, phone, password_hash, role_id) VALUES ($1,$2,$3,$4,$5,$6) RETURNING id',
      [n, u, e, ph, adminHash, rid]);
    userId[u] = r.rows[0].id;
  }

  // ============ ROOM TYPES ============
  const roomTypes = [
    ['Single', 45000, 1, 'A cozy and elegant space ideal for solo travelers, equipped with modern amenities, plush bedding, and a serene view.'],
    ['Deluxe', 75000, 2, 'Spacious deluxe room with city views, luxury bedding and modern amenities.'],
    ['Executive', 95000, 2, 'Executive room with lounge access and premium amenities.'],
    ['Double', 155000, 2, 'Perfect for couples or friends, featuring ample space, a relaxing ambiance, and luxurious furnishings.'],
    ['Suite', 250000, 4, 'Presidential suite with separate living area, executive workspace and full amenities.'],
    ['Duplex', 245000, 4, 'Two levels of indulgence with a duplex-style suite featuring a private living room, premium bath, and breathtaking interior.'],
  ];
  const typeId = {};
  for (const [name, price, cap, desc] of roomTypes) {
    const r = await pool.query('INSERT INTO room_types (name, base_price, capacity, description) VALUES ($1,$2,$3,$4) RETURNING id', [name, price, cap, desc]);
    typeId[name] = r.rows[0].id;
  }

  // ============ ROOMS (34, unique numbers incl. Room 204 for demo) ============
  const roomDefs = [];
  // Deterministic spread across floors with unique numbers
  const plan = [
    // Single (floor 1 & 2)
    ['Single', '101'], ['Single', '102'], ['Single', '103'], ['Single', '105'],
    ['Single', '106'], ['Single', '107'], ['Single', '108'], ['Single', '109'],
    ['Single', '110'], ['Single', '111'], ['Single', '112'], ['Single', '112A'],
    ['Single', '113'], ['Single', '114'], ['Single', '115'],
    // Executive (floor 2)
    ['Executive', '201'], ['Executive', '202'], ['Executive', '203'], ['Executive', '205'],
    ['Executive', '206'], ['Executive', '207'], ['Executive', '208'], ['Executive', '209'],
    // Deluxe (floor 2 & 3)
    ['Deluxe', '301'], ['Deluxe', '302'], ['Deluxe', '303'],
    ['Deluxe', '304'], ['Deluxe', '305'],
    ['Double', '204'],
    // Suite & Duplex (floor 4 & 5)
    ['Suite', '402'], ['Suite', '403'], ['Duplex', '404'], ['Suite', '502'],
  ];
  for (const [type, num] of plan) roomDefs.push({ type, num, floor: Number(num[0]) });
  const roomId = {};
  for (const rd of roomDefs) {
    let price = roomTypes.find((t) => t[0] === rd.type)[1];
    if (rd.num === '204') price = 60000; // demo room
    const r = await pool.query(
      'INSERT INTO rooms (room_number, room_type_id, floor, price_per_night, status) VALUES ($1,$2,$3,$4,$5) RETURNING id',
      [rd.num, typeId[rd.type], rd.floor, price + randInt(-5000, 30000), 'AVAILABLE']);
    roomId[rd.num] = r.rows[0].id;
  }

  // ============ GUESTS (24) ============
  const guestId = {};
  const guestNames = [];
  for (let i = 0; i < 24; i++) {
    const fn = rand(NIGERIAN_FIRST);
    const ln = rand(NIGERIAN_LAST);
    const name = `${fn} ${ln}`;
    const phone = `080${String(randInt(10000000, 99999999))}`;
    const g = await pool.query(
      'INSERT INTO guests (full_name, phone, email, address, id_type, id_number, nationality) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id',
      [name, phone, `${fn.toLowerCase()}.${ln.toLowerCase()}@mail.com`, `${randInt(1,99)} Aminu Kano Crescent`, 'NIN', String(randInt(10000000000, 99999999999)), 'Nigerian']);
    guestId[name] = g.rows[0].id;
    guestNames.push(name);
  }

  // ============ RESTAURANTS ============
  const res1 = await pool.query(`INSERT INTO restaurants (name, description, tax_rate, service_charge) VALUES ('Calido Rooftop & Grill House','Rooftop dining specializing in local, continental and international cuisine, with buffet breakfast daily 6:30–11:30 AM',7.5,10) RETURNING id`);
  const res2 = await pool.query(`INSERT INTO restaurants (name, description, tax_rate, service_charge) VALUES ('Tahir Garden Café & Lounge','Outdoor café & lounge with coffee, light meals and bar, serving a blend of local and international favourites',5,8) RETURNING id`);
  const r1 = res1.rows[0].id, r2 = res2.rows[0].id;

  // Tables
  const tables = [];
  for (const [rid, prefix, count] of [[r1, 'T', 8], [r2, 'C', 6]]) {
    for (let i = 1; i <= count; i++) {
      const tn = i <= 4 ? `${prefix}${i}` : (i === count - 1 ? `VIP ${prefix}${i}` : `${prefix}${i}`);
      const t = await pool.query('INSERT INTO restaurant_tables (restaurant_id, table_number, capacity, status) VALUES ($1,$2,$3,$4) RETURNING id', [rid, tn, i % 2 === 0 ? 4 : 2, 'AVAILABLE']);
      tables.push(t.rows[0].id);
    }
  }

  // Menu categories & items
  const menuDefs = [
    { cat: 'Main Courses', items: [['Jollof Rice', 3500], ['Fried Rice', 3500], ['Rice & Stew', 4000], ['Pounded Yam & Egusi', 6000], ['Grilled Chicken', 7000], ['Suya Platter', 8000], ['Beef Steak', 9000], ['Thick Pasta Alfredo', 7500]] },
    { cat: 'Specials', items: [['Palace Special Rice', 5500], ['Peppered Snail', 12000], ['Grilled Whole Fish', 18000], ['Nkwobi', 9000], ['Pepper Soup Whole Catfish', 11000]] },
    { cat: 'Appetizers', items: [['Chicken Wings (6)', 5500], ['Spring Rolls', 3500], ['Samosa (3)', 3000], ['Chin Chin', 2500]] },
    { cat: 'Drinks', items: [['Soft Drink', 1500], ['Bottled Water', 500], ['Fresh Orange Juice', 2500], ['Mango Smoothie', 3000], ['Chapman', 3000]] },
    { cat: 'Desserts', items: [['Chocolate Cake', 4500], ['Fruit Salad', 3500], ['Ice Cream (2 scoops)', 2000]] },
  ];
  const r1Items = {};
  for (const { cat, items } of menuDefs) {
    const c = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r1, cat]);
    const cid = c.rows[0].id;
    for (const [name, price] of items) {
      const m = await pool.query('INSERT INTO menu_items (restaurant_id, category_id, name, price, cost) VALUES ($1,$2,$3,$4,$5) RETURNING id', [r1, cid, name, price, Math.round(price * 0.5)]);
      r1Items[name] = m.rows[0].id;
    }
  }
  // Garden cafe menu (subset, coffee)
  const c2 = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r2, 'Beverages']);
  const c22 = await pool.query('INSERT INTO menu_categories (restaurant_id, name) VALUES ($1,$2) RETURNING id', [r2, 'Light Meals']);
  const cafeItems = [
    ['Espresso', 2000, c2.rows[0].id], ['Cappuccino', 2500, c2.rows[0].id], ['African Tea', 1500, c2.rows[0].id],
    ['Chicken Sandwich', 5000, c22.rows[0].id], ['Club Sandwich', 6500, c22.rows[0].id], ['Croissant', 3000, c22.rows[0].id],
  ];
  for (const [name, price, cid] of cafeItems) {
    await pool.query('INSERT INTO menu_items (restaurant_id, category_id, name, price, cost) VALUES ($1,$2,$3,$4,$5)', [r2, cid, name, price, Math.round(price * 0.5)]);
  }

  // ============ SUPPLIERS ============
  const suppliers = [
    ['Kano Fresh Produce Ltd', 'Alhaji Sule', '08050000001', 'fresh@mail.com', 'Sabon Gari Market, Kano'],
    ['Northern Beverages Co', 'Mr John', '08050000002', 'beverages@mail.com', 'Sharada Industrial Estate'],
    ['Chestnut Foods Distribution', 'Mrs Grace', '08050000003', 'chestnut@mail.com', 'Kano Trade Fair Complex'],
    ['LightHouse Cleaning Supplies', 'Mr Peter', '08050000004', 'cleaning@mail.com', 'Bompai, Kano'],
  ];
  const supplierId = {};
  for (const [name, cp, ph, em, ad] of suppliers) {
    const s = await pool.query('INSERT INTO suppliers (name, contact_person, phone, email, address) VALUES ($1,$2,$3,$4,$5) RETURNING id', [name, cp, ph, em, ad]);
    supplierId[name] = s.rows[0].id;
  }

  // ============ INVENTORY ============
  const invCats = ['Food', 'Beverages', 'Cleaning', 'Toiletries', 'Housekeeping'];
  const invCatId = {};
  for (const c of invCats) {
    const r = await pool.query('INSERT INTO inventory_categories (name) VALUES ($1) RETURNING id', [c]);
    invCatId[c] = r.rows[0].id;
  }
  const foodItems = [
    ['Rice (50kg)', 'pcs', 38000, 45000, 2100, 300, supplierId['Chestnut Foods Distribution'], 'Food'],
    ['Chicken (kg)', 'kg', 2800, 4500, 152, 60, supplierId['Kano Fresh Produce Ltd'], 'Food'],
    ['Cooking Oil (5L)', 'pcs', 9500, 12500, 85, 30, supplierId['Chestnut Foods Distribution'], 'Food'],
    ['Tomatoes (crate)', 'crate', 22000, 30000, 42, 15, supplierId['Kano Fresh Produce Ltd'], 'Food'],
    ['Onions (bag)', 'bag', 18000, 25000, 30, 12, supplierId['Kano Fresh Produce Ltd'], 'Food'],
    ['Spices (assorted)', 'pcs', 4000, 6500, 60, 20, supplierId['Kano Fresh Produce Ltd'], 'Food'],
    ['Flour (25kg)', 'pcs', 15500, 20000, 45, 15, supplierId['Chestnut Foods Distribution'], 'Food'],
    ['Pepper (kg)', 'kg', 2500, 4000, 55, 20, supplierId['Kano Fresh Produce Ltd'], 'Food'],
  ];
  const bevItems = [
    ['Soft Drinks (crate)', 'crate', 4200, 6000, 220, 50, supplierId['Northern Beverages Co'], 'Beverages'],
    ['Bottled Water (pack)', 'pack', 2600, 4000, 300, 60, supplierId['Northern Beverages Co'], 'Beverages'],
    ['Milk (tin)', 'pcs', 1500, 2500, 90, 30, supplierId['Northern Beverages Co'], 'Beverages'],
    ['Coffee Beans (kg)', 'kg', 6800, 12000, 20, 8, supplierId['Northern Beverages Co'], 'Beverages'],
    ['Tea Leaves (kg)', 'kg', 3000, 5500, 25, 10, supplierId['Northern Beverages Co'], 'Beverages'],
  ];
  const cleanItems = [
    ['Detergent (5L)', 'pcs', 8500, 12000, 40, 12, supplierId['LightHouse Cleaning Supplies'], 'Cleaning'],
    ['Disinfectant (5L)', 'pcs', 6500, 9500, 32, 10, supplierId['LightHouse Cleaning Supplies'], 'Cleaning'],
    ['Cleaning Cloths (pack)', 'pack', 2500, 4000, 80, 25, supplierId['LightHouse Cleaning Supplies'], 'Cleaning'],
    ['Gloves (pack)', 'pack', 3000, 5000, 55, 20, supplierId['LightHouse Cleaning Supplies'], 'Cleaning'],
  ];
  const toiletItems = [
    ['Toilet Rolls (pack)', 'pack', 2400, 3800, 150, 40, supplierId['LightHouse Cleaning Supplies'], 'Toiletries'],
    ['Soap (pcs)', 'pcs', 600, 1200, 300, 80, supplierId['LightHouse Cleaning Supplies'], 'Toiletries'],
    ['Shampoo (bottle)', 'pcs', 1800, 3500, 120, 40, supplierId['LightHouse Cleaning Supplies'], 'Toiletries'],
    ['Tissue Boxes', 'pcs', 1200, 2500, 90, 30, supplierId['LightHouse Cleaning Supplies'], 'Toiletries'],
  ];
  const hkItems = [
    ['Bed Sheets (set)', 'pcs', 15000, 22000, 95, 30, supplierId['LightHouse Cleaning Supplies'], 'Housekeeping'],
    ['Towels (set)', 'pcs', 8000, 12500, 140, 40, supplierId['LightHouse Cleaning Supplies'], 'Housekeeping'],
    ['Pillows', 'pcs', 6000, 10000, 60, 20, supplierId['LightHouse Cleaning Supplies'], 'Housekeeping'],
  ];

  const invItemIds = {};
  const allInv = [...foodItems, ...bevItems, ...cleanItems, ...toiletItems, ...hkItems];
  const roster = [null, r1, r1, r2, null, null, null, null];
  let invIdx = 0;
  for (const [name, unit, cost, sell, qty, min, sup, cat] of allInv) {
    const rest = rand([null, r1, r2, null, r1, null, null, r2]);
    const r = await pool.query(
      'INSERT INTO inventory_items (name, restaurant_id, category_id, unit, cost_price, selling_price, quantity, min_quantity, supplier_id) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id',
      [name, rest, invCatId[cat], unit, cost, sell, qty, min, sup]);
    invItemIds[name] = r.rows[0].id;
    // give some items low stock for alerts
    if (invIdx % 5 === 0) {
      await pool.query('UPDATE inventory_items SET quantity=$2 WHERE id=$1', [r.rows[0].id, Math.max(0, min - randInt(1, 5))]);
    }
    invIdx++;
  }

  // ============ MENU RECIPES (menu item -> inventory item) ============
  const recipeMap = {
    'Jollof Rice': [['Rice (50kg)', 0.02], ['Cooking Oil (5L)', 0.05]],
    'Fried Rice': [['Rice (50kg)', 0.02], ['Chicken (kg)', 0.15]],
    'Rice & Stew': [['Rice (50kg)', 0.025], ['Tomatoes (crate)', 0.02]],
    'Grilled Chicken': [['Chicken (kg)', 0.4]],
    'Pounded Yam & Egusi': [['Flour (25kg)', 0.05], ['Cooking Oil (5L)', 0.05]],
    'Suya Platter': [['Chicken (kg)', 0.3], ['Spices (assorted)', 0.1]],
    'Soft Drink': [['Soft Drinks (crate)', 0.04]],
    'Bottled Water': [['Bottled Water (pack)', 0.04]],
    'Fresh Orange Juice': [['Milk (tin)', 0.02]],
    'Chocolate Cake': [['Flour (25kg)', 0.03]],
  };
  for (const menuName of Object.keys(recipeMap)) {
    const mi = r1Items[menuName];
    if (!mi) continue;
    for (const [invName, qty] of recipeMap[menuName]) {
      const ii = invItemIds[invName];
      if (!ii) continue;
      await pool.query(
        'INSERT INTO menu_recipes (menu_item_id, inventory_item_id, quantity) VALUES ($1,$2,$3)',
        [mi, ii, qty]);
    }
  }

  // ============ RESERVATIONS & STAYS ============
  const statusPool = ['CHECKED_OUT', 'CONFIRMED', 'CONFIRMED', 'CHECKED_OUT'];
  const roomNumbers = Object.keys(roomId);
  const allStatuses = ['AVAILABLE', 'OCCUPIED', 'CLEANING', 'RESERVED', 'MAINTENANCE'];
  const resvNo = [];
  const stayReservations = [];
  const randomRoomNumbers = roomNumbers.filter((n) => n !== '204'); // keep 204 free for Ahmed demo

  for (let i = 0; i < 40; i++) {
    const guest = rand(guestNames);
    const gid = guestId[guest];
    const rn = rand(randomRoomNumbers);
    const rid = roomId[rn];
    const nights = randInt(1, 4);
    const checkIn = daysAgo(randInt(0, 60));
    const checkOut = new Date(checkIn);
    checkOut.setDate(checkOut.getDate() + nights);
    const rate = randInt(40000, 200000);
    const disc = randInt(0, 1) ? 0 : randInt(5000, 20000);
    const total = nights * rate - disc;
    const status = statusPool[randInt(0, statusPool.length - 1)];

    const r = await pool.query(
      `INSERT INTO reservations (reservation_no, guest_id, room_id, check_in_date, check_out_date, adults, children, rate, discount, deposit, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [gen('RES'), gid, rid, dateStr(checkIn), dateStr(checkOut), randInt(1, 2), randInt(0, 2), rate, disc, randInt(0, 1) ? randInt(10000, 50000) : 0, status]);
    resvNo.push(r.rows[0]);
    if (status === 'CHECKED_OUT') stayReservations.push(r.rows[0]);
    if (status === 'CONFIRMED') {
      await pool.query("UPDATE rooms SET status='RESERVED' WHERE id=$1 AND status='AVAILABLE'", [rid]);
    }
  }

  // Check-ins for checked_out & occupied (make some rooms occupied with current stays)
  for (const r of stayReservations) {
    const ci = new Date(r.check_in_date);
    ci.setHours(10, 0, 0, 0);
    await pool.query('INSERT INTO check_ins (reservation_id, guest_id, room_id, checkin_time, checked_in_by) VALUES ($1,$2,$3,$4,$5)', [r.id, r.guest_id, r.room_id, ts(ci), userId.reception]);
    const co = new Date(r.check_out_date);
    co.setHours(12, 0, 0, 0);
    await pool.query('INSERT INTO check_outs (reservation_id, guest_id, room_id, checkout_time, checked_out_by) VALUES ($1,$2,$3,$4,$5)', [r.id, r.guest_id, r.room_id, ts(co), userId.reception]);
    await pool.query("UPDATE reservations SET status='CHECKED_OUT' WHERE id=$1", [r.id]);
  }

  // Create some currently checked-in guests (active stays)
  const activeStays = [];
  for (let i = 0; i < 10; i++) {
    const guest = rand(guestNames);
    const gid = guestId[guest];
    // find an AVAILABLE room currently (excluding demo room 204)
    const avail = await pool.query("SELECT id, room_number FROM rooms WHERE status='AVAILABLE' AND room_number<>'204' ORDER BY random() LIMIT 1");
    if (avail.rows.length === 0) break;
    const rid = avail.rows[0].id;
    const nights = randInt(2, 5);
    const ci = daysAgo(randInt(0, 3));
    const co = new Date(ci);
    co.setDate(co.getDate() + nights);
    const rate = randInt(50000, 200000);
    const r = await pool.query(
      `INSERT INTO reservations (reservation_no, guest_id, room_id, check_in_date, check_out_date, adults, children, rate, discount, deposit, status)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,0,0,'CHECKED_IN') RETURNING *`,
      [gen('RES'), gid, rid, dateStr(ci), dateStr(co), 1, 0, rate]);
    const R = r.rows[0];
    const ci2 = new Date(ci); ci2.setHours(11, 0, 0, 0);
    await pool.query('INSERT INTO check_ins (reservation_id, guest_id, room_id, checkin_time, checked_in_by) VALUES ($1,$2,$3,$4,$5)', [R.id, gid, rid, ts(ci2), userId.reception]);
    await pool.query("UPDATE rooms SET status='OCCUPIED' WHERE id=$1", [rid]);
    activeStays.push({ reservation: R, gid, rid, rate, nights });
  }

  // ============ FOLIOS, ROOM CHARGES, PAYMENTS ============
  // For every reservation, build a folio invoice with room charge + partial/full payments
  for (const r of resvNo) {
    const nights = Math.round((new Date(r.check_out_date) - new Date(r.check_in_date)) / 86400000);
    const roomCharge = nights * Number(r.rate) - Number(r.discount);
    const inv = await pool.query(
      `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal, total, paid, balance, status)
       VALUES ($1,$2,$3,'HOTEL',$4,$4,0,$4,'UNPAID') RETURNING *`,
      [gen('INV'), r.guest_id, r.id, roomCharge]);
    await pool.query(
      `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
       VALUES ($1,$2,$3,$4,$4)`,
      [inv.rows[0].id, `Room ${nights} nights × ₦${Number(r.rate).toLocaleString()}`, nights, roomCharge]);

    const paid = Math.random() < 0.8 ? Math.round(roomCharge * (Math.random() * 0.5 + 0.5)) : Math.round(roomCharge * 0.2);
    if (r.deposit > 0) {
      await pool.query(
        `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, created_at, received_by)
         VALUES ($1,$2,$3,$4,$5,$6,'ROOM','Deposit',now() - interval '3 days',$7)`,
        [gen('PAY'), r.guest_id, r.id, inv.rows[0].id, r.deposit, 'CASH', userId.reception]);
    }
    const finalPaid = Math.min(paid, roomCharge);
    await pool.query(
      `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, created_at, received_by)
       VALUES ($1,$2,$3,$4,$5,$6,'ROOM','Room payment',$7,$8)`,
      [gen('PAY'), r.guest_id, r.id, inv.rows[0].id, finalPaid, rand(['CASH', 'POS', 'TRANSFER', 'CARD']), ts(daysAgo(randInt(1, 30))), userId.reception]);
    const balance = roomCharge - finalPaid;
    await pool.query(
      `UPDATE invoices SET paid=$2, balance=$3, status=CASE WHEN $3::numeric<=0 THEN 'PAID' ELSE 'PARTIAL' END WHERE id=$1`,
      [inv.rows[0].id, finalPaid, balance]);
  }

  // ============ RESTAURANT ORDERS (historical + active) ============
  const itemNames = Object.keys(r1Items);
  for (let i = 0; i < 60; i++) {
    const rest = Math.random() < 0.7 ? r1 : r2;
    const t = await pool.query('SELECT * FROM restaurant_tables WHERE restaurant_id=$1 ORDER BY random() LIMIT 1', [rest]);
    const tid = t.rows[0].id;
    const nItems = randInt(1, 4);
    let subtotal = 0;
    const lines = [];
    for (let j = 0; j < nItems; j++) {
      const mi = await pool.query('SELECT * FROM menu_items WHERE restaurant_id=$1 ORDER BY random() LIMIT 1', [rest]);
      const qty = randInt(1, 3);
      subtotal += Number(mi.rows[0].price) * qty;
      lines.push({ mi: mi.rows[0], qty });
    }
    const restRow = await pool.query('SELECT * FROM restaurants WHERE id=$1', [rest]);
    const tax = subtotal * Number(restRow.rows[0].tax_rate) / 100;
    const total = subtotal + tax;
    // mostly paid/closed orders; a few open
    const isOpen = Math.random() < 0.15;
    const status = isOpen ? 'OPEN' : 'PAID';
    const created = ts(daysAgo(randInt(0, 30)));
    const o = await pool.query(
      `INSERT INTO orders (order_no, restaurant_id, table_id, status, subtotal, tax, total, payment_method, is_charged_to_room, created_at, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) RETURNING *`,
      [gen('ORD'), rest, tid, status, subtotal, tax, total, isOpen ? null : rand(['CASH', 'POS', 'TRANSFER', 'CARD']), false, created, userId.pos]);
    for (const l of lines) {
      await pool.query(
        `INSERT INTO order_items (order_id, menu_item_id, item_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [o.rows[0].id, l.mi.id, l.mi.name, l.qty, l.mi.price, l.mi.price * l.qty]);
    }
    if (status === 'PAID') {
      const inv = await pool.query(
        `INSERT INTO invoices (invoice_no, guest_id, order_id, invoice_type, subtotal, tax, total, paid, balance, status)
         VALUES ($1,null,$2,'RESTAURANT',$3,$4,$5,$5,0,'PAID') RETURNING *`,
        [gen('INV'), o.rows[0].id, subtotal, tax, total]);
      await pool.query(
        `INSERT INTO payments (payment_no, order_id, invoice_id, amount, method, category, note, created_at, received_by)
         VALUES ($1,$2,$3,$4,$5,'RESTAURANT','Restaurant sale',$6,$7)`,
        [gen('PAY'), o.rows[0].id, inv.rows[0].id, total, rand(['CASH', 'POS', 'TRANSFER', 'CARD']), created, userId.pos]);
      await pool.query("UPDATE restaurant_tables SET status='AVAILABLE' WHERE id=$1", [tid]);
    } else {
      await pool.query("UPDATE restaurant_tables SET status='OCCUPIED' WHERE id=$1", [tid]);
    }
  }

  // ============ CHARGE-TO-ROOM EXAMPLE: Ahmed Musa (Room 204) ============
  // Explicitly create Ahmed Musa so the demo scenario is guaranteed.
  // (Room 204 was excluded from the random reservation loop above.)
  const ahmedGuest = await pool.query(
    `SELECT id FROM guests WHERE full_name='Ahmed Musa' LIMIT 1`);
  let ahmedId;
  if (ahmedGuest.rows.length) {
    ahmedId = ahmedGuest.rows[0].id;
  } else {
    const ag = await pool.query(
      `INSERT INTO guests (full_name, phone, email, address, id_type, id_number, nationality)
       VALUES ('Ahmed Musa','08123456789','ahmed.musa@mail.com','12 Sultan Road, Kano','NIN','99988877766','Nigerian')
       RETURNING id`);
    ahmedId = ag.rows[0].id;
  }
  const ahmedRoom = roomId['204'];
  const ciA = daysAgo(2), coA = new Date(ciA); coA.setDate(coA.getDate() + 3);
  const rateA = 60000;
  const aRes = await pool.query(
    `INSERT INTO reservations (reservation_no, guest_id, room_id, check_in_date, check_out_date, adults, children, rate, discount, deposit, status, special_requests)
     VALUES ($1,$2,$3,$4,$5,2,1,$6,10000,100000,'CHECKED_IN','Business trip — express check-in requested') RETURNING *`,
    [gen('RES'), ahmedId, ahmedRoom, dateStr(ciA), dateStr(coA), rateA]);
  const ciA2 = new Date(ciA); ciA2.setHours(12, 0, 0, 0);
  await pool.query('INSERT INTO check_ins (reservation_id, guest_id, room_id, checkin_time, checked_in_by) VALUES ($1,$2,$3,$4,$5)', [aRes.rows[0].id, ahmedId, ahmedRoom, ts(ciA2), userId.reception]);
  await pool.query("UPDATE rooms SET status='OCCUPIED' WHERE id=$1", [ahmedRoom]);

  const aInv = await pool.query(
    `INSERT INTO invoices (invoice_no, guest_id, reservation_id, invoice_type, subtotal, total, paid, balance, status)
     VALUES ($1,$2,$3,'HOTEL',180000,180000,100000,80000,'PARTIAL') RETURNING *`,
    [gen('INV'), ahmedId, aRes.rows[0].id]);
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,'Room 3 nights × ₦60,000',3,60000,180000)`,
    [aInv.rows[0].id]);
  await pool.query(
    `INSERT INTO payments (payment_no, guest_id, reservation_id, invoice_id, amount, method, category, note, received_by)
     VALUES ($1,$2,$3,$4,100000,'TRANSFER','ROOM','Deposit - Bank transfer',$5)`,
    [gen('PAY'), ahmedId, aRes.rows[0].id, aInv.rows[0].id, userId.reception]);
  // Restaurant charge on folio
  await pool.query(
    `INSERT INTO invoice_items (invoice_id, description, quantity, unit_price, line_total)
     VALUES ($1,'Restaurant order ORD-XXXX — Jollof Rice × 2, Grilled Chicken × 2, Soft Drink × 3',1,15000,15000)`,
    [aInv.rows[0].id]);
  await pool.query(`UPDATE invoices SET subtotal=subtotal+15000, total=total+15000, balance=total-paid WHERE id=$1`, [aInv.rows[0].id]);

  // ============ EXPENSES ============
  const expCats = ['Food supplies', 'Electricity', 'Water', 'Maintenance', 'Salaries', 'Cleaning', 'Other'];
  for (let i = 0; i < 30; i++) {
    const cat = rand(expCats);
    await pool.query(
      `INSERT INTO expenses (category, description, amount, restaurant_id, paid_to, method, incurred_by, incurred_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)`,
      [cat, `${cat} expense ${i + 1}`, randInt(20000, 500000), Math.random() < 0.3 ? (Math.random() < 0.5 ? r1 : r2) : null,
       rand(['GTB', 'First Bank', 'UBA', 'Zenith', 'Cash']), rand(['CASH', 'TRANSFER', 'POS']), userId.account, ts(daysAgo(randInt(0, 30)))]);
  }

  // ============ PURCHASES ============
  for (let i = 0; i < 8; i++) {
    const sup = rand(suppliers);
    const pid = supplierId[sup];
    const invItems = await pool.query('SELECT * FROM inventory_items ORDER BY random() LIMIT 3');
    let total = 0;
    const purchase = await pool.query(
      `INSERT INTO purchases (purchase_no, supplier_id, total, payment_status, created_by)
       VALUES ($1,$2,0,$3,$4) RETURNING *`,
      [gen('PUR'), pid, rand(['PAID', 'UNPAID', 'PARTIAL']), userId.store]);
    for (const it of invItems.rows) {
      const qty = randInt(10, 100);
      const line = qty * Number(it.cost_price);
      total += line;
      await pool.query(
        `INSERT INTO purchase_items (purchase_id, item_id, item_name, quantity, unit_price, line_total)
         VALUES ($1,$2,$3,$4,$5,$6)`,
        [purchase.rows[0].id, it.id, it.name, qty, it.cost_price, line]);
      await pool.query(`UPDATE inventory_items SET quantity=quantity+$2 WHERE id=$1`, [it.id, qty]);
      await pool.query(`INSERT INTO inventory_transactions (item_id, type, quantity, ref_type, ref_id, note) VALUES ($1,'PURCHASE',$2,'purchases',$3,'Purchase receipt')`, [it.id, qty, purchase.rows[0].id]);
    }
    await pool.query(`UPDATE purchases SET total=$2 WHERE id=$1`, [purchase.rows[0].id, total]);
  }

  // ============ HOUSEKEEPING ============
  const roomsWithStatus = await pool.query('SELECT id, room_number, status FROM rooms');
  for (const rm of roomsWithStatus.rows) {
    const hkStatus = rm.status === 'CLEANING' ? 'CLEANING' : (rm.status === 'OCCUPIED' ? 'DIRTY' : 'CLEAN');
    const completed = (hkStatus === 'CLEAN' || hkStatus === 'INSPECTED') ? new Date() : null;
    await pool.query(
      `INSERT INTO housekeeping_tasks (room_id, status, assigned_to, completed_at)
       VALUES ($1,$2,$3,$4)`,
      [rm.id, hkStatus, userId.hskeeper, completed]);
  }

  console.log('✅ Seed complete.');
}

seed()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
