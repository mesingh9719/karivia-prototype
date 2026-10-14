import { useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Package,
  ShoppingBag,
  Trash2,
} from 'lucide-react';
import { Button, Field } from '../components/UI';
import {
  ShopDialog,
  ShopImage,
  ShopState,
  shopMoney,
} from '../components/shop/ShopUI';
import { OrderTotals, QuantityControl } from '../components/shop/OrderUI';
import { useShopCart } from '../context/ShopCartContext';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ordersService } from '../services/shop/ordersService';

export default function ShopCart() {
  const cart = useShopCart(),
    [clear, setClear] = useState(false);
  const [actionError, setActionError] = useState('');
  async function change(action) {
    setActionError('');
    try {
      await action();
    } catch (error) {
      setActionError(error.message);
    }
  }
  return (
    <div className="container orders-public-page">
      <Link to="/shop" className="back-link">
        <ArrowLeft size={16} /> Continue shopping
      </Link>
      <div className="orders-page-heading">
        <div>
          <span className="kicker">YOUR SELF-CARE EDIT</span>
          <h1>Your little bag of good things.</h1>
          <p>Review your favourites before making them yours.</p>
        </div>
        <Link to="/orders" className="text-link">
          My orders <ArrowRight size={16} />
        </Link>
      </div>
      <ShopState
        loading={cart.loading && !cart.items.length}
        error={cart.error}
        onRetry={cart.refresh}
        noun="bag"
      >
        {cart.items.length ? (
          <div className="order-checkout-layout">
            <section className="card order-cart-panel">
              <div className="order-cart-heading">
                <h2>
                  {cart.itemCount} item{cart.itemCount === 1 ? '' : 's'} in your
                  bag
                </h2>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setActionError('');
                    setClear(true);
                  }}
                  disabled={cart.busy}
                >
                  Clear bag
                </Button>
              </div>
              {cart.items.map((item) => (
                <article className="order-cart-item" key={item.productId}>
                  <ShopImage
                    src={item.image}
                    alt={item.name}
                    width="100"
                    height="100"
                  />
                  <div className="order-cart-copy">
                    <span className="kicker">{item.categoryName}</span>
                    <h3>{item.name}</h3>
                    <span>{shopMoney(item.unitPrice)} each</span>
                    {item.issue && <p className="error">{item.issue}</p>}
                    <QuantityControl
                      name={item.name}
                      value={item.quantity}
                      max={item.maxQuantity}
                      disabled={
                        cart.busy || cart.loading || item.maxQuantity === 0
                      }
                      onChange={(quantity) =>
                        change(() => cart.setQuantity(item.productId, quantity))
                      }
                    />
                  </div>
                  <div className="order-cart-end">
                    <strong>{shopMoney(item.lineTotal)}</strong>
                    <button
                      type="button"
                      className="icon-btn"
                      aria-label={`Remove ${item.name}`}
                      disabled={cart.busy}
                      onClick={() =>
                        change(() => cart.removeItem(item.productId))
                      }
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </article>
              ))}
              {actionError && (
                <p className="error" role="alert">
                  {actionError}
                </p>
              )}
            </section>
            <aside className="card order-summary">
              <span className="kicker">A MOMENT FOR YOU</span>
              <h2>Order summary</h2>
              <OrderTotals subtotal={cart.subtotal} />
              <p>
                <Package size={17} /> Complimentary delivery within India.
              </p>
              {cart.canCheckout && !cart.busy && !cart.loading ? (
                <Link to="/checkout" className="btn btn-primary full">
                  Continue to checkout <ArrowRight size={16} />
                </Link>
              ) : (
                <Button className="full" disabled>
                  Review your bag to continue
                </Button>
              )}
              <small>Cash on delivery · Local prototype</small>
            </aside>
          </div>
        ) : (
          <div className="order-empty">
            <ShoppingBag size={42} />
            <h2>Your bag is waiting for a little care.</h2>
            <p>Discover something lovely for your daily routine.</p>
            <Link className="btn btn-primary" to="/shop">
              Explore the collection <ArrowRight size={16} />
            </Link>
          </div>
        )}
      </ShopState>
      {clear && (
        <ShopDialog
          title="Clear your bag?"
          busy={cart.busy}
          onClose={() => setClear(false)}
        >
          <p>
            Remove all products from your bag? Your existing orders will stay in
            your order history.
          </p>
          {actionError && (
            <p className="error" role="alert">
              {actionError}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={cart.busy}
              onClick={() => setClear(false)}
            >
              Keep shopping
            </Button>
            <Button
              loading={cart.busy}
              onClick={async () => {
                try {
                  await cart.clearCart();
                  setClear(false);
                } catch (error) {
                  setActionError(error.message);
                }
              }}
            >
              Clear bag
            </Button>
          </div>
        </ShopDialog>
      )}
    </div>
  );
}

