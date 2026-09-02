import { Suspense, lazy, useEffect, useMemo, useRef, useState } from 'react';
import {
  Link, NavLink, Navigate, Route, Routes, useLocation, useNavigate,
} from 'react-router-dom';
import {
  ChevronDown, ChevronRight, LogOut, Menu, Moon, Search, SearchX, Sun, X,
} from 'lucide-react';

import { session } from '@/lib/api';
import { landingRoute, searchableRoutes, visibleNav } from '@/lib/nav';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { RequirePermission, Spinner } from '@/components/Ui';

import { Login } from '@/pages/Login';
import { ChangePassword } from '@/pages/ChangePassword';


/**
 * Screens are fetched when first opened, not all at once.
 *
 * Every page used to be a static import, so signing in downloaded the
 * roles editor, the audit log and the whole product form before the
 * dashboard could paint - and most staff open three screens in a day.
 * Vite splits each of these into its own chunk.
 *
 * Login and the forced password change stay eager: they are what an
 * unauthenticated visit renders first, and a loading flash on the sign-in
 * screen buys nothing.
 */
const Dashboard = lazy(() => import('@/pages/Dashboard').then((m) => ({ default: m.Dashboard })));
const Products = lazy(() => import('@/pages/Products').then((m) => ({ default: m.Products })));
const ProductEditor = lazy(() => import('@/pages/ProductEditor').then((m) => ({ default: m.ProductEditor })));
const Categories = lazy(() => import('@/pages/Categories').then((m) => ({ default: m.Categories })));
const Rooms = lazy(() => import('@/pages/Rooms').then((m) => ({ default: m.Rooms })));
const Collections = lazy(() => import('@/pages/Collections').then((m) => ({ default: m.Collections })));
const Attributes = lazy(() => import('@/pages/Attributes').then((m) => ({ default: m.Attributes })));
const Orders = lazy(() => import('@/pages/Orders').then((m) => ({ default: m.Orders })));
const OrderDetail = lazy(() => import('@/pages/OrderDetail').then((m) => ({ default: m.OrderDetail })));
const Customers = lazy(() => import('@/pages/Customers').then((m) => ({ default: m.Customers })));
const CustomerDetail = lazy(() => import('@/pages/CustomerDetail').then((m) => ({ default: m.CustomerDetail })));
const Coupons = lazy(() => import('@/pages/Coupons').then((m) => ({ default: m.Coupons })));
const Reviews = lazy(() => import('@/pages/Reviews').then((m) => ({ default: m.Reviews })));
const Shipping = lazy(() => import('@/pages/Shipping').then((m) => ({ default: m.Shipping })));
const Pages = lazy(() => import('@/pages/Pages').then((m) => ({ default: m.Pages })));
const Banners = lazy(() => import('@/pages/Banners').then((m) => ({ default: m.Banners })));
const Homepage = lazy(() => import('@/pages/Homepage').then((m) => ({ default: m.Homepage })));
const Reports = lazy(() => import('@/pages/Reports').then((m) => ({ default: m.Reports })));
const Staff = lazy(() => import('@/pages/Staff').then((m) => ({ default: m.Staff })));
const Roles = lazy(() => import('@/pages/Roles').then((m) => ({ default: m.Roles })));
const StoreSettings = lazy(() => import('@/pages/StoreSettings').then((m) => ({ default: m.StoreSettings })));
const AuditLog = lazy(() => import('@/pages/AuditLog').then((m) => ({ default: m.AuditLog })));

