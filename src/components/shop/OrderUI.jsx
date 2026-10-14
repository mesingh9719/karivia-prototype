import { Check, Clock, Package, Truck } from 'lucide-react';
import { nice } from '../../utils/format';
import { ShopImage, shopMoney } from './ShopUI';

export const orderDate = (value) => {
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? 'Date unavailable'
    : date.toLocaleString('en-IN', {
        dateStyle: 'medium',
        timeStyle: 'short',
        timeZone: 'Asia/Kolkata',
      });
};
export function OrderStatus({ status }) {
  return (
    <span className={`order-status order-status-${status}`}>
      {nice(status)}
    </span>
  );
}
export function QuantityControl({ value, max, disabled, onChange, name }) {
  return (
    <div className="order-quantity" aria-label={`Quantity for ${name}`}>
      <button
        type="button"
        aria-label={`Decrease ${name} quantity`}
        disabled={disabled || value <= 1}
        onClick={() => onChange(Math.max(1, Math.min(value - 1, max)))}
      >
        −
      </button>
      <output aria-live="polite">{value}</output>
      <button
        type="button"
        aria-label={`Increase ${name} quantity`}
        disabled={disabled || value >= max}
        onClick={() => onChange(value + 1)}
      >
        +
      </button>
    </div>
  );
}
export function OrderTotals({ subtotal, shipping = 0, total = subtotal }) {
  return (
    <dl className="order-totals">
      <div>
        <dt>Subtotal</dt>
        <dd>{shopMoney(subtotal)}</dd>
      </div>
      <div>
        <dt>Delivery</dt>
        <dd>{shipping ? shopMoney(shipping) : 'Complimentary'}</dd>
      </div>
      <div className="order-total">
        <dt>Total</dt>
        <dd>{shopMoney(total)}</dd>
      </div>
    </dl>
  );
}
export function OrderDetails({ order, admin = false }) {
  const stages = ['pending', 'confirmed', 'processing', 'shipped', 'delivered'];
  return (
    <div className="order-details">
      <div className="order-detail-meta">
        <div>
          <span className="kicker">{order.number}</span>
          <p>Placed {orderDate(order.createdAt)}</p>
        </div>
        <OrderStatus status={order.status} />
      </div>
      {order.needsReview ? (
        <div className="shop-note">
          This order contains incomplete local data. Status changes are
          disabled.
        </div>
      ) : order.status === 'cancelled' ? (
        <div className="order-cancel-notice">
          This order was cancelled. Stock was restored for products still in the
          collection.
        </div>
      ) : (
        <ol className="order-progress" aria-label="Order progress">
          {stages.map((status, index) => (
            <li
              key={status}
              className={
                index <= stages.indexOf(order.status) ? 'complete' : ''
              }
            >
              <span>
                {index <= stages.indexOf(order.status) ? (
                  <Check size={13} />
                ) : (
                  index + 1
                )}
              </span>
              <small>{nice(status)}</small>
            </li>
          ))}
        </ol>
      )}
      <div className="order-detail-columns">
        <section>
          <h3>
            <Package size={18} /> Your items
          </h3>
          <div className="order-detail-items">
            {order.items.map((item, index) => (
              <div className="order-item" key={`${item.productId}-${index}`}>
                <ShopImage
                  src={item.image}
                  alt={item.name}
                  width="64"
                  height="64"
                />
                <div>
                  <b>{item.name}</b>
                  <small>
                    {item.quantity} × {shopMoney(item.unitPrice)}
                  </small>
                </div>
                <strong>{shopMoney(item.lineTotal)}</strong>
              </div>
            ))}
          </div>
          <OrderTotals {...order} />
          <div className="order-payment-info">
            <b>Cash on delivery</b>
            <span
              className={`order-payment order-payment-${order.paymentStatus}`}
            >
              {nice(order.paymentStatus)} · prototype
            </span>
          </div>
        </section>
        <section className="order-delivery-details">
          <h3>
            <Truck size={18} /> Delivery details
          </h3>
          <address>
            <b>{order.customer.name}</b>
            <span>{order.customer.address}</span>
            <span>
              {order.customer.city} — {order.customer.postalCode}
            </span>
            <span>{order.customer.country}</span>
            <span>{order.customer.phone}</span>
            <span>{order.customer.email}</span>
          </address>
          {order.notes && (
            <div className="order-note">
              <b>Delivery notes</b>
              <p>{order.notes}</p>
            </div>
          )}
          {order.trackingNumber && (
            <div className="order-note">
              <b>Tracking reference</b>
              <p>{order.trackingNumber}</p>
            </div>
          )}
          {admin && order.adminNotes && (
            <div className="order-note">
              <b>Internal notes</b>
              <p>{order.adminNotes}</p>
            </div>
          )}
          <h3 className="order-history-heading">
            <Clock size={17} /> Order history
          </h3>
          <ol className="order-history">
            {order.history.map((entry, index) => (
              <li key={`${entry.at}-${index}`}>
                <b>{nice(entry.status)}</b>
                <small>{orderDate(entry.at)}</small>
              </li>
            ))}
          </ol>
        </section>
      </div>
    </div>
  );
}
