import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Eye,
  FolderOpen,
  Package,
  Pencil,
  Plus,
  Trash2,
} from 'lucide-react';
import { Badge, Button, Field } from '../components/UI';
import {
  ImagePicker,
  ProductCard,
  ProductDetails,
  ShopDialog,
  ShopImage,
  ShopPagination,
  ShopSearch,
  ShopState,
  shopMoney,
} from '../components/shop/ShopUI';
import { useShop } from '../hooks/useShop';
import { useToast } from '../context/ToastContext';
import { productsService } from '../services/shop/productsService';
import { shopCategoriesService } from '../services/shop/shopCategoriesService';

const statuses = [
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
];
const productSorts = [
  { value: 'newest', label: 'Newest first' },
  { value: 'name_asc', label: 'Name: A–Z' },
  { value: 'name_desc', label: 'Name: Z–A' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'stock_asc', label: 'Lowest stock first' },
];
const categorySorts = [
  { value: 'name_asc', label: 'Name: A–Z' },
  { value: 'name_desc', label: 'Name: Z–A' },
  { value: 'newest', label: 'Newest first' },
  { value: 'count_desc', label: 'Most products first' },
];

function RecordEditor({ kind, record, categories, onClose }) {
  const product = kind === 'products',
    service = product ? productsService : shopCategoriesService,
    toast = useToast();
  const [form, setForm] = useState(() => ({
    name: record?.name || '',
    description: record?.description || '',
    image: record?.image || '',
    status: record?.status || 'active',
    ...(product
      ? {
          shortDescription: record?.shortDescription || '',
          price: record?.price ?? '',
          stock: record?.stock ?? 0,
          categoryId: record?.categoryId || '',
        }
      : {}),
  }));
  const [errors, setErrors] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [imageBusy, setImageBusy] = useState(false),
    [preview, setPreview] = useState(false);
  const pending = useRef(false);
  const formRef = useRef(null),
    previewRef = useRef(null),
    focusError = useRef(false);
  useEffect(() => {
    if (focusError.current && Object.values(errors).some(Boolean)) {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      focusError.current = false;
    }
  }, [errors]);
  const noun = product ? 'product' : 'category';
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
    setError('');
  };
  const category = categories.find((c) => c.id === form.categoryId);
  const previewProduct = {
    ...form,
    id: record?.id || 'Unsaved product',
    categoryName: category?.name || 'Select a category',
    categoryStatus: category?.status || 'missing',
    price: Number(form.price) || 0,
    stock: Number(form.stock) || 0,
  };
  const library = [
    ...new Set(
      categories
        .map((c) => c.image)
        .filter((image) => image && !image.startsWith('data:')),
    ),
  ];
  const field = (key) => ({
    value: form[key],
    onChange: (e) => set(key, e.target.value),
    error: errors[key],
    'aria-invalid': Boolean(errors[key]),
    'aria-describedby': errors[key] ? `shop-form-${key}` : undefined,
  });
  async function save(event) {
    event.preventDefault();
    if (pending.current || imageBusy) return;
    pending.current = true;
    setBusy(true);
    setError('');
    setErrors({});
    try {
      if (record) await service.update(record.id, form);
      else await service.create(form);
      toast(
        `${product ? 'Product' : 'Category'} ${record ? 'updated' : 'created'}.`,
      );
      onClose();
    } catch (e) {
      if (e.fields) {
        focusError.current = true;
        setErrors(e.fields);
      } else setError(e.message);
      toast(e.message, 'error');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <ShopDialog
      title={
        preview ? 'Public shop preview' : `${record ? 'Edit' : 'Add'} ${noun}`
      }
      onClose={onClose}
      busy={busy || imageBusy}
      wide={product}
    >
      {preview ? (
        <>
          <div className="shop-editor-preview">
            <ProductCard
              product={previewProduct}
              preview
              onView={() =>
                previewRef.current?.scrollIntoView({ block: 'nearest' })
              }
            />
            <div ref={previewRef}>
              <ProductDetails product={previewProduct} preview />
            </div>
          </div>
          <div className="form-actions">
            <Button variant="outline" onClick={() => setPreview(false)}>
              Back to editing
            </Button>
          </div>
        </>
      ) : (
        <form
          ref={formRef}
          onSubmit={save}
          noValidate
          className="shop-editor-form"
        >
          <fieldset disabled={busy} className="shop-form-fields">
            <div className="shop-form-grid">
              <div className="shop-form-span">
                <Field
                  label={`${product ? 'Product' : 'Category'} name *`}
                  maxLength={120}
                  required
                  autoFocus
                  {...field('name')}
                />
              </div>
              {product && (
                <div className="shop-form-span">
                  <Field
                    label="Short description"
                    maxLength={200}
                    placeholder="A short line for the product card"
                    {...field('shortDescription')}
                  />
                </div>
              )}
              <div className="shop-form-span">
                <Field
                  label={`Description${product ? ' *' : ''}`}
                  as="textarea"
                  rows={4}
                  maxLength={4000}
                  required={product}
                  {...field('description')}
                />
              </div>
              {product && (
                <>
                  <Field
                    label="Price (₹) *"
                    type="number"
                    min="0"
                    max="10000000"
                    step="0.01"
                    required
                    {...field('price')}
                  />
                  <Field
                    label="Stock quantity *"
                    type="number"
                    min="0"
                    max="1000000"
                    step="1"
                    required
                    {...field('stock')}
                  />
                  <Field
                    label="Category *"
                    as="select"
                    required
                    {...field('categoryId')}
                    options={[
                      { value: '', label: 'Choose a category' },
                      ...categories.map((c) => ({
                        value: c.id,
                        label: `${c.name}${c.status === 'inactive' ? ' (inactive)' : ''}`,
                      })),
                      ...(form.categoryId && !category
                        ? [
                            {
                              value: form.categoryId,
                              label: 'Missing category — select a replacement',
                            },
                          ]
                        : []),
                    ]}
                  />
                </>
              )}
              <Field
                label="Status"
                as="select"
                {...field('status')}
                options={statuses}
              />
            </div>
            <ImagePicker
              id={`shop-${noun}`}
              value={form.image}
              onChange={(value) => set('image', value)}
              onBusyChange={setImageBusy}
              error={errors.image}
              library={library.slice(0, 8)}
            />
            {product &&
              (form.status === 'inactive' || category?.status !== 'active') && (
                <div className="shop-note">
                  This product will be hidden from the public shop until both
                  the product and its category are active.
                </div>
              )}
            {!product && (
              <div className="shop-note">
                Inactive categories hide their products from the public shop.
                Existing product assignments are kept.
              </div>
            )}
          </fieldset>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="shop-form-actions">
            <Button
              variant="outline"
              type="button"
              onClick={onClose}
              disabled={busy || imageBusy}
            >
              Cancel
            </Button>
            {product && (
              <Button
                variant="ghost"
                type="button"
                onClick={() => setPreview(true)}
                disabled={busy || imageBusy}
              >
                <Eye size={16} /> Preview
              </Button>
            )}
            <Button type="submit" loading={busy} disabled={imageBusy}>
              {record ? 'Save changes' : `Create ${noun}`}
            </Button>
          </div>
          <small className="shop-form-hint">
            * Required. Changes are saved in this browser.
          </small>
        </form>
      )}
    </ShopDialog>
  );
}

