import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { createShopRepository } from '../src/services/shop/repository.js';
import { notifyShopChanged, subscribeShopChanges } from '../src/services/shop/events.js';
import {
  createLocalShopStorage,
  SHOP_STORAGE_KEY,
} from '../src/services/shop/storage.js';
import {
  MAX_IMAGE_BYTES,
  normalizeDatabase,
  safeImage,
  validateImageFile,
} from '../src/services/shop/validation.js';
const json = (file) =>
  JSON.parse(
    fs.readFileSync(new URL(`../src/data/${file}`, import.meta.url), 'utf8'),
  );
const seed = {
  version: 1,
  products: json('shop-products.json'),
  categories: json('shop-categories.json'),
};
const product = {
  name: 'Test serum',
  description: 'A moisturising everyday serum.',
  shortDescription: 'Daily hydration.',
  image: '',
  price: 450.75,
  stock: 10,
  categoryId: 'cat_skin',
  status: 'active',
};
function fixture(data = seed) {
  let db = structuredClone(data),
    sequence = 0,
    events = 0;
  const repo = createShopRepository({
    read: () => structuredClone(db),
    write: (value) => {
      db = structuredClone(value);
    },
    changed: () => events++,
    makeId: (kind) => `${kind}_test_${++sequence}`,
    now: () => '2026-10-14T10:00:00Z',
  });
  return { ...repo, db: () => db, events: () => events };
}
function storageFixture(saved = null, fail = false) {
  let value = saved,
    writes = 0;
  const adapter = createLocalShopStorage({
    seed,
    storage: () => ({
      getItem: (key) => {
        assert.equal(key, SHOP_STORAGE_KEY);
        return value;
      },
      setItem: (key, data) => {
        assert.equal(key, SHOP_STORAGE_KEY);
        if (fail) throw new Error('Quota');
        value = data;
        writes++;
      },
    }),
  });
  return { ...adapter, value: () => value, writes: () => writes };
}