export default function App() {
  const location = useLocation();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = session.user();

  if (!session.token() || !user) {
    return location.pathname === '/login' ? (
      <Login />
    ) : (
      <Navigate to="/login" replace state={{ from: location.pathname }} />
    );
  }

  // A password an administrator chose for someone else is a shared secret.
  // Everything is blocked until it has been replaced - which is only useful
  // because the route guard is here rather than a banner someone can ignore.
  if (user.must_change_password && location.pathname !== '/change-password') {
    return <Navigate to="/change-password" replace />;
  }

  return (
    <div className="a-shell">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      {sidebarOpen && <div className="a-overlay" onClick={() => setSidebarOpen(false)} />}
      <div className="a-content-wrapper">
        <Header onMenuClick={() => setSidebarOpen(true)} />
        <main className="a-main">
          {/* Keyed by path, so a crash on one screen never persists after
              staff navigate to one that works. */}
          <ErrorBoundary key={location.pathname}>
            {/* One fallback for every lazy screen. Chunks are small and local,
                so this is a flash on a cold cache and nothing on a warm one. */}
            <Suspense fallback={<Spinner label="Loading" />}>
            <Routes>
              <Route path="/change-password" element={<ChangePassword />} />

              <Route path="/" element={<Guard p={['dashboard.view']}><Dashboard /></Guard>} />

              <Route path="/products" element={<Guard p={['products.read']}><Products /></Guard>} />
              <Route path="/products/new" element={<Guard p={['products.write']}><ProductEditor /></Guard>} />
              <Route path="/products/:id" element={<Guard p={['products.read']}><ProductEditor /></Guard>} />
              <Route path="/categories" element={<Guard p={['taxonomy.read']}><Categories /></Guard>} />
              <Route path="/rooms" element={<Guard p={['taxonomy.read']}><Rooms /></Guard>} />
              <Route path="/collections" element={<Guard p={['taxonomy.read']}><Collections /></Guard>} />
              <Route path="/attributes" element={<Guard p={['taxonomy.read']}><Attributes /></Guard>} />
              {/* AR now lives inside the product it belongs to. Kept as a
                  redirect so links and bookmarks staff already have do not
                  dead-end. */}
              <Route path="/ar" element={<Navigate to="/products" replace />} />

              <Route path="/orders" element={<Guard p={['orders.read']}><Orders /></Guard>} />
              <Route path="/orders/:id" element={<Guard p={['orders.read']}><OrderDetail /></Guard>} />

              <Route path="/customers" element={<Guard p={['customers.read']}><Customers /></Guard>} />
              <Route path="/customers/:id" element={<Guard p={['customers.read']}><CustomerDetail /></Guard>} />

              <Route path="/coupons" element={<Guard p={['coupons.read']}><Coupons /></Guard>} />
              <Route path="/reviews" element={<Guard p={['reviews.moderate']}><Reviews /></Guard>} />
              <Route path="/shipping" element={<Guard p={['coupons.read']}><Shipping /></Guard>} />

              <Route path="/pages" element={<Guard p={['content.read']}><Pages /></Guard>} />
              <Route path="/banners" element={<Guard p={['content.read']}><Banners /></Guard>} />
              <Route path="/homepage" element={<Guard p={['content.read']}><Homepage /></Guard>} />

              <Route path="/reports" element={<Guard p={['reports.view']}><Reports /></Guard>} />

              <Route path="/staff" element={<Guard p={['staff.read']}><Staff /></Guard>} />
              <Route path="/roles" element={<Guard p={['roles.read']}><Roles /></Guard>} />
              <Route path="/settings" element={<Guard p={['settings.write']}><StoreSettings /></Guard>} />
              <Route path="/audit" element={<Guard p={['audit.read']}><AuditLog /></Guard>} />

              <Route path="/no-access" element={<NoAccess />} />
              <Route path="/login" element={<Navigate to={landingRoute()} replace />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
            </Suspense>
          </ErrorBoundary>
        </main>
      </div>
    </div>
  );
}

function Guard({ p, children }: { p: string[]; children: React.ReactNode }) {
  return <RequirePermission anyOf={p}>{children}</RequirePermission>;
}

function NoAccess() {
  return (
    <div className="a-note a-note--framed" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <strong>Your role does not open any screen yet.</strong>
      <p style={{ margin: '8px 0 0', color: 'var(--text-muted)' }}>
        Ask a Super Admin to add permissions to your role.
      </p>
    </div>
  );
}

function NotFound() {
  return (
    <div className="a-note a-note--framed" style={{ textAlign: 'center', padding: '48px 24px' }}>
      <SearchX size={32} style={{ color: 'var(--text-muted)' }} aria-hidden />
      <strong style={{ display: 'block', marginTop: 12 }}>That page does not exist.</strong>
      <p style={{ margin: '8px 0 16px', color: 'var(--text-muted)' }}>
        Check the address, or head back to the dashboard.
      </p>
      <Link to="/" className="a-btn a-btn--primary">
        Go to the dashboard
      </Link>
    </div>
  );
}

function Sidebar({ open, onClose }: { open: boolean; onClose: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const user = session.user();
  const nav = useMemo(visibleNav, []);

  // A group starts open when the current page is inside it, so a deep link
  // lands with its section already expanded rather than looking orphaned.
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    for (const item of nav) {
      if (item.children?.some((c) => location.pathname.startsWith(c.to))) initial.add(item.label);
    }
    return initial;
  });

  const toggle = (label: string) =>
    setExpanded((current) => {
      const next = new Set(current);
      next.has(label) ? next.delete(label) : next.add(label);
      return next;
    });

  const signOut = () => {
    session.clear();
    navigate('/login', { replace: true });
  };

  return (
    <aside className={`a-side ${open ? 'a-side--open' : ''}`}>
      <div className="a-side__brand">
        <span>Nivisa</span>
        <button type="button" className="a-link-btn a-side__close" aria-label="Close menu" onClick={onClose}>
          <X size={18} />
        </button>
      </div>

      <nav className="a-side__nav" aria-label="Sections">
        {nav.map((item) => {
          const children = item.children ?? [];
          if (children.length) {
            const isOpen = expanded.has(item.label);
            const Icon = item.icon;
            return (
              <div key={item.label}>
                <button
                  type="button"
                  className="a-side__link"
                  aria-expanded={isOpen}
                  onClick={() => toggle(item.label)}
                >
                  <Icon size={17} aria-hidden />
                  <span style={{ flex: 1, textAlign: 'left' }}>{item.label}</span>
                  {isOpen ? <ChevronDown size={15} aria-hidden /> : <ChevronRight size={15} aria-hidden />}
                </button>
                {isOpen && (
                  <div className="a-side__submenu">
                    {children.map((child) => (
                      <NavLink
                        key={child.to}
                        to={child.to}
                        onClick={onClose}
                        className={({ isActive }) =>
                          `a-side__submenu-link ${isActive ? 'a-side__submenu-link--active' : ''}`
                        }
                      >
                        {child.label}
                      </NavLink>
                    ))}
                  </div>
                )}
              </div>
            );
          }

          const Icon = item.icon;
          return (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.to === '/'}
              onClick={onClose}
              className={({ isActive }) => `a-side__link ${isActive ? 'a-side__link--active' : ''}`}
            >
              <Icon size={17} aria-hidden />
              <span>{item.label}</span>
            </NavLink>
          );
        })}
      </nav>

      <div className="a-side__foot">
        <div>
          <strong style={{ display: 'block', fontSize: 13 }}>{user?.name}</strong>
          <span className="a-side__role">{user?.role.name}</span>
        </div>
        <button type="button" className="a-side__signout" onClick={signOut}>
          <LogOut size={15} aria-hidden /> Sign out
        </button>
      </div>
    </aside>
  );
}