function DeleteRecord({ kind, record, onClose }) {
  const toast = useToast(),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false),
    product = kind === 'products',
    blocked = !product && record.productCount > 0;
  async function remove() {
    if (pending.current || blocked) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await (product ? productsService : shopCategoriesService).remove(
        record.id,
      );
      toast(`${product ? 'Product' : 'Category'} deleted.`);
      onClose();
    } catch (e) {
      setError(e.message);
      toast(e.message, 'error');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <ShopDialog
      title={
        blocked
          ? 'This category has products'
          : `Delete ${product ? 'product' : 'category'}?`
      }
      onClose={onClose}
      busy={busy}
    >
      <div className="shop-delete-icon">
        <Trash2 size={24} />
      </div>
      <h3>{record.name}</h3>
      <p>
        {blocked
          ? `${record.productCount} product${record.productCount === 1 ? ' is' : 's are'} assigned to this category. Edit those products and assign each to another category before deleting this one. You can also deactivate the category.`
          : 'This removes the record from this browser’s Shop data. This action cannot be undone.'}
      </p>
      {error && (
        <p className="error" role="alert">
          {error}
        </p>
      )}
      <div className="form-actions">
        <Button variant="outline" onClick={onClose} disabled={busy}>
          {blocked ? 'Close' : 'Cancel'}
        </Button>
        {blocked ? (
          <Link
            className="btn btn-primary"
            to={`/app/admin/shop?category=${encodeURIComponent(record.id)}`}
          >
            Manage assigned products
          </Link>
        ) : (
          <Button
            className="shop-danger-button"
            onClick={remove}
            loading={busy}
          >
            Delete {product ? 'product' : 'category'}
          </Button>
        )}
      </div>
    </ShopDialog>
  );
}

