import { useEffect, useRef, useState } from 'react';
import {
  AlertCircle,
  ArrowUpRight,
  ChevronLeft,
  ChevronRight,
  ImageOff,
  LoaderCircle,
  Package,
  Search,
  ShoppingBag,
  X,
} from 'lucide-react';
import { Button } from '../UI';
import { safeImage, validateImageFile } from '../../services/shop/validation';

export const shopMoney = (value) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 2,
  }).format(value);

export function ShopImage({ src, alt, className = '', ...props }) {
  const [failedSource, setFailedSource] = useState(null);
  return (
    <img
      {...props}
      className={className}
      src={
        !src || failedSource === src
          ? '/shop-placeholder.svg'
          : safeImage(src) || '/shop-placeholder.svg'
      }
      alt={alt}
      onError={() => setFailedSource(src)}
    />
  );
}

export function ShopDialog({
  title,
  onClose,
  busy = false,
  wide = false,
  children,
}) {
  const ref = useRef(null);
  useEffect(() => {
    const dialog = ref.current,
      previous = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    dialog.showModal();
    return () => {
      dialog.close();
      document.body.style.overflow = overflow;
      previous?.focus?.();
    };
  }, []);
  return (
    <dialog
      ref={ref}
      className={`shop-dialog ${wide ? 'shop-dialog-wide' : ''}`}
      aria-label={title}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      onClick={(e) => {
        if (e.target === ref.current && !busy) {
          const r = ref.current.getBoundingClientRect();
          if (
            e.clientX < r.left ||
            e.clientX > r.right ||
            e.clientY < r.top ||
            e.clientY > r.bottom
          )
            onClose();
        }
      }}
    >
      <div className="shop-dialog-head">
        <h2>{title}</h2>
        <button
          type="button"
          className="icon-btn"
          disabled={busy}
          onClick={onClose}
          aria-label="Close dialog"
        >
          <X size={21} />
        </button>
      </div>
      {children}
    </dialog>
  );
}

export function ShopSearch({
  value,
  onChange,
  label = 'Search products',
  placeholder = 'Search your next little favourite…',
}) {
  return (
    <label className="search-input shop-search">
      <Search size={19} aria-hidden="true" />
      <input
        type="search"
        aria-label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
      />
    </label>
  );
}

export function ShopPagination({
  page,
  totalPages,
  total,
  onChange,
  noun = 'products',
}) {
  return (
    <nav
      className="pagination shop-pagination"
      aria-label={`${noun} pagination`}
    >
      <span aria-live="polite">
        {total} {noun} · Page {page} of {totalPages}
      </span>
      <div>
        <button
          type="button"
          aria-label="Previous page"
          disabled={page <= 1}
          onClick={() => onChange(page - 1)}
        >
          <ChevronLeft size={18} />
        </button>
        <button
          type="button"
          aria-label="Next page"
          disabled={page >= totalPages}
          onClick={() => onChange(page + 1)}
        >
          <ChevronRight size={18} />
        </button>
      </div>
    </nav>
  );
}

export function ShopState({
  loading,
  error,
  empty,
  onRetry,
  onClear,
  noun = 'products',
  children,
}) {
  if (loading)
    return (
      <div className="shop-state" role="status">
        <LoaderCircle size={30} className="spin" />
        <h3>Loading {noun}…</h3>
        <p>Getting everything ready for you.</p>
      </div>
    );
  if (error)
    return (
      <div className="shop-state" role="alert">
        <AlertCircle size={30} />
        <h3>We couldn’t load the {noun}</h3>
        <p>{error}</p>
        <Button variant="outline" onClick={onRetry}>
          Try again
        </Button>
      </div>
    );
  if (empty)
    return (
      <div className="shop-state">
        <Package size={35} />
        <h3>No {noun} found</h3>
        <p>Try another search or change your filters.</p>
        {onClear && (
          <Button variant="outline" onClick={onClear}>
            Clear all filters
          </Button>
        )}
      </div>
    );
  return children;
}

export function ProductCard({
  product,
  onView,
  onAdd,
  adding = false,
  cartBusy = false,
  preview = false,
}) {
  return (
    <article className="shop-product-card">
      <button
        type="button"
        className="shop-product-image"
        onClick={() => onView(product)}
        aria-label={`View ${product.name}`}
      >
        <ShopImage
          src={product.image}
          alt={product.name}
          loading="lazy"
          width="600"
          height="600"
        />
        <span className={`shop-stock ${product.stock > 0 ? '' : 'sold-out'}`}>
          {product.stock > 0 ? 'In stock' : 'Out of stock'}
        </span>
        <span className="shop-image-arrow">
          <ArrowUpRight size={19} />
        </span>
      </button>
      <div className="shop-product-copy">
        <span className="kicker">{product.categoryName}</span>
        <h3>
          <button type="button" onClick={() => onView(product)}>
            {product.name}
          </button>
        </h3>
        <p>{product.shortDescription || product.description}</p>
        <div className="shop-product-bottom">
          <strong>{shopMoney(product.price)}</strong>
          <button
            type="button"
            className="text-link"
            onClick={() => onView(product)}
            aria-label={`Details of ${product.name}`}
          >
            Details <ArrowUpRight size={16} />
          </button>
        </div>
        {(onAdd || preview) && (
          <Button
            className="order-card-add"
            type="button"
            loading={adding}
            disabled={preview || cartBusy || product.stock === 0}
            onClick={() => onAdd?.(product)}
          >
            <ShoppingBag size={15} />{' '}
            {product.stock > 0 ? 'Add to bag' : 'Out of stock'}
          </Button>
        )}
      </div>
    </article>
  );
}

