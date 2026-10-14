import { lazy, Suspense } from 'react';
import VerificationReviews from './pages/VerificationReviews';
import React from 'react';
import { Routes, Route, Navigate, Link, useParams } from 'react-router-dom';
import PublicLayout from './layouts/PublicLayout';
import DashboardLayout from './layouts/DashboardLayout';
import {
  Landing,
  Explore,
  ProviderDetail,
  BookingFlow,
  HowItWorks,
  ForBusiness,
} from './pages/PublicPages';
import {
  Login,
  Register,
  ForgotPassword,
  ResetPassword,
  VerifyOtp,
  VerifyDocuments,
} from './pages/AuthPages';
import {
  Overview,
  ResourcePage,
  CalendarPage,
  ReportsPage,
  SettingsPage,
  SavedPage,
} from './pages/DashboardPages';
import { useAuth } from './context/AuthContext';
const Shop = lazy(() => import('./pages/Shop'));
const ShopManagement = lazy(() => import('./pages/ShopManagement'));
const ShopCart = lazy(() => import('./pages/ShopCart'));
const ShopCheckout = lazy(() =>
  import('./pages/ShopCart').then((module) => ({
    default: module.ShopCheckout,
  })),
);
const ShopOrders = lazy(() => import('./pages/ShopOrders'));
const ShopOrderDetail = lazy(() =>
  import('./pages/ShopOrders').then((module) => ({
    default: module.ShopOrderDetail,
  })),
);
const ShopOrderManagement = lazy(() => import('./pages/ShopOrderManagement'));
const shopFallback = (
  <div className="state" role="status">
    Loading shop…
  </div>
);
function RequireRole() {
  const { user } = useAuth();
  if (!user) return <Navigate to="/login" replace />;
  return <DashboardLayout />;
}
function ModulePage() {
  const { module } = useParams();
  const { user } = useAuth();
  if (user?.role === 'admin' && module === 'shop')
    return (
      <Suspense fallback={shopFallback}>
        <ShopManagement key="products" kind="products" />
      </Suspense>
    );
  if (user?.role === 'admin' && module === 'shop-categories')
    return (
      <Suspense fallback={shopFallback}>
        <ShopManagement key="categories" kind="categories" />
      </Suspense>
    );
  if (user?.role === 'admin' && module === 'shop-orders')
    return (
      <Suspense fallback={shopFallback}>
        <ShopOrderManagement />
      </Suspense>
    );
  if (module === 'verifications') return <VerificationReviews />;
  if (module === 'calendar') return <CalendarPage />;
  if (module === 'reports') return <ReportsPage />;
  if (module === 'settings') return <SettingsPage />;
  if (module === 'saved') return <SavedPage />;
  const kind = module === 'customers' ? 'users' : module;
  return [
    'bookings',
    'services',
    'staff',
    'providers',
    'users',
    'verifications',
    'reviews',
  ].includes(kind) ? (
    <ResourcePage key={kind} kind={kind} />
  ) : (
    <NotFound />
  );
}
function NotFound() {
  return (
    <div className="not-found">
      <span>404</span>
      <h1>A little detour.</h1>
      <p>
        We couldn't find that page, but there is plenty of beauty to explore.
      </p>
      <Link className="btn btn-primary" to="/">
        Back home
      </Link>
    </div>
  );
}
export default function App() {
  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route index element={<Landing />} />
        <Route path="explore" element={<Explore />} />
        <Route
          path="shop"
          element={
            <Suspense fallback={shopFallback}>
              <Shop />
            </Suspense>
          }
        />
        <Route
          path="cart"
          element={
            <Suspense fallback={shopFallback}>
              <ShopCart />
            </Suspense>
          }
        />
        <Route
          path="checkout"
          element={
            <Suspense fallback={shopFallback}>
              <ShopCheckout />
            </Suspense>
          }
        />
        <Route
          path="orders"
          element={
            <Suspense fallback={shopFallback}>
              <ShopOrders />
            </Suspense>
          }
        />
        <Route
          path="orders/:id"
          element={
            <Suspense fallback={shopFallback}>
              <ShopOrderDetail />
            </Suspense>
          }
        />
        <Route path="providers/:id" element={<ProviderDetail />} />
        <Route path="book/:providerId/:serviceId" element={<BookingFlow />} />
        <Route path="how-it-works" element={<HowItWorks />} />
        <Route path="for-business" element={<ForBusiness />} />
      </Route>
      <Route path="login" element={<Login />} />
      <Route path="register" element={<Register />} />
      <Route path="forgot-password" element={<ForgotPassword />} />
      <Route path="reset-password" element={<ResetPassword />} />
      <Route path="verify-otp" element={<VerifyOtp />} />
      <Route path="verify-documents" element={<VerifyDocuments />} />
      <Route path="app" element={<RequireRole />}>
        <Route index element={<Navigate to="/" replace />} />
        {['admin', 'salon', 'freelancer', 'staff', 'customer'].map((role) => (
          <React.Fragment key={role}>
            <Route path={role} element={<Overview />} />
            <Route path={`${role}/:module`} element={<ModulePage />} />
          </React.Fragment>
        ))}
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
}