function RecordView({ kind, record, onClose, onEdit }) {
  const product = kind === 'products';
  return (
    <ShopDialog
      title={product ? 'Public shop preview' : record.name}
      wide={product}
      onClose={onClose}
    >
      {product ? (
        <ProductDetails product={record} preview />
      ) : (
        <div className="shop-category-detail">
          <ShopImage
            src={record.image}
            alt={record.name}
            width="600"
            height="300"
          />
          <h3>{record.name}</h3>
          <Badge value={record.status} />
          <p>{record.description || 'No description added.'}</p>
          <p>
            <b>{record.productCount}</b> assigned products ·{' '}
            <b>{record.publicProductCount}</b> visible in the public shop
          </p>
          <small className="shop-record-id">Category ID: {record.id}</small>
        </div>
      )}
      <div className="form-actions">
        <Button variant="outline" onClick={onClose}>
          Close
        </Button>
        <Button onClick={onEdit}>
          <Pencil size={16} /> Edit {product ? 'product' : 'category'}
        </Button>
      </div>
    </ShopDialog>
  );
}

export default function ShopManagement({ kind = 'products' }) {
  const product = kind === 'products',
    noun = product ? 'products' : 'categories';
  const [params, setParams] = useSearchParams(),
    [dialog, setDialog] = useState(null);
  const filters = {
    search: params.get('q') || '',
    status: params.get('status') || '',
    categoryId: product ? params.get('category') || '' : '',
    availability: product ? params.get('availability') || '' : '',
    sort: params.get('sort') || (product ? 'newest' : 'name_asc'),
    page: Number(params.get('page')) || 1,
    pageSize: 8,
  };
  const result = useShop(kind, filters);
  function change(key, value) {
    setParams(
      (previous) => {
        const next = new URLSearchParams(previous);
        if (value) next.set(key, value);
        else next.delete(key);
        if (key !== 'page') next.delete('page');
        return next;
      },
      { replace: true },
    );
  }
  const clear = () => setParams({}, { replace: true });
  const filtered =
    filters.search ||
    filters.status ||
    filters.categoryId ||
    filters.availability ||
    params.has('sort');
  const open = (action, record = null) => setDialog({ action, record });
  const close = () => setDialog(null);
  return (
    <div className="shop-management">
      <div className="resource-head">
        <div>
          <span className="kicker">SHOP MANAGEMENT</span>
          <h1>
            {product
              ? 'Your self-care collection.'
              : 'A place for every product.'}
          </h1>
          <p>
            {product
              ? 'Create, curate, and preview the essentials in your public shop.'
              : 'Organise your collection and manage category visibility.'}
          </p>
        </div>
        <Button onClick={() => open('edit')}>
          <Plus size={17} /> Add {product ? 'product' : 'category'}
        </Button>
      </div>
      <div className="shop-admin-nav">
        <nav aria-label="Shop management">
          <NavLink to="/app/admin/shop" end>
            <Package size={17} /> Products
          </NavLink>
          <NavLink to="/app/admin/shop-categories">
            <FolderOpen size={17} /> Categories
          </NavLink>
          <NavLink to="/app/admin/shop-orders">
            <Package size={17} /> Orders
          </NavLink>
        </nav>
        <Link to="/shop" className="text-link">
          View public shop <ArrowUpRight size={16} />
        </Link>
      </div>
      <section className="card table-panel">
        <div className="shop-admin-controls">
          <ShopSearch
            value={filters.search}
            onChange={(v) => change('q', v)}
            label={`Search ${noun}`}
            placeholder={`Search ${noun}…`}
          />
          <Field
            label="Status"
            as="select"
            value={filters.status}
            onChange={(e) => change('status', e.target.value)}
            options={[{ value: '', label: 'All statuses' }, ...statuses]}
          />
          {product && (
            <>
              <Field
                label="Category"
                as="select"
                value={filters.categoryId}
                onChange={(e) => change('category', e.target.value)}
                options={[
                  { value: '', label: 'All categories' },
                  ...result.categories.map((c) => ({
                    value: c.id,
                    label: c.name,
                  })),
                  ...(filters.categoryId &&
                  !result.categories.some((c) => c.id === filters.categoryId)
                    ? [{ value: filters.categoryId, label: 'Missing category' }]
                    : []),
                ]}
              />
              <Field
                label="Availability"
                as="select"
                value={filters.availability}
                onChange={(e) => change('availability', e.target.value)}
                options={[
                  { value: '', label: 'All stock' },
                  { value: 'in_stock', label: 'In stock' },
                  { value: 'out_of_stock', label: 'Out of stock' },
                ]}
              />
            </>
          )}
          <Field
            label="Sort by"
            as="select"
            value={filters.sort}
            onChange={(e) => change('sort', e.target.value)}
            options={product ? productSorts : categorySorts}
          />
          <Button variant="ghost" onClick={clear} disabled={!filtered}>
            Clear filters
          </Button>
        </div>
        <ShopState
          loading={result.loading}
          error={result.error}
          empty={!result.total}
          noun={noun}
          onRetry={result.refresh}
          onClear={filtered ? clear : undefined}
        >
          <div className="table-scroll">
            <table className="data-table shop-admin-table">
              <caption className="shop-sr-only">
                Shop {noun} with management actions
              </caption>
              <thead>
                <tr>
                  <th scope="col">{product ? 'Product' : 'Category'}</th>
                  {product ? (
                    <>
                      <th scope="col">Category</th>
                      <th scope="col">Price</th>
                      <th scope="col">Stock</th>
                    </>
                  ) : (
                    <th scope="col">Assigned products</th>
                  )}
                  <th scope="col">Status</th>
                  <th scope="col">Actions</th>
                </tr>
              </thead>
              <tbody>
                {result.data.map((record) => (
                  <tr key={record.id}>
                    <td>
                      <div className="shop-admin-product">
                        <ShopImage
                          src={record.image}
                          alt=""
                          width="48"
                          height="48"
                          loading="lazy"
                        />
                        <div>
                          <strong>{record.name}</strong>
                          <small>
                            {product
                              ? record.shortDescription || record.description
                              : record.description || 'No description'}
                          </small>
                        </div>
                      </div>
                    </td>
                    {product ? (
                      <>
                        <td data-label="Category">
                          {record.categoryName}
                          {record.categoryStatus !== 'active' && (
                            <small className="shop-hidden-label">
                              Hidden: category {record.categoryStatus}
                            </small>
                          )}
                        </td>
                        <td data-label="Price">
                          <strong>{shopMoney(record.price)}</strong>
                        </td>
                        <td data-label="Stock">
                          <span
                            className={`shop-inventory ${record.stock === 0 ? 'empty' : record.stock <= 5 ? 'low' : ''}`}
                          >
                            {record.stock === 0
                              ? 'Out of stock'
                              : `${record.stock} available`}
                          </span>
                        </td>
                      </>
                    ) : (
                      <td data-label="Assigned products">
                        <Link
                          className="text-link"
                          to={`/app/admin/shop?category=${encodeURIComponent(record.id)}`}
                        >
                          {record.productCount} products{' '}
                          <ArrowUpRight size={14} />
                        </Link>
                      </td>
                    )}
                    <td data-label="Status">
                      <Badge value={record.status} />
                    </td>
                    <td data-label="Actions" className="shop-action-cell">
                      <div className="row-actions">
                        <button
                          type="button"
                          title={
                            product
                              ? 'View and preview product'
                              : 'View category'
                          }
                          aria-label={`View ${record.name}`}
                          onClick={() => open('view', record)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          title="Edit"
                          aria-label={`Edit ${record.name}`}
                          onClick={() => open('edit', record)}
                        >
                          <Pencil size={16} />
                        </button>
                        <button
                          type="button"
                          title="Delete"
                          aria-label={`Delete ${record.name}`}
                          onClick={() => open('delete', record)}
                        >
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </ShopState>
        {!result.loading && !result.error && result.total > 0 && (
          <ShopPagination
            {...result}
            noun={noun}
            onChange={(page) => change('page', String(page))}
          />
        )}
      </section>
      <p className="shop-admin-caption">
        Local prototype · Changes persist in this browser and appear in the
        public shop.
      </p>
      {dialog?.action === 'edit' && (
        <RecordEditor
          key={`${kind}-${dialog.record?.id || 'new'}`}
          kind={kind}
          record={dialog.record}
          categories={result.categories}
          onClose={close}
        />
      )}
      {dialog?.action === 'delete' && (
        <DeleteRecord kind={kind} record={dialog.record} onClose={close} />
      )}
      {dialog?.action === 'view' && (
        <RecordView
          kind={kind}
          record={dialog.record}
          onClose={close}
          onEdit={() => open('edit', dialog.record)}
        />
      )}
    </div>
  );
}
