import { queryRecords } from './query.js';
import { normalizeDatabase, validateRecord } from './validation.js';
import { normalizeOrders, normalizeCarts } from './orderRules.js';
import { createOrderRepository } from './orderRepository.js';

// The storage adapter is injected. UI and services have no browser-storage dependency.
export function createShopRepository({
  read,
  write,
  changed = () => {},
  makeId = (kind) => `${kind}_${crypto.randomUUID()}`,
  now = () => new Date().toISOString(),
}) {
  const load = () => {
    const raw = read();
    return {
      ...normalizeDatabase(raw),
      orders: normalizeOrders(raw.orders),
      carts: normalizeCarts(raw.carts),
      guestCustomerId:
        typeof raw.guestCustomerId === 'string' &&
        /^guest_[a-zA-Z0-9_-]+$/.test(raw.guestCustomerId)
          ? raw.guestCustomerId
          : '',
    };
  };
  const commit = (db) => {
    write(db);
    changed();
  };
  const enrich = (db) => {
    const categories = new Map(db.categories.map((c) => [c.id, c]));
    return db.products.map((p) => ({
      ...p,
      categoryName: categories.get(p.categoryId)?.name || 'Unassigned category',
      categoryStatus: categories.get(p.categoryId)?.status || 'missing',
      isPublic:
        p.status === 'active' &&
        categories.get(p.categoryId)?.status === 'active',
    }));
  };
  const collection = (kind) => ({
    async list(params = {}) {
      const db = load(),
        products = enrich(db);
      const counts = new Map();
      if (kind === 'categories')
        for (const p of products) {
          const count = counts.get(p.categoryId) || {
            productCount: 0,
            publicProductCount: 0,
          };
          count.productCount++;
          if (p.isPublic) count.publicProductCount++;
          counts.set(p.categoryId, count);
        }
      const items =
        kind === 'products'
          ? products.filter((p) => !params.publicOnly || p.isPublic)
          : db.categories.map((c) => ({
              ...c,
              productCount: 0,
              publicProductCount: 0,
              ...counts.get(c.id),
            }));
      return queryRecords(items, params, kind);
    },
    async get(id, { publicOnly = false } = {}) {
      const db = load(),
        items = kind === 'products' ? enrich(db) : db.categories;
      const record = items.find(
        (r) =>
          r.id === id &&
          (!publicOnly ||
            (kind === 'products' ? r.isPublic : r.status === 'active')),
      );
      if (!record) throw new Error('This record is no longer available.');
      return structuredClone(record);
    },
    async create(input) {
      const db = load(),
        record = {
          ...validateRecord(kind, input, db),
          id: makeId(kind),
          createdAt: now(),
          updatedAt: now(),
        };
      db[kind].push(record);
      commit(db);
      return structuredClone(record);
    },
    async update(id, patch) {
      const db = load(),
        index = db[kind].findIndex((r) => r.id === id);
      if (index < 0) throw new Error('This record is no longer available.');
      const current = db[kind][index];
      const record = {
        ...validateRecord(kind, { ...current, ...patch }, db, id),
        id,
        createdAt: current.createdAt,
        updatedAt: now(),
      };
      db[kind][index] = record;
      commit(db);
      return structuredClone(record);
    },
    async remove(id) {
      const db = load();
      if (!db[kind].some((r) => r.id === id))
        throw new Error('This record is no longer available.');
      if (kind === 'categories' && db.products.some((p) => p.categoryId === id))
        throw new Error(
          'Reassign all products in this category before deleting it.',
        );
      db[kind] = db[kind].filter((r) => r.id !== id);
      commit(db);
      return { success: true };
    },
  });
  return {
    products: collection('products'),
    categories: collection('categories'),
    ...createOrderRepository({ load, commit, enrich, makeId, now }),
  };
}
