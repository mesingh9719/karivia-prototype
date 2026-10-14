import { ShopValidationError, safeImage } from './validation.js';

export const ORDER_STATUSES = [
  'pending',
  'confirmed',
  'processing',
  'shipped',
  'delivered',
  'cancelled',
];
export const ORDER_TRANSITIONS = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['processing', 'cancelled'],
  processing: ['shipped', 'cancelled'],
  shipped: ['delivered'],
  delivered: [],
  cancelled: [],
};
export const canCustomerCancel = (order) =>
  !order.needsReview && ['pending', 'confirmed'].includes(order.status);
export const cents = (value) => Math.round(Number(value) * 100);
const dayFormatter = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Asia/Kolkata',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});
export function orderDay(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  const parts = Object.fromEntries(
    dayFormatter.formatToParts(date).map((part) => [part.type, part.value]),
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}
const text = (value) => (typeof value === 'string' ? value.trim() : '');

export function validateDelivery(input) {
  const customer = Object.fromEntries(
    ['name', 'email', 'phone', 'address', 'city', 'postalCode', 'country'].map(
      (key) => [key, text(input?.[key])],
    ),
  );
  const fields = {};
  if (!customer.name || customer.name.length > 120)
    fields.name = 'Enter your full name (up to 120 characters).';
  if (
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customer.email) ||
    customer.email.length > 254
  )
    fields.email = 'Enter a valid email address.';
  if (
    !/^[+\d\s()-]+$/.test(customer.phone) ||
    customer.phone.replace(/\D/g, '').length < 7 ||
    customer.phone.replace(/\D/g, '').length > 15 ||
    customer.phone.length > 24
  )
    fields.phone = 'Enter a valid phone number.';
  if (customer.address.length < 5 || customer.address.length > 400)
    fields.address = 'Enter a delivery address of 5–400 characters.';
  if (!customer.city || customer.city.length > 100)
    fields.city = 'Enter your city (up to 100 characters).';
  if (!/^[1-9]\d{5}$/.test(customer.postalCode))
    fields.postalCode = 'Enter a six-digit Indian PIN code.';
  if (customer.country !== 'India')
    fields.country = 'Delivery is currently available within India.';
  if (Object.keys(fields).length) throw new ShopValidationError(fields);
  return customer;
}

export function normalizeOrders(records) {
  if (records === undefined) return [];
  if (!Array.isArray(records))
    throw new Error(
      'Saved orders could not be read. Your local data has been preserved.',
    );
  const seen = new Set();
  return records
    .filter(
      (r) =>
        r &&
        typeof r.id === 'string' &&
        r.id &&
        !seen.has(r.id) &&
        seen.add(r.id),
    )
    .map((r) => {
      const rawItems = Array.isArray(r.items) ? r.items : [];
      const valid = rawItems.filter(
        (item) =>
          item &&
          typeof item.productId === 'string' &&
          Number.isSafeInteger(item.quantity) &&
          item.quantity > 0 &&
          item.quantity <= 99 &&
          typeof item.unitPrice === 'number' &&
          Number.isFinite(item.unitPrice) &&
          item.unitPrice >= 0 &&
          item.unitPrice <= 10000000,
      );
      const items = valid.map((item) => ({
        productId: item.productId,
        name: text(item.name) || 'Purchased product',
        image: safeImage(item.image),
        quantity: item.quantity,
        unitPrice: cents(item.unitPrice) / 100,
        lineTotal: (cents(item.unitPrice) * item.quantity) / 100,
      }));
      const subtotal =
        items.reduce(
          (sum, item) => sum + cents(item.unitPrice) * item.quantity,
          0,
        ) / 100;
      const needsReview =
        !items.length ||
        valid.length !== rawItems.length ||
        new Set(items.map((item) => item.productId)).size !== items.length ||
        !ORDER_STATUSES.includes(r.status) ||
        !text(r.customerId) ||
        !text(r.customer?.name);
      return {
        id: r.id,
        number: text(r.number) || r.id,
        customerId: text(r.customerId),
        customer: Object.fromEntries(
          [
            'name',
            'email',
            'phone',
            'address',
            'city',
            'postalCode',
            'country',
          ].map((key) => [key, text(r.customer?.[key])]),
        ),
        items,
        subtotal,
        shipping: 0,
        total: subtotal,
        status: needsReview ? 'needs_review' : r.status,
        needsReview,
        paymentMethod: 'cod',
        paymentStatus: r.status === 'delivered' ? 'paid' : 'unpaid',
        notes: text(r.notes),
        adminNotes: text(r.adminNotes),
        trackingNumber: text(r.trackingNumber),
        stockRestored: r.stockRestored === true,
        requestToken: text(r.requestToken),
        history: (Array.isArray(r.history) ? r.history : [])
          .filter(
            (h) =>
              h &&
              ORDER_STATUSES.includes(h.status) &&
              typeof h.at === 'string',
          )
          .map((h) => ({ status: h.status, at: h.at })),
        createdAt: text(r.createdAt),
        updatedAt: text(r.updatedAt),
      };
    });
}

export function normalizeCarts(value) {
  if (value === undefined) return {};
  if (!value || typeof value !== 'object' || Array.isArray(value))
    throw new Error(
      'Saved carts could not be read. Your local data has been preserved.',
    );
  return Object.fromEntries(
    Object.entries(value)
      .filter(
        ([id, items]) =>
          /^[a-zA-Z0-9_-]{1,100}$/.test(id) &&
          !['__proto__', 'constructor', 'prototype'].includes(id) &&
          Array.isArray(items),
      )
      .map(([id, items]) => {
        const combined = new Map();
        for (const item of items)
          if (
            item &&
            typeof item.productId === 'string' &&
            Number.isSafeInteger(item.quantity) &&
            item.quantity > 0
          )
            combined.set(
              item.productId,
              Math.min(99, (combined.get(item.productId) || 0) + item.quantity),
            );
        return [
          id,
          [...combined]
            .slice(0, 100)
            .map(([productId, quantity]) => ({ productId, quantity })),
        ];
      }),
  );
}
