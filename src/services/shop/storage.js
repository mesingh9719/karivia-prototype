export const SHOP_STORAGE_KEY = 'karivia_shop_v1';
const storageError = () =>
  new Error(
    'Shop changes could not be saved. Browser storage may be full or disabled. Try a smaller image or allow local storage, then try again.',
  );

export function createLocalShopStorage({ storage, seed }) {
  function write(db) {
    try {
      storage().setItem(SHOP_STORAGE_KEY, JSON.stringify(db));
    } catch {
      throw storageError();
    }
  }
  function read() {
    let value;
    try {
      value = storage().getItem(SHOP_STORAGE_KEY);
    } catch {
      throw storageError();
    }
    if (value === null) {
      write(seed);
      return structuredClone(seed);
    }
    try {
      const data = JSON.parse(value);
      if (data.version !== 1) throw new Error();
      return data;
    } catch {
      throw new Error(
        'Saved Shop data could not be read. It has been preserved. Restore a valid karivia_shop_v1 backup in browser storage to continue.',
      );
    }
  }
  return { read, write };
}
