import { useRef, useState } from 'react';
import { Link, NavLink, useSearchParams } from 'react-router-dom';
import {
  ArrowUpRight,
  Clock,
  Eye,
  FolderOpen,
  Package,
  ShoppingBag,
  Truck,
  Wallet,
} from 'lucide-react';
import { Button, Field } from '../components/UI';
import {
  ShopDialog,
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
import { ordersService } from '../services/shop/ordersService';
import { ORDER_STATUSES, ORDER_TRANSITIONS } from '../services/shop/orderRules';
import { useToast } from '../context/ToastContext';
import { nice } from '../utils/format';

function AdminOrderDialog({ id, onClose }) {
  const result = useShopOrder(id);
  const [busy, setBusy] = useState(false),
    [saved, setSaved] = useState(false);
  return (
    <ShopDialog
      title={result.order?.number || 'Order details'}
      wide
      onClose={onClose}
      busy={busy}
    >
      <ShopState
        loading={result.loading}
        error={result.error}
        onRetry={result.refresh}
        noun="order"
      >
        {result.order && (
          <OrderEditor
            key={`${result.order.id}-${result.order.updatedAt}`}
            order={result.order}
            onBusyChange={setBusy}
            onSaved={() => setSaved(true)}
            onEditing={() => setSaved(false)}
          />
        )}
      </ShopState>
      {saved && (
        <p className="order-save-notice" role="status">
          Order changes saved.
        </p>
      )}
    </ShopDialog>
  );
}

function OrderEditor({ order, onBusyChange, onSaved, onEditing }) {
  const [form, setForm] = useState({
    status: order.status,
    trackingNumber: order.trackingNumber,
    adminNotes: order.adminNotes,
  });
  const [busy, setBusy] = useState(false),
    [confirm, setConfirm] = useState(false),
    [error, setError] = useState('');
  const toast = useToast(),
    pending = useRef(false);
  const transitions = ORDER_TRANSITIONS[order.status] || [];
  const dirty =
    form.status !== order.status ||
    form.trackingNumber !== order.trackingNumber ||
    form.adminNotes !== order.adminNotes;
  const set = (key, value) => {
    onEditing();
    setForm((f) => ({ ...f, [key]: value }));
    setError('');
  };
  async function save() {
    if (pending.current || order.needsReview) return;
    pending.current = true;
    setBusy(true);
    onBusyChange(true);
    setError('');
    try {
      await ordersService.update(order.id, form);
      setConfirm(false);
      toast('Order updated.');
      onSaved();
    } catch (error) {
      setError(error.message);
      toast(error.message, 'error');
    } finally {
      pending.current = false;
      setBusy(false);
      onBusyChange(false);
    }
  }
  return (
    <>
      <OrderDetails order={order} admin />
      <form
        className="order-admin-editor"
        onSubmit={(event) => {
          event.preventDefault();
          if (form.status === 'cancelled' && order.status !== 'cancelled')
            setConfirm(true);
          else save();
        }}
      >
        <h3>Manage this order</h3>
        <fieldset
          disabled={busy || order.needsReview}
          className="shop-form-fields"
        >
          <div className="shop-form-grid">
            <Field
              label="Order status"
              as="select"
              value={form.status}
              onChange={(e) => set('status', e.target.value)}
              options={[
                { value: order.status, label: nice(order.status) },
                ...transitions.map((value) => ({ value, label: nice(value) })),
              ]}
            />
            <Field
              label="Tracking reference"
              maxLength={100}
              value={form.trackingNumber}
              placeholder="Optional reference number"
              onChange={(e) => set('trackingNumber', e.target.value)}
            />
            <div className="shop-form-span">
              <Field
                label="Internal notes"
                as="textarea"
                rows={3}
                maxLength={1000}
                value={form.adminNotes}
                placeholder="Visible to admins only"
                onChange={(e) => set('adminNotes', e.target.value)}
              />
            </div>
          </div>
        </fieldset>
        <p className="shop-form-hint">
          Cash-on-delivery payment is marked paid when this prototype order is
          delivered. Order items and prices stay as purchased.
        </p>
        {error && (
          <p className="error" role="alert">
            {error}
          </p>
        )}
        {confirm ? (
          <div className="order-inline-confirm" role="alert">
            <p>
              Cancel <b>{order.number}</b> and restore its stock? This cannot be
              undone.
            </p>
            <div className="form-actions">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setConfirm(false)}
              >
                Go back
              </Button>
              <Button
                type="button"
                className="shop-danger-button"
                loading={busy}
                onClick={save}
              >
                Confirm cancellation
              </Button>
            </div>
          </div>
        ) : (
          <div className="form-actions">
            <Button
              type="submit"
              loading={busy}
              disabled={!dirty || order.needsReview}
            >
              Save order changes
            </Button>
          </div>
        )}
      </form>
    </>
  );
}

