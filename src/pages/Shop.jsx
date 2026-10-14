import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { ArrowRight, Flower2, SlidersHorizontal, Sparkles } from 'lucide-react';
import { Button, Field } from '../components/UI';
import {
  ProductCard,
  ProductDetails,
  ShopDialog,
  ShopImage,
  ShopPagination,
  ShopSearch,
  ShopState,
} from '../components/shop/ShopUI';
import { useShop, useShopProduct } from '../hooks/useShop';
import { useShopCart } from '../context/ShopCartContext';

const sorts = [
  { value: 'newest', label: 'Newest first' },
  { value: 'price_asc', label: 'Price: low to high' },
  { value: 'price_desc', label: 'Price: high to low' },
  { value: 'name_asc', label: 'Name: A–Z' },
];

function PublicProductDialog({ id, onClose }) {
  const state = useShopProduct(id, { publicOnly: true });
  const cart = useShopCart(),
    [adding, setAdding] = useState(false),
    [addError, setAddError] = useState(''),
    [added, setAdded] = useState(false);
  async function add(quantity) {
    setAdding(true);
    setAddError('');
    setAdded(false);
    try {
      await cart.addItem(id, quantity);
      setAdded(true);
    } catch (error) {
      setAddError(error.message);
    } finally {
      setAdding(false);
    }
  }
  return (
    <ShopDialog
      title={state.product?.name || 'Product details'}
      onClose={onClose}
      wide
    >
      <ShopState
        loading={state.loading}
        error={state.error}
        onRetry={state.refresh}
      >
        {state.product && (
          <ProductDetails
            product={state.product}
            onAdd={add}
            adding={adding}
            cartBusy={cart.busy || cart.loading}
          />
        )}
      </ShopState>
      {addError && (
        <p className="error" role="alert">
          {addError}
        </p>
      )}
      {added && (
        <div className="order-add-notice" role="status">
          Added to your bag.{' '}
          <Link to="/cart" className="text-link">
            View bag <ArrowRight size={15} />
          </Link>
        </div>
      )}
    </ShopDialog>
  );
}

