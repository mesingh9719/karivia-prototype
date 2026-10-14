import { SHOP_STORAGE_KEY } from './storage.js';

const SHOP_CHANGE_EVENT = 'karivia:shop-changed';
export function notifyShopChanged() {
  window.dispatchEvent(new Event(SHOP_CHANGE_EVENT));
}

// Subscribers stay independent of the chosen local/API data adapter.
export function subscribeShopChanges(listener) {
  const storage = (event) => {
    if (event.key === SHOP_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(SHOP_CHANGE_EVENT, listener);
  window.addEventListener('storage', storage);
  return () => {
    window.removeEventListener(SHOP_CHANGE_EVENT, listener);
    window.removeEventListener('storage', storage);
  };
}
