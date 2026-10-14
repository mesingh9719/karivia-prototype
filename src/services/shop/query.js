const number = (value, fallback) =>
  Number.isFinite(Number(value)) ? Number(value) : fallback;
export function paginate(items, { page = 1, pageSize = 9 } = {}) {
  const size = Math.max(1, Math.min(1000, Math.trunc(number(pageSize, 9))));
  const totalPages = Math.max(1, Math.ceil(items.length / size));
  const current = Math.min(
    totalPages,
    Math.max(1, Math.trunc(number(page, 1))),
  );
  return {
    data: items.slice((current - 1) * size, current * size),
    total: items.length,
    page: current,
    pageSize: size,
    totalPages,
  };
}
export function queryRecords(items, params = {}, kind = 'products') {
  const {
    search = '',
    categoryId = '',
    status = '',
    availability = '',
    minPrice = '',
    maxPrice = '',
    sort = 'newest',
  } = params;
  const term = String(search).trim().toLocaleLowerCase();
  const filtered = items.filter((item) => {
    const text = [
      item.name,
      item.description,
      item.shortDescription,
      item.categoryName,
    ]
      .filter(Boolean)
      .join(' ')
      .toLocaleLowerCase();
    return (
      (!term || text.includes(term)) &&
      (!status || item.status === status) &&
      (kind !== 'products' ||
        ((!categoryId || item.categoryId === categoryId) &&
          (minPrice === '' || item.price >= number(minPrice, 0)) &&
          (maxPrice === '' || item.price <= number(maxPrice, Infinity)) &&
          (!availability ||
            (availability === 'in_stock' ? item.stock > 0 : item.stock === 0))))
    );
  });
  const comparators = {
    newest: (a, b) => String(b.createdAt).localeCompare(String(a.createdAt)),
    oldest: (a, b) => String(a.createdAt).localeCompare(String(b.createdAt)),
    name_asc: (a, b) => a.name.localeCompare(b.name),
    name_desc: (a, b) => b.name.localeCompare(a.name),
    price_asc: (a, b) => a.price - b.price,
    price_desc: (a, b) => b.price - a.price,
    stock_asc: (a, b) => a.stock - b.stock,
    count_desc: (a, b) => b.productCount - a.productCount,
  };
  filtered.sort(
    (a, b) =>
      (comparators[sort] || comparators.newest)(a, b) ||
      a.id.localeCompare(b.id),
  );
  return paginate(filtered, params);
}