export default function Shop() {
  const cart = useShopCart(),
    [addingId, setAddingId] = useState(null);
  async function add(product) {
    setAddingId(product.id);
    try {
      await cart.addItem(product.id);
    } catch {
      /* The cart service displays the error toast. */
    } finally {
      setAddingId(null);
    }
  }
  const [params, setParams] = useSearchParams(),
    [selected, setSelected] = useState(null);
  const filters = {
    search: params.get('q') || '',
    categoryId: params.get('category') || '',
    minPrice: params.get('min') || '',
    maxPrice: params.get('max') || '',
    availability: params.get('availability') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page')) || 1,
    pageSize: 9,
    publicOnly: true,
  };
  const result = useShop('products', filters);
  const categories = result.categories.filter((c) => c.status === 'active');
  const priceError = [filters.minPrice, filters.maxPrice].some(
    (v) => v !== '' && (!Number.isFinite(Number(v)) || Number(v) < 0),
  )
    ? 'Prices must be positive numbers or zero.'
    : filters.minPrice !== '' &&
        filters.maxPrice !== '' &&
        Number(filters.minPrice) > Number(filters.maxPrice)
      ? 'Maximum price must be at least the minimum price.'
      : '';
  const hasFilters =
    filters.search ||
    filters.categoryId ||
    filters.minPrice !== '' ||
    filters.maxPrice !== '' ||
    filters.availability ||
    filters.sort !== 'newest';
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
  return (
    <div className="shop-page">
      <section className="shop-hero">
        <div className="container shop-hero-inner">
          <div>
            <span className="eyebrow">
              <Sparkles size={14} /> THE KARIVIA COLLECTION
            </span>
            <h1>
              Good things for
              <br />
              <em>your everyday.</em>
            </h1>
            <p>
              Bring a little salon-inspired self-care home. Discover thoughtful
              essentials for your skin, hair, and all the moments in between.
            </p>
            <div className="shop-hero-tag">
              <Flower2 size={18} /> Small rituals. Beautiful days.
            </div>
          </div>
          <div className="shop-hero-art">
            <ShopImage
              src="https://images.unsplash.com/photo-1608571423902-eed4a5ad8108?w=1000&q=85"
              alt="Beauty essentials for a daily self-care ritual"
              width="900"
              height="650"
              fetchPriority="high"
            />
            <span>
              The art of
              <br />
              <em>taking care.</em>
            </span>
          </div>
        </div>
      </section>
      <div className="container shop-catalog">
        <div className="shop-catalog-heading">
          <div>
            <span className="kicker">FIND YOUR FAVOURITES</span>
            <h2>A little care goes a long way.</h2>
          </div>
          <div className="order-shop-links">
            <Link to="/orders" className="text-link">
              My orders
            </Link>
            <Link to="/cart" className="btn btn-outline">
              Your bag ({cart.itemCount})
            </Link>
          </div>
        </div>
        <div className="shop-category-pills" aria-label="Product categories">
          <button
            className={`filter-pill ${!filters.categoryId ? 'selected' : ''}`}
            aria-pressed={!filters.categoryId}
            onClick={() => change('category', '')}
          >
            All essentials
          </button>
          {categories.map((category) => (
            <button
              key={category.id}
              className={`filter-pill ${filters.categoryId === category.id ? 'selected' : ''}`}
              aria-pressed={filters.categoryId === category.id}
              onClick={() => change('category', category.id)}
            >
              {category.name}
              <span>{category.publicProductCount}</span>
            </button>
          ))}
        </div>
        <div className="shop-layout">
          <aside className="shop-filters">
            <h3>
              <SlidersHorizontal size={18} /> Refine your ritual
            </h3>
            <Field
              label="Category"
              as="select"
              value={filters.categoryId}
              onChange={(e) => change('category', e.target.value)}
              options={[
                { value: '', label: 'All categories' },
                ...categories.map((c) => ({ value: c.id, label: c.name })),
                ...(!categories.some((c) => c.id === filters.categoryId) &&
                filters.categoryId
                  ? [
                      {
                        value: filters.categoryId,
                        label: 'Unavailable category',
                      },
                    ]
                  : []),
              ]}
            />
            <div className="shop-price-fields">
              <Field
                label="Min price (₹)"
                type="number"
                min="0"
                step="0.01"
                value={filters.minPrice}
                placeholder="0"
                onChange={(e) => change('min', e.target.value)}
                aria-invalid={Boolean(priceError)}
                aria-describedby={priceError ? 'shop-price-error' : undefined}
              />
              <Field
                label="Max price (₹)"
                type="number"
                min="0"
                step="0.01"
                value={filters.maxPrice}
                placeholder="Any"
                onChange={(e) => change('max', e.target.value)}
                aria-invalid={Boolean(priceError)}
                aria-describedby={priceError ? 'shop-price-error' : undefined}
              />
            </div>
            {priceError && (
              <p className="error" id="shop-price-error" role="alert">
                {priceError}
              </p>
            )}
            <Field
              label="Availability"
              as="select"
              value={filters.availability}
              onChange={(e) => change('availability', e.target.value)}
              options={[
                { value: '', label: 'All availability' },
                { value: 'in_stock', label: 'In stock' },
                { value: 'out_of_stock', label: 'Out of stock' },
              ]}
            />
            <Button variant="ghost" onClick={clear} disabled={!hasFilters}>
              Clear all filters
            </Button>
            <div className="shop-filter-note">
              <Flower2 size={25} />
              <b>Your time to unwind.</b>
              <p>Find the little things that make your routine feel special.</p>
            </div>
          </aside>
          <section className="shop-results" aria-label="Shop products">
            <div className="shop-results-toolbar">
              <ShopSearch
                value={filters.search}
                onChange={(v) => change('q', v)}
              />
              <Field
                label="Sort by"
                as="select"
                value={filters.sort}
                onChange={(e) => change('sort', e.target.value)}
                options={sorts}
              />
            </div>
            {!priceError && (
              <>
                <ShopState
                  loading={result.loading}
                  error={result.error}
                  empty={!result.total}
                  onRetry={result.refresh}
                  onClear={clear}
                >
                  <div className="shop-results-meta" role="status">
                    {result.total} thoughtfully chosen essentials
                  </div>
                  <div className="shop-product-grid">
                    {result.data.map((product) => (
                      <ProductCard
                        product={product}
                        key={product.id}
                        onView={(p) => setSelected(p.id)}
                        onAdd={add}
                        adding={addingId === product.id}
                        cartBusy={cart.busy || cart.loading}
                      />
                    ))}
                  </div>
                </ShopState>
                {!result.loading && !result.error && result.total > 0 && (
                  <ShopPagination
                    {...result}
                    onChange={(page) => change('page', String(page))}
                  />
                )}
              </>
            )}
          </section>
        </div>
        <div className="shop-bottom-banner">
          <Flower2 size={32} />
          <div>
            <h3>Make a little more time for you.</h3>
            <p>
              Pair your favourite essentials with a visit to a great beauty
              professional.
            </p>
          </div>
          <Link to="/explore" className="btn btn-outline">
            Explore services <ArrowRight size={16} />
          </Link>
        </div>
      </div>
      {selected && (
        <PublicProductDialog id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
