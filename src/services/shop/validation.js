export const MAX_IMAGE_BYTES = 512 * 1024;
export const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
export class ShopValidationError extends Error {
  constructor(fields) {
    super(Object.values(fields)[0]);
    this.name = 'ShopValidationError';
    this.fields = fields;
  }
}
export function safeImage(value) {
  if (typeof value !== 'string' || value.length > 750000) return '';
  if (/^data:image\/(png|jpeg|webp);base64,[a-z\d+/]+=*$/i.test(value))
    return value;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password
      ? url.href
      : '';
  } catch {
    return '';
  }
}
export function validateImageFile(file) {
  if (!file || !IMAGE_TYPES.includes(file.type))
    return 'Choose a JPG, PNG, or WebP image.';
  if (!file.size || file.size > MAX_IMAGE_BYTES)
    return 'Choose a non-empty image of 512 KB or less.';
  return '';
}
const text = (value) => (typeof value === 'string' ? value.trim() : '');
const numeric = (value) =>
  typeof value === 'number' ||
  (typeof value === 'string' && /^\d+(\.\d+)?$/.test(value.trim()));
export function validateRecord(kind, input, db, id) {
  const fields = {};
  const name = text(input.name),
    description = text(input.description),
    image = text(input.image);
  if (!name || name.length > 120)
    fields.name = 'Enter a name of 1–120 characters.';
  if (description.length > 4000 || (kind === 'products' && !description))
    fields.description = 'Enter a description of 1–4,000 characters.';
  if (!['active', 'inactive'].includes(input.status))
    fields.status = 'Choose active or inactive.';
  if (image && !safeImage(image))
    fields.image = 'Use a valid HTTPS image URL or a supported uploaded image.';
  const record = { name, description, image, status: input.status };
  if (kind === 'categories') {
    if (
      db.categories.some(
        (c) =>
          c.id !== id &&
          c.name.toLocaleLowerCase() === name.toLocaleLowerCase(),
      )
    )
      fields.name = 'A category with this name already exists.';
  } else {
    const price = Number(input.price),
      stock = Number(input.stock),
      shortDescription = text(input.shortDescription);
    if (
      !numeric(input.price) ||
      !Number.isFinite(price) ||
      price < 0 ||
      price > 10000000 ||
      Math.abs(price * 100 - Math.round(price * 100)) > 0.000001
    )
      fields.price =
        'Enter a price between ₹0 and ₹10,000,000 with at most two decimal places.';
    if (
      !numeric(input.stock) ||
      !Number.isSafeInteger(stock) ||
      stock < 0 ||
      stock > 1000000
    )
      fields.stock = 'Enter a whole stock quantity between 0 and 1,000,000.';
    if (shortDescription.length > 200)
      fields.shortDescription =
        'Keep the short description within 200 characters.';
    const category = db.categories.find((c) => c.id === input.categoryId);
    if (!category) fields.categoryId = 'Select an existing category.';
    Object.assign(record, {
      price: Math.round(price * 100) / 100,
      stock,
      categoryId: input.categoryId,
      shortDescription,
    });
  }
  if (Object.keys(fields).length) throw new ShopValidationError(fields);
  return record;
}
// Damaged individual records are repairable in admin, but never published accidentally.
export function normalizeDatabase(raw) {
  if (!raw || !Array.isArray(raw.products) || !Array.isArray(raw.categories))
    throw new Error(
      'Shop data is unreadable. Your saved data has been preserved; restore a valid local store to continue.',
    );
  const normalize = (records, kind) => {
    const ids = new Set();
    return records
      .filter(
        (r) =>
          r &&
          typeof r.id === 'string' &&
          r.id &&
          !ids.has(r.id) &&
          ids.add(r.id),
      )
      .map((r) => {
        const name = text(r.name),
          description = text(r.description);
        const record = {
          id: r.id,
          name: name || 'Untitled',
          description,
          image: safeImage(r.image),
          status: name && r.status === 'active' ? 'active' : 'inactive',
          createdAt: typeof r.createdAt === 'string' ? r.createdAt : '',
          updatedAt: typeof r.updatedAt === 'string' ? r.updatedAt : '',
        };
        if (kind === 'products') {
          const validPrice =
            typeof r.price === 'number' &&
            Number.isFinite(r.price) &&
            r.price >= 0 &&
            r.price <= 10000000;
          const validStock =
            Number.isSafeInteger(r.stock) && r.stock >= 0 && r.stock <= 1000000;
          Object.assign(record, {
            price: validPrice ? Math.round(r.price * 100) / 100 : 0,
            stock: validStock ? r.stock : 0,
            categoryId: text(r.categoryId),
            shortDescription: text(r.shortDescription),
          });
          if (!validPrice || !validStock || !description)
            record.status = 'inactive';
        }
        return record;
      });
  };
  return {
    version: 1,
    products: normalize(raw.products, 'products'),
    categories: normalize(raw.categories, 'categories'),
  };
}