export default function ShopOrderManagement() {
  const [params, setParams] = useSearchParams(),
    [selected, setSelected] = useState(null);
  const filters = {
    search: params.get('q') || '',
    status: params.get('status') || '',
    paymentStatus: params.get('payment') || '',
    sort: params.get('sort') || 'newest',
    minDate: params.get('from') || '',
    maxDate: params.get('to') || '',
    page: Number(params.get('page')) || 1,
    pageSize: 8,
  };
  const result = useShopOrders(filters);
  const filtered =
    filters.search ||
    filters.status ||
    filters.paymentStatus ||
    filters.minDate ||
    filters.maxDate ||
    filters.sort !== 'newest';
  const dateError =
    filters.minDate && filters.maxDate && filters.minDate > filters.maxDate
      ? 'The end date must be on or after the start date.'
      : '';
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
  const stats = [
    {
      label: 'Total orders',
      value: result.summary.total || 0,
      icon: ShoppingBag,
    },
    {
      label: 'Awaiting confirmation',
      value: result.summary.pending || 0,
      icon: Clock,
    },
    { label: 'In fulfilment', value: result.summary.open || 0, icon: Truck },
    {
      label: 'Delivered order value',
      value: shopMoney(result.summary.completedValue || 0),
      icon: Wallet,
    },
  ];
  return (
    <div className="shop-management orders-management">
      <div className="resource-head">
        <div>
          <span className="kicker">SHOP MANAGEMENT</span>
          <h1>Good things, on their way.</h1>
          <p>Manage orders, delivery progress, and customer details.</p>
        </div>
        <Link className="btn btn-outline" to="/shop">
          View public shop <ArrowUpRight size={16} />
        </Link>
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
            <ShoppingBag size={17} /> Orders
          </NavLink>
        </nav>
      </div>
      <div className="metrics-grid orders-metrics">
        {stats.map(({ label, value, icon: Icon }) => (
          <section className="card metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{result.loading ? '…' : value}</strong>
            <small>Local prototype</small>
          </section>
        ))}
      </div>
      <section className="card table-panel">
        <div className="shop-admin-controls">
          <ShopSearch
            label="Search orders"
            placeholder="Order number, customer, or product…"
            value={filters.search}
            onChange={(value) => change('q', value)}
          />
          <Field
            label="Status"
            as="select"
            value={filters.status}
            onChange={(e) => change('status', e.target.value)}
            options={[
              { value: '', label: 'All statuses' },
              ...ORDER_STATUSES.map((value) => ({ value, label: nice(value) })),
              { value: 'needs_review', label: 'Needs review' },
            ]}
          />
          <Field
            label="Payment"
            as="select"
            value={filters.paymentStatus}
            onChange={(e) => change('payment', e.target.value)}
            options={[
              { value: '', label: 'All payments' },
              { value: 'unpaid', label: 'Unpaid' },
              { value: 'paid', label: 'Paid' },
            ]}
          />
          <Field
            label="From date"
            type="date"
            value={filters.minDate}
            onChange={(e) => change('from', e.target.value)}
          />
          <Field
            label="To date"
            type="date"
            value={filters.maxDate}
            onChange={(e) => change('to', e.target.value)}
            aria-invalid={Boolean(dateError)}
            aria-describedby={dateError ? 'order-date-error' : undefined}
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
          {dateError && (
            <p id="order-date-error" className="error" role="alert">
              {dateError}
            </p>
          )}
        </div>
        {!dateError && (
          <>
            <ShopState
              loading={result.loading}
              error={result.error}
              empty={!result.total}
              noun="orders"
              onRetry={result.refresh}
              onClear={filtered ? () => setParams({}) : undefined}
            >
              <div className="table-scroll">
                <table className="data-table shop-admin-table orders-admin-table">
                  <caption className="shop-sr-only">
                    Shop orders and fulfilment actions
                  </caption>
                  <thead>
                    <tr>
                      <th scope="col">Order</th>
                      <th scope="col">Customer</th>
                      <th scope="col">Total</th>
                      <th scope="col">Status</th>
                      <th scope="col">Payment</th>
                      <th scope="col">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.data.map((order) => (
                      <tr key={order.id}>
                        <td>
                          <button
                            className="order-number-link"
                            onClick={() => setSelected(order.id)}
                          >
                            {order.number}
                          </button>
                          <small className="order-table-date">
                            {orderDate(order.createdAt)}
                          </small>
                          <small className="order-table-date">
                            {order.items.reduce(
                              (sum, item) => sum + item.quantity,
                              0,
                            )}{' '}
                            item(s)
                          </small>
                        </td>
                        <td data-label="Customer">
                          <strong>{order.customer.name || 'Customer'}</strong>
                          <small className="order-table-date">
                            {order.customer.email}
                          </small>
                        </td>
                        <td data-label="Total">
                          <strong>{shopMoney(order.total)}</strong>
                        </td>
                        <td data-label="Status">
                          <OrderStatus status={order.status} />
                        </td>
                        <td data-label="Payment">
                          <span
                            className={`order-payment order-payment-${order.paymentStatus}`}
                          >
                            {nice(order.paymentStatus)}
                          </span>
                          <small className="order-table-date">
                            Cash on delivery
                          </small>
                        </td>
                        <td data-label="Actions" className="shop-action-cell">
                          <div className="row-actions">
                            <button
                              type="button"
                              aria-label={`View and manage order ${order.number}`}
                              title="View and manage order"
                              onClick={() => setSelected(order.id)}
                            >
                              <Eye size={17} />
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
                noun="orders"
                onChange={(page) => change('page', String(page))}
              />
            )}
          </>
        )}
      </section>
      <p className="shop-admin-caption">
        Orders and stock updates persist in this browser. No real payments,
        shipping, or backend requests.
      </p>
      {selected && (
        <AdminOrderDialog id={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
