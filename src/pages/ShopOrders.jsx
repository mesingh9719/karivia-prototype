import { useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Package,
  ShoppingBag,
  XCircle,
} from 'lucide-react';
import { Button, Field } from '../components/UI';
import {
  ShopDialog,
  ShopImage,
  ShopPagination,
  ShopSearch,
  ShopState,
  shopMoney,
} from '../components/shop/ShopUI';
import {
  OrderDetails,
  OrderStatus,
  orderDate,
} from '../components/shop/OrderUI';
import { useShopOrder, useShopOrders } from '../hooks/useShopOrders';
import { useAuth } from '../context/AuthContext';
import { useToast } from '../context/ToastContext';
import { ordersService } from '../services/shop/ordersService';
import { ORDER_STATUSES, canCustomerCancel } from '../services/shop/orderRules';
import { nice } from '../utils/format';

export default function ShopOrders() {
  const { user } = useAuth(),
    [params, setParams] = useSearchParams();
  const filters = {
    accountId: user?.id || '',
    customerOnly: true,
    search: params.get('q') || '',
    status: params.get('status') || '',
    sort: params.get('sort') || 'newest',
    page: Number(params.get('page')) || 1,
    pageSize: 6,
  };
  const result = useShopOrders(filters);
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
  const filtered =
    filters.search || filters.status || filters.sort !== 'newest';
  return (
    <div className="container orders-public-page">
      <Link to="/shop" className="back-link">
        <ArrowLeft size={16} /> Back to the collection
      </Link>
      <div className="orders-page-heading">
        <div>
          <span className="kicker">THE GOOD THINGS YOU CHOSE</span>
          <h1>Your orders, all together.</h1>
          <p>
            {user
              ? `Order history for ${user.name}.`
              : 'Your guest orders are saved in this browser.'}
          </p>
        </div>
        <Link to="/cart" className="btn btn-outline">
          <ShoppingBag size={17} /> Your bag
        </Link>
      </div>
      <div className="orders-public-controls">
        <ShopSearch
          label="Search your orders"
          placeholder="Search order number or product…"
          value={filters.search}
          onChange={(value) => change('q', value)}
        />
        <Field
          label="Order status"
          as="select"
          value={filters.status}
          onChange={(e) => change('status', e.target.value)}
          options={[
            { value: '', label: 'All statuses' },
            ...ORDER_STATUSES.map((value) => ({ value, label: nice(value) })),
          ]}
        />
        <Field
          label="Sort by"
          as="select"
          value={filters.sort}
          onChange={(e) => change('sort', e.target.value)}
          options={[
            { value: 'newest', label: 'Newest first' },
            { value: 'oldest', label: 'Oldest first' },
            { value: 'total_desc', label: 'Highest total' },
            { value: 'total_asc', label: 'Lowest total' },
          ]}
        />
        <Button
          variant="ghost"
          disabled={!filtered}
          onClick={() => setParams({})}
        >
          Clear filters
        </Button>
      </div>
      <ShopState
        loading={result.loading}
        error={result.error}
        onRetry={result.refresh}
        noun="orders"
      >
        {!result.total ? (
          <div className="order-empty">
            <Package size={40} />
            <h2>
              {filtered
                ? 'No orders match your filters.'
                : 'Your first ritual is waiting.'}
            </h2>
            <p>
              {filtered
                ? 'Try another search or clear your filters.'
                : 'Choose a few essentials and place your first prototype order.'}
            </p>
            {filtered ? (
              <Button variant="outline" onClick={() => setParams({})}>
                Clear all filters
              </Button>
            ) : (
              <Link className="btn btn-primary" to="/shop">
                Explore the shop <ArrowRight size={16} />
              </Link>
            )}
          </div>
        ) : (
          <>
            <div className="orders-public-grid">
              {result.data.map((order) => (
                <article className="card order-history-card" key={order.id}>
                  <div className="order-card-heading">
                    <Link to={`/orders/${order.id}`}>{order.number}</Link>
                    <OrderStatus status={order.status} />
                  </div>
                  <small>Placed {orderDate(order.createdAt)}</small>
                  <div className="order-card-products">
                    {order.items.slice(0, 3).map((item, index) => (
                      <ShopImage
                        key={`${item.productId}-${index}`}
                        src={item.image}
                        alt={item.name}
                        width="65"
                        height="65"
                      />
                    ))}
                    {order.items.length > 3 && (
                      <span>+{order.items.length - 3}</span>
                    )}
                    <div>
                      <b>{order.items[0]?.name || 'Order needs review'}</b>
                      <small>
                        {order.items.reduce(
                          (sum, item) => sum + item.quantity,
                          0,
                        )}{' '}
                        item(s)
                      </small>
                    </div>
                  </div>
                  <div className="order-card-footer">
                    <strong>{shopMoney(order.total)}</strong>
                    <Link to={`/orders/${order.id}`} className="text-link">
                      View order <ArrowRight size={16} />
                    </Link>
                  </div>
                </article>
              ))}
            </div>
            <ShopPagination
              {...result}
              noun="orders"
              onChange={(page) => change('page', String(page))}
            />
          </>
        )}
      </ShopState>
    </div>
  );
}

export function ShopOrderDetail() {
  const { id } = useParams(),
    { user } = useAuth(),
    toast = useToast();
  const result = useShopOrder(id, {
    accountId: user?.id || '',
    customerOnly: true,
  });
  const [confirm, setConfirm] = useState(false),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('');
  const pending = useRef(false);
  async function cancel() {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      await ordersService.cancel(id, { accountId: user?.id || '' });
      setConfirm(false);
      toast('Your order has been cancelled.');
    } catch (error) {
      setError(error.message);
      toast(error.message, 'error');
    } finally {
      pending.current = false;
      setBusy(false);
    }
  }
  return (
    <div className="container orders-public-page">
      <Link to="/orders" className="back-link">
        <ArrowLeft size={16} /> All your orders
      </Link>
      <div className="orders-page-heading">
        <div>
          <span className="kicker">YOUR SELF-CARE DELIVERY</span>
          <h1>A little care, step by step.</h1>
        </div>
        <Link className="btn btn-outline" to="/shop">
          Keep exploring
        </Link>
      </div>
      <ShopState
        loading={result.loading}
        error={result.error}
        onRetry={result.refresh}
        noun="order"
      >
        {result.order && (
          <section className="card order-full-card">
            <OrderDetails order={result.order} />
            {canCustomerCancel(result.order) && (
              <div className="order-cancel-action">
                <p>
                  Changed your mind? You can cancel before the order starts
                  processing.
                </p>
                <Button
                  variant="outline"
                  onClick={() => {
                    setError('');
                    setConfirm(true);
                  }}
                >
                  <XCircle size={16} /> Cancel order
                </Button>
              </div>
            )}
            <p className="order-prototype-note">
              Local prototype order · No real payment or delivery takes place.
            </p>
          </section>
        )}
      </ShopState>
      {confirm && (
        <ShopDialog
          title="Cancel this order?"
          onClose={() => setConfirm(false)}
          busy={busy}
        >
          <p>
            Cancel order <b>{result.order?.number || id}</b>? Its items will be
            returned to available stock. This cannot be undone.
          </p>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <div className="form-actions">
            <Button
              variant="outline"
              disabled={busy}
              onClick={() => setConfirm(false)}
            >
              Keep order
            </Button>
            <Button
              className="shop-danger-button"
              loading={busy}
              onClick={cancel}
            >
              Cancel order
            </Button>
          </div>
        </ShopDialog>
      )}
    </div>
  );
}
