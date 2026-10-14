import { paginate } from './query.js';
import { ShopValidationError } from './validation.js';
import {
  ORDER_STATUSES,
  ORDER_TRANSITIONS,
  canCustomerCancel,
  cents,
  validateDelivery,
  orderDay,
} from './orderRules.js';

export function createOrderRepository({ load, commit, enrich, makeId, now }) {
  function identity(db, accountId) {
    if (accountId) {
      if (
        !/^[a-zA-Z0-9_-]{1,100}$/.test(accountId) ||
        ['__proto__', 'constructor', 'prototype'].includes(accountId)
      )
        throw new Error('Invalid customer identity.');
      return accountId;
    }
    if (!db.guestCustomerId) {
      db.guestCustomerId = makeId('guest');
      commit(db);
    }
    return db.guestCustomerId;
  }
  function quote(db, customerId) {
    const products = new Map(enrich(db).map((p) => [p.id, p]));
    const items = (db.carts[customerId] || []).map((item) => {
      const product = products.get(item.productId);
      const issue =
        !product || !product.isPublic
          ? 'This product is no longer available. Remove it to continue.'
          : product.stock < item.quantity
            ? `Only ${product.stock} available. Adjust the quantity to continue.`
            : '';
      return {
        ...item,
        name: product?.name || 'Unavailable product',
        image: product?.image || '',
        categoryName: product?.categoryName || '',
        unitPrice: product?.price || 0,
        stock: product?.stock || 0,
        maxQuantity: product?.isPublic ? Math.min(99, product.stock) : 0,
        available: !issue,
        issue,
        lineTotal: (cents(product?.price || 0) * item.quantity) / 100,
      };
    });
    return {
      customerId,
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal:
        items.reduce(
          (sum, item) => sum + cents(item.unitPrice) * item.quantity,
          0,
        ) / 100,
      canCheckout: items.length > 0 && items.every((item) => item.available),
    };
  }
  function validQuantity(quantity) {
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 99)
      throw new Error('Choose a whole quantity between 1 and 99.');
  }
  function productForCart(db, productId, quantity) {
    validQuantity(quantity);
    const product = enrich(db).find((p) => p.id === productId);
    if (!product?.isPublic)
      throw new Error('This product is no longer available in the shop.');
    if (product.stock < quantity)
      throw new Error(
        product.stock
          ? `Only ${product.stock} of ${product.name} are available.`
          : `${product.name} is out of stock.`,
      );
    return product;
  }
  const cart = {
    async get({ accountId } = {}) {
      const db = load(),
        customerId = identity(db, accountId);
      return quote(db, customerId);
    },
    async add(productId, quantity = 1, { accountId } = {}) {
      validQuantity(quantity);
      const db = load(),
        customerId = identity(db, accountId),
        items = db.carts[customerId] || [];
      const existing = items.find((item) => item.productId === productId);
      const next = (existing?.quantity || 0) + quantity;
      productForCart(db, productId, next);
      if (!existing && items.length >= 100)
        throw new Error('Your cart can contain up to 100 different products.');
      if (existing) existing.quantity = next;
      else items.push({ productId, quantity });
      db.carts[customerId] = items;
      commit(db);
      return quote(db, customerId);
    },
    async update(productId, quantity, { accountId } = {}) {
      const db = load(),
        customerId = identity(db, accountId),
        items = db.carts[customerId] || [];
      const item = items.find((item) => item.productId === productId);
      if (!item) throw new Error('This product is no longer in your cart.');
      productForCart(db, productId, quantity);
      item.quantity = quantity;
      commit(db);
      return quote(db, customerId);
    },
    async remove(productId, { accountId } = {}) {
      const db = load(),
        customerId = identity(db, accountId);
      db.carts[customerId] = (db.carts[customerId] || []).filter(
        (item) => item.productId !== productId,
      );
      commit(db);
      return quote(db, customerId);
    },
    async clear({ accountId } = {}) {
      const db = load(),
        customerId = identity(db, accountId);
      db.carts[customerId] = [];
      commit(db);
      return quote(db, customerId);
    },
  };
  const findOrder = (db, id, customerId) => {
    const order = db.orders.find(
      (order) =>
        order.id === id && (!customerId || order.customerId === customerId),
    );
    if (!order) throw new Error('This order is no longer available.');
    return order;
  };
  function updateOrder(db, order, patch) {
    if (!patch || typeof patch !== 'object')
      throw new Error('Enter valid order changes.');
    if (order.needsReview)
      throw new Error(
        'This order contains incomplete data and cannot be changed.',
      );
    const nextStatus = patch.status ?? order.status;
    if (
      nextStatus !== order.status &&
      !(ORDER_TRANSITIONS[order.status] || []).includes(nextStatus)
    )
      throw new Error(
        'That status change is not available for this order. Reload to see its current status.',
      );
    const adminNotes =
      patch.adminNotes === undefined
        ? order.adminNotes
        : String(patch.adminNotes).trim();
    const trackingNumber =
      patch.trackingNumber === undefined
        ? order.trackingNumber
        : String(patch.trackingNumber).trim();
    if (adminNotes.length > 1000 || trackingNumber.length > 100)
      throw new Error(
        'Keep internal notes within 1,000 characters and tracking numbers within 100 characters.',
      );
    if (
      order.status !== 'cancelled' &&
      nextStatus === 'cancelled' &&
      !order.stockRestored
    ) {
      for (const item of order.items) {
        const product = db.products.find((p) => p.id === item.productId);
        if (product && product.stock + item.quantity > 1000000)
          throw new Error(
            `Stock for ${product.name} would exceed its limit. Adjust stock before cancelling.`,
          );
      }
      for (const item of order.items) {
        const product = db.products.find((p) => p.id === item.productId);
        if (product) {
          product.stock += item.quantity;
          product.updatedAt = now();
        }
      }
      order.stockRestored = true;
    }
    if (nextStatus !== order.status)
      order.history.push({ status: nextStatus, at: now() });
    Object.assign(order, {
      status: nextStatus,
      adminNotes,
      trackingNumber,
      paymentStatus: nextStatus === 'delivered' ? 'paid' : 'unpaid',
      updatedAt: now(),
    });
    commit(db);
    return structuredClone(order);
  }
  const orders = {
    async list({
      accountId,
      customerOnly = false,
      search = '',
      status = '',
      paymentStatus = '',
      sort = 'newest',
      page = 1,
      pageSize = 8,
      minDate = '',
      maxDate = '',
    } = {}) {
      const db = load(),
        customerId = customerOnly ? identity(db, accountId) : null;
      const scoped = db.orders.filter(
        (order) => !customerOnly || order.customerId === customerId,
      );
      const term = String(search).trim().toLowerCase();
      const filtered = scoped.filter(
        (order) =>
          (!status || order.status === status) &&
          (!paymentStatus || order.paymentStatus === paymentStatus) &&
          (!minDate || orderDay(order.createdAt) >= minDate) &&
          (!maxDate || orderDay(order.createdAt) <= maxDate) &&
          (!term ||
            [
              order.number,
              order.customer.name,
              order.customer.email,
              ...order.items.map((item) => item.name),
            ]
              .join(' ')
              .toLowerCase()
              .includes(term)),
      );
      const compare = {
        newest: (a, b) => b.createdAt.localeCompare(a.createdAt),
        oldest: (a, b) => a.createdAt.localeCompare(b.createdAt),
        total_asc: (a, b) => a.total - b.total,
        total_desc: (a, b) => b.total - a.total,
      };
      filtered.sort(
        (a, b) =>
          (compare[sort] || compare.newest)(a, b) || a.id.localeCompare(b.id),
      );
      const publicOrder = (order) => {
        const copy = structuredClone(order);
        if (customerOnly) {
          delete copy.adminNotes;
          delete copy.requestToken;
        }
        return copy;
      };
      return {
        ...paginate(filtered.map(publicOrder), { page, pageSize }),
        summary: {
          total: scoped.length,
          pending: scoped.filter((o) => o.status === 'pending').length,
          open: scoped.filter((o) =>
            ['confirmed', 'processing', 'shipped'].includes(o.status),
          ).length,
          delivered: scoped.filter((o) => o.status === 'delivered').length,
          completedValue:
            scoped
              .filter((o) => o.status === 'delivered')
              .reduce((sum, o) => sum + cents(o.total), 0) / 100,
        },
      };
    },
    async get(id, { accountId, customerOnly = false } = {}) {
      const db = load(),
        order = structuredClone(
          findOrder(db, id, customerOnly ? identity(db, accountId) : null),
        );
      if (customerOnly) {
        delete order.adminNotes;
        delete order.requestToken;
      }
      return order;
    },
    async create(input, { accountId } = {}) {
      if (!input || typeof input !== 'object')
        throw new Error('Enter valid checkout details.');
      const db = load(),
        customerId = identity(db, accountId);
      if (
        typeof input.requestToken !== 'string' ||
        !/^[a-zA-Z0-9_-]{8,100}$/.test(input.requestToken)
      )
        throw new Error('Please reopen checkout to start a new order.');
      const prior = db.orders.find(
        (order) =>
          order.customerId === customerId &&
          order.requestToken === input.requestToken,
      );
      if (prior) return structuredClone(prior);
      const customer = validateDelivery(input.customer),
        notes = typeof input.notes === 'string' ? input.notes.trim() : '';
      if (notes.length > 500)
        throw new ShopValidationError({
          notes: 'Keep delivery notes within 500 characters.',
        });
      if (input.paymentMethod !== 'cod')
        throw new Error('Choose cash on delivery for this prototype.');
      const current = quote(db, customerId);
      if (!current.items.length)
        throw new Error(
          'Your cart is empty. Add some products before placing an order.',
        );
      if (!current.canCheckout)
        throw new Error(
          'Some products are unavailable or have insufficient stock. Review your cart to continue.',
        );
      const reviewed = Array.isArray(input.items) ? input.items : [];
      if (
        reviewed.length !== current.items.length ||
        current.items.some(
          (item) =>
            !reviewed.some(
              (r) =>
                r &&
                r.productId === item.productId &&
                r.quantity === item.quantity &&
                cents(r.unitPrice) === cents(item.unitPrice),
            ),
        )
      )
        throw new Error(
          'Your cart or prices changed. Review the updated order summary and try again.',
        );
      const timestamp = now(),
        id = makeId('ord');
      const items = current.items.map((item) => ({
        productId: item.productId,
        name: item.name,
        image: item.image,
        unitPrice: item.unitPrice,
        quantity: item.quantity,
        lineTotal: item.lineTotal,
      }));
      const order = {
        id,
        number: `KRV-${timestamp.slice(0, 10).replaceAll('-', '')}-${id.slice(-8).toUpperCase()}`,
        customerId,
        customer,
        items,
        subtotal: current.subtotal,
        shipping: 0,
        total: current.subtotal,
        status: 'pending',
        paymentMethod: 'cod',
        paymentStatus: 'unpaid',
        notes,
        adminNotes: '',
        trackingNumber: '',
        stockRestored: false,
        requestToken: input.requestToken,
        history: [{ status: 'pending', at: timestamp }],
        createdAt: timestamp,
        updatedAt: timestamp,
      };
      for (const item of items) {
        const product = db.products.find((p) => p.id === item.productId);
        product.stock -= item.quantity;
        product.updatedAt = timestamp;
      }
      db.orders.unshift(order);
      db.carts[customerId] = [];
      commit(db);
      return structuredClone(order);
    },
    async update(id, patch) {
      const db = load();
      return updateOrder(db, findOrder(db, id), patch);
    },
    async cancel(id, { accountId } = {}) {
      const db = load(),
        customerId = identity(db, accountId),
        order = findOrder(db, id, customerId);
      if (!canCustomerCancel(order))
        throw new Error(
          'This order can no longer be cancelled. Only pending or confirmed orders can be cancelled.',
        );
      const result = updateOrder(db, order, { status: 'cancelled' });
      delete result.adminNotes;
      delete result.requestToken;
      return result;
    },
  };
  return { cart, orders };
}
