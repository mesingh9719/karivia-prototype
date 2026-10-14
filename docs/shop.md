# Shop prototype

Public catalog: `/shop`. Bag: `/cart`. Checkout: `/checkout`. Order history and details: `/orders` and `/orders/:id`. Admin products: `/app/admin/shop`. Admin categories: `/app/admin/shop-categories`. Admin orders: `/app/admin/shop-orders`. Choose the Admin demo account on `/login` to manage the collection and orders.

Products and categories are independently seeded from `src/data/shop-products.json` and `src/data/shop-categories.json`. The repository initializes `karivia_shop_v1` in localStorage only when that key is absent. Refreshing pages, changing routes, and updating the JSON seeds never overwrite existing browser edits. Empty saved collections remain empty. Changes update open views in the same browser, including other tabs through storage events. This store is separate from the booking/service demo store; the existing dashboard demo reset does not reset Shop data.

Each product has a unique `id`, `name`, `description`, optional `shortDescription` and `image`, `price` in INR (up to two decimal places), `categoryId`, integer `stock`, `status` (`active`/`inactive`), and creation/update timestamps. Each category has a unique `id`, `name`, optional `description` and `image`, `status`, and timestamps. List responses add category names/visibility to products and assigned/public product counts to categories without persisting those derived fields.

Only active products assigned to active categories appear publicly. Out-of-stock products remain visible and can be filtered. Deactivating a category hides its products without changing their individual status or assignment. Category deletion is blocked when any product is assigned, including inactive products; the dialog links to the filtered product list for manual reassignment. Missing category references are marked in admin and excluded publicly. Damaged individual records are conservatively normalized and can be repaired through editing. Invalid collection shapes, corrupt JSON, and unsupported store versions produce errors while preserving the saved value. Storage denial or quota exhaustion produces a visible error, keeps the form open, and never reports success.

Images support HTTPS URLs, built-in samples drawn from category images, and JPG/PNG/WebP uploads up to 512 KB and 6,000 × 6,000 pixels. Uploads are decoded before acceptance and stored as data URLs. No files are sent to a server. Empty or failed images use a local illustrated fallback. Browser storage quotas apply to the entire collection; use smaller files or external image URLs when necessary. Sample image resources use Unsplash and require connectivity.

Search, category/status/availability filters, price bounds, sorting, and pagination are handled in `src/services/shop/query.js`. Filter changes reset pagination; out-of-range pages are clamped after deletion. URL query parameters preserve list filters on refresh and allow links to assigned products. The public catalog uses nine items per page; management uses eight.

## Replacing the data adapter

Components use `productsService` and `shopCategoriesService`, never seed files or browser storage. Both expose asynchronous methods:

```js
list({ search, categoryId, status, availability, minPrice, maxPrice,
       sort, page, pageSize, publicOnly })
// => { data, total, page, pageSize, totalPages }
get(id, { publicOnly }) // => record
create(fields)         // => saved record
update(id, patch)      // => saved record
remove(id)             // => { success: true }
```

Replace the local exports in these two service modules with an API adapter implementing the same contract. Product list/detail enrichment (`categoryName`, `categoryStatus`, `isPublic`) and category list counts (`productCount`, `publicProductCount`) must be supplied by the adapter. Validation errors can expose a `fields` map for inline form errors; other errors use `message`. Call `notifyShopChanged()` from `events.js` after successful mutations, or replace that module’s subscription with your API cache invalidation. Category dropdowns request up to 1,000 records; for a much larger catalog, introduce a searchable paged category selector. Shop deliberately ignores `VITE_DATA_PROVIDER` and always remains local in this prototype.

Checkout creates local prototype orders with cash on delivery. No payment is collected, delivery arranged, or backend/database integrated. The existing demo auth controls route access; the local prototype does not provide secure multi-user authorization. To manually restart the Shop demo, back up any edits first and remove only the `karivia_shop_v1` key in browser developer tools, then reload.

## Orders and carts

