import products from '../../data/shop-products.json';
import categories from '../../data/shop-categories.json';
import orders from '../../data/shop-orders.json';
import { createShopRepository } from './repository.js';
import { createLocalShopStorage } from './storage.js';
import { notifyShopChanged } from './events.js';
const storage = createLocalShopStorage({
  storage: () => window.localStorage,
  seed: {
    version: 1,
    products,
    categories,
    orders,
    carts: {},
    guestCustomerId: '',
  },
});
export const localShopRepository = createShopRepository({
  ...storage,
  changed: notifyShopChanged,
});