export function ShopCheckout() {
  const cart = useShopCart(),
    { user } = useAuth(),
    navigate = useNavigate(),
    toast = useToast();
  const [form, setForm] = useState(() => ({
    name: user?.name || '',
    email: user?.email || '',
    phone: user?.phone || '',
    address: '',
    city: '',
    postalCode: '',
    country: 'India',
    notes: '',
  }));
  const [errors, setErrors] = useState({}),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [placed, setPlaced] = useState(null);
  const pending = useRef(false),
    formRef = useRef(null),
    focusError = useRef(false),
    requestToken = useRef(crypto.randomUUID());
  useEffect(() => {
    if (focusError.current) {
      formRef.current?.querySelector('[aria-invalid="true"]')?.focus();
      focusError.current = false;
    }
  }, [errors]);
  const set = (key, value) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => ({ ...e, [key]: '' }));
    setError('');
  };
  const field = (key) => ({
    value: form[key],
    onChange: (e) => set(key, e.target.value),
    error: errors[key],
    'aria-invalid': Boolean(errors[key]),
    'aria-describedby': errors[key] ? `checkout-${key}-error` : undefined,
  });
  async function submit(event) {
    event.preventDefault();
    if (pending.current || !cart.canCheckout || cart.busy || cart.loading)
      return;
    pending.current = true;
    setBusy(true);
    setError('');
    setErrors({});
    try {
      const { notes, ...customer } = form;
      const order = await ordersService.create(
        {
          customer,
          notes,
          paymentMethod: 'cod',
          requestToken: requestToken.current,
          items: cart.items.map((item) => ({
            productId: item.productId,
            quantity: item.quantity,
            unitPrice: item.unitPrice,
          })),
        },
        { accountId: cart.accountId },
      );
      setPlaced(order);
      toast('Your prototype order has been placed.');
    } catch (error) {
      if (error.fields) {
        focusError.current = true;
        setErrors(error.fields);
      } else setError(error.message);
      toast(error.message, 'error');
      cart.refresh();
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  if (placed)
    return (
      <div className="container orders-public-page">
        <div className="order-success">
          <span>
            <CheckCircle2 size={42} />
          </span>
          <span className="kicker">A LITTLE CARE IS ON ITS WAY</span>
          <h1>Thank you, {placed.customer.name.split(' ')[0]}.</h1>
          <p>
            Your prototype order <b>{placed.number}</b> has been saved.
            <br />
            You can follow its progress in My orders.
          </p>
          <strong>{shopMoney(placed.total)}</strong>
          <div className="order-success-actions">
            <Button onClick={() => navigate(`/orders/${placed.id}`)}>
              View order <ArrowRight size={16} />
            </Button>
            <Link className="btn btn-outline" to="/shop">
              Keep exploring
            </Link>
          </div>
          <small>
            This is a local demonstration. No payment is collected or delivery
            arranged.
          </small>
        </div>
      </div>
    );
  return (
    <div className="container orders-public-page">
      <Link to="/cart" className="back-link">
        <ArrowLeft size={16} /> Back to your bag
      </Link>
      <div className="orders-page-heading">
        <div>
          <span className="kicker">ONE LAST LITTLE STEP</span>
          <h1>Make room for good things.</h1>
          <p>Add your delivery details and review your order.</p>
        </div>
      </div>
      <ShopState
        loading={cart.loading && !cart.items.length}
        error={cart.error}
        onRetry={cart.refresh}
        noun="checkout"
      >
        {cart.items.length ? (
          <form
            ref={formRef}
            onSubmit={submit}
            noValidate
            className="order-checkout-layout"
          >
            <section className="card order-delivery-form">
              <h2>Delivery details</h2>
              <fieldset disabled={busy} className="shop-form-fields">
                <div className="shop-form-grid">
                  <Field
                    label="Full name *"
                    maxLength={120}
                    autoComplete="name"
                    required
                    {...field('name')}
                  />
                  <Field
                    label="Email address *"
                    type="email"
                    maxLength={254}
                    autoComplete="email"
                    required
                    {...field('email')}
                  />
                  <Field
                    label="Phone number *"
                    type="tel"
                    maxLength={24}
                    autoComplete="tel"
                    required
                    {...field('phone')}
                  />
                  <Field label="Country" readOnly {...field('country')} />
                  <div className="shop-form-span">
                    <Field
                      label="Delivery address *"
                      as="textarea"
                      rows={3}
                      maxLength={400}
                      autoComplete="street-address"
                      required
                      placeholder="House number, street, and landmark"
                      {...field('address')}
                    />
                  </div>
                  <Field
                    label="City *"
                    maxLength={100}
                    autoComplete="address-level2"
                    required
                    {...field('city')}
                  />
                  <Field
                    label="PIN code *"
                    inputMode="numeric"
                    maxLength={6}
                    autoComplete="postal-code"
                    required
                    {...field('postalCode')}
                  />
                  <div className="shop-form-span">
                    <Field
                      label="Delivery notes"
                      as="textarea"
                      rows={2}
                      maxLength={500}
                      placeholder="Anything we should know? (optional)"
                      {...field('notes')}
                    />
                  </div>
                </div>
                <div className="order-cod">
                  <CheckCircle2 size={20} />
                  <div>
                    <b>Cash on delivery</b>
                    <p>
                      Pay when your order arrives. This prototype does not
                      collect payments or arrange deliveries.
                    </p>
                  </div>
                </div>
              </fieldset>
              {error && (
                <p className="error" role="alert">
                  {error}
                </p>
              )}
              {!cart.canCheckout && (
                <div className="shop-note">
                  Some items need your attention.{' '}
                  <Link to="/cart">Review your bag</Link> before placing the
                  order.
                </div>
              )}
            </section>
            <aside className="card order-summary">
              <h2>Your order</h2>
              <div className="order-checkout-items">
                {cart.items.map((item) => (
                  <div key={item.productId} className="order-item">
                    <ShopImage src={item.image} alt="" width="48" height="48" />
                    <div>
                      <b>{item.name}</b>
                      <small>Quantity: {item.quantity}</small>
                      {item.issue && (
                        <small className="error">{item.issue}</small>
                      )}
                    </div>
                    <strong>{shopMoney(item.lineTotal)}</strong>
                  </div>
                ))}
              </div>
              <OrderTotals subtotal={cart.subtotal} />
              <Button
                type="submit"
                className="full"
                loading={busy}
                disabled={!cart.canCheckout || cart.busy || cart.loading}
              >
                Place prototype order <ArrowRight size={16} />
              </Button>
              <small>
                Your order is saved in this browser. No real payment or delivery
                takes place.
              </small>
            </aside>
          </form>
        ) : (
          <div className="order-empty">
            <ShoppingBag size={40} />
            <h2>Your bag is empty.</h2>
            <p>Add your favourite essentials before checking out.</p>
            <Link className="btn btn-primary" to="/shop">
              Browse the shop
            </Link>
          </div>
        )}
      </ShopState>
    </div>
  );
}