`src/data/shop-orders.json` supplies three example orders for newly initialized stores. Two belong to the seeded Customer demo account and one to the Salon demo account. Existing Shop stores retain their products/categories and start with empty orders/carts; introducing these fields never reseeds existing product edits or stock levels. Seed product quantities represent the current available stock after historical sample purchases.

Carts, orders, and a persistent guest identity live alongside products/categories in `karivia_shop_v1`. Guests can shop and place orders without logging in. Account bags/history and the guest bag/history are separate. The public history lists orders belonging to the current guest or demo account; the admin lists all local orders. Internal admin notes do not appear in customer order views.

The cart holds product IDs and quantities and resolves current catalog data on each read. Deleted/inactive products and inactive categories become unavailable; insufficient quantities are flagged. Decrease the quantity or remove the affected item to continue. Quantity limits are 1–99 per product and 100 distinct products per bag. Checkout revalidates every item against current visibility, stock, and the reviewed prices. Product snapshots preserve names, images, quantities, and purchased prices when the catalog is later edited or a product deleted. Totals use integer paise arithmetic; delivery is complimentary and totals include the listed product prices.

Successful placement saves the order, deducts stock, and empties the matching bag in one localStorage write. Failed saves leave the bag and stock intact. Each checkout submission has an idempotency token so repeated submissions of the same request return the saved order without deducting stock again. This single-browser prototype does not provide distributed inventory locking between concurrent browsers/tabs.

Status progression is `pending → confirmed → processing → shipped → delivered`. Admins may cancel pending, confirmed, or processing orders; customers may cancel pending or confirmed orders. Cancellation requires confirmation and restores stock once for products still in the collection. Cancelled and delivered orders cannot be reopened. Cash-on-delivery payment is marked paid on prototype delivery; no actual charge occurs. Admins may add tracking references and internal notes. Order records and purchased items remain in history rather than being deleted or repriced. Incomplete stored orders are marked `needs_review` and cannot change status.

Order and cart adapters are separate services:

```js
cartService.get({ accountId })
// => { customerId, items, itemCount, subtotal, canCheckout }
cartService.add(productId, quantity, { accountId })
cartService.update(productId, quantity, { accountId })
cartService.remove(productId, { accountId })
cartService.clear({ accountId })
// mutations return the updated cart

ordersService.list({ accountId, customerOnly, search, status, paymentStatus,
                     minDate, maxDate, sort, page, pageSize })
// => { data, total, page, pageSize, totalPages, summary }
ordersService.get(id, { accountId, customerOnly })
ordersService.create({ customer, notes, paymentMethod: 'cod', requestToken, items },
                     { accountId })
ordersService.update(id, { status, trackingNumber, adminNotes })
ordersService.cancel(id, { accountId })
```

For API integration, replace the service exports, retain the notification contract, and move customer identity/authorization, inventory transactions, validation, and idempotency enforcement to the backend. UI components do not read JSON or browser storage.

## Manual walkthrough

No automated tests, build checks, lint checks, or browser test runs were performed for the Orders addition, as requested.

1. Open `/shop`, add an in-stock product, change its quantity in `/cart`, and refresh to confirm the bag persists.
2. Open `/checkout`, submit incomplete delivery details, then complete the form and place a prototype order. Confirm the bag empties, the total is correct, and the order appears in `/orders` after refresh.
3. Log in as Admin, open `/app/admin/shop-orders`, and search for the new order by its number. Review items/address, update tracking and internal notes, then move it through the allowed statuses. The customer view should reflect each change.
4. Place another order, cancel it while pending, and confirm stock is restored once and repeat cancellation is unavailable. Processing/shipped orders should not offer customer cancellation.
5. Change a product's stock, price, or visibility after adding it to the bag. Review the updated quote or unavailable-item message before checkout. Historical orders should keep their purchased prices.
6. Try order filters, sorting, pagination, and mobile layouts. Guest history and account history should remain separate; admin history includes both.