test('shop seeds have unique IDs, valid categories, and workflow examples', () => {
  for (const records of [seed.products, seed.categories])
    assert.equal(new Set(records.map((r) => r.id)).size, records.length);
  assert.ok(
    seed.products.every((p) =>
      seed.categories.some((c) => c.id === p.categoryId),
    ),
  );
  assert.ok(seed.products.some((p) => p.stock === 0 && p.status === 'active'));
  assert.ok(seed.products.some((p) => p.status === 'inactive'));
  assert.ok(seed.categories.some((c) => c.status === 'inactive'));
});
test('local storage seeds only once and never overwrites browser edits or empty datasets', () => {
  const store = storageFixture();
  assert.deepEqual(store.read(), seed);
  assert.equal(store.writes(), 1);
  const empty = { version: 1, products: [], categories: [] };
  store.write(empty);
  assert.deepEqual(store.read(), empty);
  assert.equal(store.writes(), 2);
  assert.deepEqual(storageFixture(JSON.stringify(empty)).read(), empty);
});
test('corrupt or unsupported saved data is preserved and produces an error', () => {
  for (const data of [
    '{broken',
    'null',
    '{"version":2,"products":[],"categories":[]}',
  ]) {
    const store = storageFixture(data);
    assert.throws(() => store.read(), /preserved/);
    assert.equal(store.value(), data);
    assert.equal(store.writes(), 0);
  }
});
test('storage quotas and disabled storage do not silently succeed', () => {
  const store = storageFixture(JSON.stringify(seed), true);
  assert.throws(
    () => store.write({ ...seed, products: [] }),
    /could not be saved/,
  );
  assert.deepEqual(JSON.parse(store.value()), seed);
  assert.throws(() => storageFixture(null, true).read(), /could not be saved/);
  assert.throws(
    () =>
      createLocalShopStorage({
        seed,
        storage: () => {
          throw new Error('Disabled');
        },
      }).read(),
    /could not be saved/,
  );
});
test('public catalog excludes inactive products, inactive categories, and orphaned references', async () => {
  const f = fixture({
    ...seed,
    products: [
      ...seed.products,
      { ...product, id: 'orphan', categoryId: 'gone' },
    ],
  });
  const listed = await f.products.list({ publicOnly: true, pageSize: 100 });
  assert.equal(listed.total, 12);
  assert.ok(listed.data.every((p) => p.isPublic));
  for (const id of ['prod_013', 'prod_014', 'orphan'])
    await assert.rejects(
      f.products.get(id, { publicOnly: true }),
      /no longer available/,
    );
  assert.equal((await f.products.get('orphan')).categoryStatus, 'missing');
});
test('search, category, inclusive price bounds, availability, sorting and pagination combine', async () => {
  const f = fixture();
  const result = await f.products.list({
    publicOnly: true,
    search: '  hair  ',
    categoryId: 'cat_hair',
    minPrice: 690,
    maxPrice: 980,
    availability: 'in_stock',
    sort: 'price_asc',
    pageSize: 1,
    page: 2,
  });
  assert.equal(result.total, 2);
  assert.equal(result.data[0].id, 'prod_003');
  assert.equal(result.totalPages, 2);
  assert.equal(
    (await f.products.list({ minPrice: 790, maxPrice: 790 })).data[0].id,
    'prod_003',
  );
  assert.equal(
    (await f.products.list({ publicOnly: true, availability: 'out_of_stock' }))
      .total,
    2,
  );
  assert.equal((await f.products.list({ search: 'no such item' })).total, 0);
});
test('category search, status and count ordering work', async () => {
  const f = fixture();
  assert.equal(
    (await f.categories.list({ search: 'limited', status: 'inactive' })).data[0]
      .id,
    'cat_seasonal',
  );
  const counts = await f.categories.list({ sort: 'count_desc' });
  assert.equal(counts.data[0].productCount, 3);
  assert.equal(
    counts.data.find((c) => c.id === 'cat_body').publicProductCount,
    2,
  );
  assert.equal(
    counts.data.find((c) => c.id === 'cat_seasonal').publicProductCount,
    0,
  );
});
test('pagination clamps invalid or out-of-range pages and handles empty collections', async () => {
  const f = fixture();
  const last = await f.products.list({ page: 999, pageSize: 8 });
  assert.equal(last.page, 2);
  assert.equal(last.data.length, 6);
  assert.equal((await f.products.list({ page: -1, pageSize: 0 })).page, 1);
  const empty = await fixture({ products: [], categories: [] }).products.list({
    page: 5,
  });
  assert.equal(empty.total, 0);
  assert.equal(empty.page, 1);
  assert.equal(empty.totalPages, 1);
});
test('CRUD creates unique IDs, protects identity, supports partial updates and persists deletion', async () => {
  const f = fixture();
  const a = await f.products.create({
      ...product,
      id: 'injected',
      name: '  Test serum  ',
    }),
    b = await f.products.create(product);
  assert.notEqual(a.id, b.id);
  assert.notEqual(a.id, 'injected');
  assert.equal(a.name, 'Test serum');
  assert.equal(a.price, 450.75);
  const edited = await f.products.update(a.id, {
    name: 'Edited serum',
    id: 'spoofed',
    createdAt: 'fake',
    stock: 0,
  });
  assert.equal(edited.id, a.id);
  assert.equal(edited.createdAt, a.createdAt);
  assert.equal(edited.stock, 0);
  assert.equal((await f.products.get(a.id)).name, 'Edited serum');
  await f.products.remove(a.id);
  await assert.rejects(f.products.get(a.id), /no longer available/);
  assert.equal(f.events(), 4);
  await assert.rejects(f.products.update('missing', product));
  await assert.rejects(f.products.remove('missing'));
});
test('invalid product writes reject field errors without changing data', async () => {
  const f = fixture(),
    before = structuredClone(f.db());
  for (const patch of [
    { name: '   ' },
    { description: '' },
    { price: -1 },
    { price: '' },
    { price: Infinity },
    { price: true },
    { price: [] },
    { price: 1.001 },
    { stock: 1.5 },
    { stock: -1 },
    { stock: '' },
    { stock: false },
    { categoryId: 'gone' },
    { status: 'pending' },
    { image: 'javascript:alert(1)' },
    { shortDescription: 'x'.repeat(201) },
  ]) {
    await assert.rejects(f.products.create({ ...product, ...patch }), (error) =>
      Boolean(error.fields),
    );
  }
  assert.deepEqual(f.db(), before);
  assert.equal(f.events(), 0);
});
test('category creation, duplicate-name protection, deactivation, and safe deletion', async () => {
  const f = fixture();
  const c = await f.categories.create({
    name: 'New collection',
    description: '',
    image: '',
    status: 'active',
  });
  await assert.rejects(
    f.categories.create({ ...c, name: ' new COLLECTION ' }),
    /already exists/,
  );
  await assert.rejects(f.categories.remove('cat_skin'), /Reassign/);
  await f.categories.update('cat_skin', { status: 'inactive' });
  assert.equal(
    (await f.products.list({ publicOnly: true, categoryId: 'cat_skin' })).total,
    0,
  );
  await f.categories.update('cat_skin', { status: 'active' });
  assert.equal(
    (await f.products.list({ publicOnly: true, categoryId: 'cat_skin' })).total,
    3,
  );
  await f.categories.remove(c.id);
  await assert.rejects(f.categories.get(c.id));
});
test('reassigning products allows formerly assigned categories to be deleted', async () => {
  const f = fixture();
  for (const p of seed.products.filter((p) => p.categoryId === 'cat_skin'))
    await f.products.update(p.id, { categoryId: 'cat_body' });
  await f.categories.remove('cat_skin');
  assert.ok(
    f
      .db()
      .products.every((p) =>
        f.db().categories.some((c) => c.id === p.categoryId),
      ),
  );
});
test('missing or invalid record fields remain repairable and hidden publicly', async () => {
  const f = fixture({
    categories: seed.categories,
    products: [
      {
        id: 'damaged',
        name: 'Damaged',
        status: 'active',
        categoryId: 'cat_skin',
      },
      null,
      { id: 'damaged', name: 'Duplicate' },
    ],
  });
  assert.equal((await f.products.list()).total, 1);
  assert.equal((await f.products.get('damaged')).status, 'inactive');
  assert.equal((await f.products.list({ publicOnly: true })).total, 0);
  await f.products.update('damaged', product);
  assert.equal((await f.products.list({ publicOnly: true })).total, 1);
  assert.throws(
    () => normalizeDatabase({ products: null, categories: [] }),
    /preserved/,
  );
});
test('failed persistence does not emit a change or return success', async () => {
  let emitted = false;
  const f = createShopRepository({
    read: () => structuredClone(seed),
    write: () => {
      throw new Error('Quota exceeded');
    },
    changed: () => {
      emitted = true;
    },
  });
  await assert.rejects(f.products.create(product), /Quota/);
  assert.equal(emitted, false);
});
test('read results cannot mutate the underlying store', async () => {
  const f = fixture(),
    result = await f.products.list();
  result.data[0].name = 'Injected';
  assert.notEqual((await f.products.get(result.data[0].id)).name, 'Injected');
});
test('image type, size, URL and data validation', () => {
  assert.equal(
    validateImageFile({ type: 'image/png', size: MAX_IMAGE_BYTES }),
    '',
  );
  for (const file of [
    { type: 'image/svg+xml', size: 100 },
    { type: 'image/jpeg', size: 0 },
    { type: 'image/png', size: MAX_IMAGE_BYTES + 1 },
  ])
    assert.ok(validateImageFile(file));
  assert.equal(
    safeImage('https://example.com/image.png'),
    'https://example.com/image.png',
  );
  assert.equal(
    safeImage('data:image/png;base64,aGVsbG8='),
    'data:image/png;base64,aGVsbG8=',
  );
  for (const value of [
    'javascript:alert(1)',
    'http://example.com/x',
    'data:image/svg+xml;base64,PHN2Zz4=',
    'https://user:pass@example.com/x',
    null,
  ])
    assert.equal(safeImage(value), '');
});

test('shop subscriptions handle same-tab and cross-tab changes and clean up listeners', () => {
  const previous = globalThis.window;
  globalThis.window = new EventTarget();
  try {
    let changes = 0;
    const unsubscribe = subscribeShopChanges(() => changes++);
    const storageEvent = key => {
      const event = new Event('storage');
      Object.defineProperty(event, 'key', { value: key });
      window.dispatchEvent(event);
    };
    storageEvent('unrelated_key'); assert.equal(changes, 0);
    storageEvent(SHOP_STORAGE_KEY); assert.equal(changes, 1);
    storageEvent(null); assert.equal(changes, 2);
    notifyShopChanged(); assert.equal(changes, 3);
    unsubscribe(); notifyShopChanged(); storageEvent(SHOP_STORAGE_KEY);
    assert.equal(changes, 3);
  } finally {
    if (previous === undefined) delete globalThis.window;
    else globalThis.window = previous;
  }
});