export function ProductDetails({
  product,
  preview = false,
  onAdd,
  adding = false,
  cartBusy = false,
}) {
  const [quantity, setQuantity] = useState(1);
  const validQuantity =
    Number.isSafeInteger(Number(quantity)) &&
    Number(quantity) >= 1 &&
    Number(quantity) <= Math.min(99, product.stock);
  return (
    <>
      {preview && (
        <div className="shop-note">
          Public shop preview ·{' '}
          {product.status !== 'active'
            ? 'This product is inactive and hidden from the shop.'
            : product.categoryStatus !== 'active'
              ? 'The category is inactive or missing, so this product is hidden from the shop.'
              : 'This product is visible in the shop.'}
        </div>
      )}
      <div className="shop-product-detail">
        <ShopImage
          src={product.image}
          alt={product.name}
          width="600"
          height="600"
        />
        <div>
          <span className="kicker">{product.categoryName}</span>
          <h3>{product.name}</h3>
          <strong className="shop-detail-price">
            {shopMoney(product.price)}
          </strong>
          <span
            className={`shop-stock inline ${product.stock > 0 ? '' : 'sold-out'}`}
          >
            {product.stock > 0
              ? `In stock${preview ? ` · ${product.stock} available` : ''}`
              : 'Out of stock'}
          </span>
          <p className="shop-detail-short">{product.shortDescription}</p>
          <p className="shop-detail-description">
            {product.description || 'A lovely addition to your daily routine.'}
          </p>
          {(onAdd || preview) && (
            <div className="order-detail-purchase">
              <label className="field">
                <span>Quantity</span>
                <input
                  type="number"
                  min="1"
                  max={Math.min(99, product.stock)}
                  step="1"
                  value={quantity}
                  disabled={preview || cartBusy || product.stock === 0}
                  onChange={(e) => setQuantity(e.target.value)}
                />
              </label>
              <Button
                type="button"
                loading={adding}
                disabled={preview || cartBusy || !validQuantity}
                onClick={() => onAdd?.(Number(quantity))}
              >
                <ShoppingBag size={17} />{' '}
                {product.stock ? 'Add to bag' : 'Out of stock'}
              </Button>
            </div>
          )}
          <div className="shop-detail-note">
            <Package size={19} />
            <span>
              A little care, delivered to your door. Explore the collection and
              find your favourites.
            </span>
          </div>
          {preview && (
            <small className="shop-record-id">Product ID: {product.id}</small>
          )}
        </div>
      </div>
    </>
  );
}

export function ImagePicker({
  value,
  onChange,
  onBusyChange,
  error,
  library,
  id,
}) {
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false);
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  async function upload(event) {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const invalid = validateImageFile(file);
    if (invalid) {
      setMessage(invalid);
      return;
    }
    setBusy(true);
    onBusyChange?.(true);
    setMessage('');
    try {
      const data = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () =>
          reject(new Error('This image could not be read.'));
        reader.readAsDataURL(file);
      });
      await new Promise((resolve, reject) => {
        const image = new Image();
        image.onload = () =>
          image.width <= 6000 && image.height <= 6000
            ? resolve()
            : reject(
                new Error('Use an image no larger than 6,000 × 6,000 pixels.'),
              );
        image.onerror = () =>
          reject(new Error('This file is not a readable image.'));
        image.src = data;
      });
      if (mounted.current) onChange(data);
    } catch (e) {
      if (mounted.current) setMessage(e.message);
    } finally {
      if (mounted.current) {
        setBusy(false);
        onBusyChange?.(false);
      }
    }
  }
  const uploaded = value.startsWith('data:');
  return (
    <fieldset className="shop-image-picker" disabled={busy}>
      <legend>Image</legend>
      <div className="shop-image-input">
        <ShopImage
          src={value}
          alt="Selected image preview"
          width="100"
          height="100"
        />
        <div>
          <label className="field">
            <span>HTTPS image URL</span>
            <input
              aria-describedby={`${id}-image-help`}
              aria-invalid={Boolean(error)}
              type="url"
              placeholder="https://…"
              value={uploaded ? '' : value}
              onChange={(e) => {
                setMessage('');
                onChange(e.target.value);
              }}
            />
          </label>
          <label className="shop-file-label">
            {busy ? 'Reading image…' : 'Upload an image'}
            <input
              type="file"
              aria-label="Upload an image"
              accept="image/jpeg,image/png,image/webp"
              onChange={upload}
            />
          </label>
          <small id={`${id}-image-help`}>
            JPG, PNG or WebP · up to 512 KB.{' '}
            {uploaded
              ? 'Uploaded image selected.'
              : 'Or select a sample below.'}
          </small>
        </div>
      </div>
      <div className="shop-image-library" aria-label="Sample images">
        {library.map((image, index) => (
          <button
            type="button"
            key={image}
            className={value === image ? 'selected' : ''}
            aria-pressed={value === image}
            aria-label={`Select sample image ${index + 1}`}
            onClick={() => {
              setMessage('');
              onChange(image);
            }}
          >
            <ShopImage
              src={image}
              alt=""
              width="60"
              height="60"
              loading="lazy"
            />
          </button>
        ))}
        <button
          type="button"
          aria-label="Use default image"
          aria-pressed={!value}
          onClick={() => {
            setMessage('');
            onChange('');
          }}
        >
          <ImageOff size={20} />
        </button>
      </div>
      {(message || error) && (
        <p className="error" role="alert">
          {message || error}
        </p>
      )}
    </fieldset>
  );
}