function Header({ onMenuClick }: { onMenuClick: () => void }) {
  const navigate = useNavigate();
  const [theme, setTheme] = useState(
    () => document.documentElement.getAttribute('data-theme') || 'light',
  );
  const [query, setQuery] = useState('');
  const [openSearch, setOpenSearch] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const routes = useMemo(searchableRoutes, []);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('nivisa.admin.theme', theme);
  }, [theme]);

  useEffect(() => {
    const onClickAway = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setOpenSearch(false);
      }
    };
    document.addEventListener('mousedown', onClickAway);
    return () => document.removeEventListener('mousedown', onClickAway);
  }, []);

  const matches = query.trim()
    ? routes.filter((r) => r.label.toLowerCase().includes(query.trim().toLowerCase())).slice(0, 8)
    : [];

  const go = (to: string) => {
    navigate(to);
    setQuery('');
    setOpenSearch(false);
  };

  return (
    <header className="a-topbar">
      <button type="button" className="a-link-btn a-topbar__menu" aria-label="Open menu" onClick={onMenuClick}>
        <Menu size={20} />
      </button>

      <div className="a-topbar__search" ref={searchRef}>
        <Search size={15} aria-hidden />
        <input
          className="a-input"
          type="search"
          placeholder="Find a screen"
          aria-label="Find a screen"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value);
            setOpenSearch(true);
          }}
          onFocus={() => setOpenSearch(true)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && matches[0]) go(matches[0].to);
            if (e.key === 'Escape') setOpenSearch(false);
          }}
        />
        {openSearch && matches.length > 0 && (
          <ul className="a-topbar__results">
            {matches.map((match) => (
              <li key={match.to}>
                <button type="button" onClick={() => go(match.to)}>
                  {match.label}
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <button
        type="button"
        className="a-link-btn"
        aria-label={theme === 'light' ? 'Switch to dark theme' : 'Switch to light theme'}
        onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
      >
        {theme === 'light' ? <Moon size={18} /> : <Sun size={18} />}
      </button>
    </header>
  );
}
