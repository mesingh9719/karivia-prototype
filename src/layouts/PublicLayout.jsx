import { useShopCart } from '../context/ShopCartContext';
import React from 'react';
import { Link, NavLink, Outlet } from 'react-router-dom';
import { ArrowUpRight, Flower2, Menu, ShoppingBag } from 'lucide-react';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
export const Brand = () => (
  <Link to="/" className="brand">
    <span className="brand-icon">
      <Flower2 size={23} strokeWidth={2} />
    </span>
    karivia<span className="brand-dot">.</span>
  </Link>
);
export default function PublicLayout() {
  const { user } = useAuth();
  const cart = useShopCart();
  const [open, setOpen] = useState(false);
  return (
    <div className="public-shell">
      <header className="public-header">
        <div className="container header-inner">
          <Brand />
          <nav
            id="public-navigation"
            className={open ? 'public-nav show' : 'public-nav'}
          >
            <NavLink to="/explore" onClick={() => setOpen(false)}>
              Explore services
            </NavLink>
            <NavLink to="/shop" onClick={() => setOpen(false)}>
              Shop
            </NavLink>
            <NavLink to="/orders" onClick={() => setOpen(false)}>
              My orders
            </NavLink>
            <NavLink to="/how-it-works" onClick={() => setOpen(false)}>
              How it works
            </NavLink>
            <NavLink to="/for-business" onClick={() => setOpen(false)}>
              For professionals
            </NavLink>
          </nav>
          <div className="header-actions">
            <Link
              to="/cart"
              className="order-header-bag"
              aria-label={`Your bag, ${cart.itemCount} items`}
            >
              <ShoppingBag size={20} />
              {cart.itemCount > 0 && <span>{cart.itemCount}</span>}
            </Link>
            <Link
              className="subtle-link"
              to={user ? `/app/${user.role}` : '/login'}
            >
              {user ? 'Dashboard' : 'Log in'}
            </Link>
            <Link
              className="btn btn-primary"
              to={user ? '/explore' : '/register'}
            >
              {user ? 'Book now' : 'Get started'} <ArrowUpRight size={16} />
            </Link>
          </div>
          <button
            className="mobile-menu"
            onClick={() => setOpen(!open)}
            aria-label="Toggle menu"
            aria-expanded={open}
            aria-controls="public-navigation"
          >
            <Menu />
          </button>
        </div>
      </header>
      <main>
        <Outlet />
      </main>
      <footer className="public-footer">
        <div className="container footer-grid">
          <div>
            <Brand />
            <p>
              A little time for yourself makes all the difference. Your next
              great beauty experience begins here.
            </p>
          </div>
          <div>
            <b>Explore</b>
            <Link to="/explore">Find a salon</Link>
            <Link to="/shop">Shop essentials</Link>
            <Link to="/orders">My shop orders</Link>
            <Link to="/explore?kind=freelancer">Beauty professionals</Link>
            <Link to="/how-it-works">How it works</Link>
          </div>
          <div>
            <b>Karivia</b>
            <Link to="/for-business">For businesses</Link>
            <Link to="/register">Become a partner</Link>
            <Link to="/login">Account</Link>
          </div>
          <div>
            <b>Connect</b>
            <a href="mailto:hello@karivia.example">hello@karivia.example</a>
            <span>New Delhi, India</span>
            <span>© 2026 Karivia</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
