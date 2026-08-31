import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import { PageLoader } from './components/ui/index.jsx';

const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage.jsx'));
const RoomsPage = lazy(() => import('./pages/hotel/RoomsPage.jsx'));
const RoomTypesPage = lazy(() => import('./pages/hotel/RoomTypesPage.jsx'));
const ReservationsPage = lazy(() => import('./pages/hotel/ReservationsPage.jsx'));
const GuestsPage = lazy(() => import('./pages/hotel/GuestsPage.jsx'));
const CheckinPage = lazy(() => import('./pages/hotel/CheckinPage.jsx'));
const HousekeepingPage = lazy(() => import('./pages/hotel/HousekeepingPage.jsx'));
const RestaurantsPage = lazy(() => import('./pages/restaurants/RestaurantsPage.jsx'));
const TablesPage = lazy(() => import('./pages/restaurants/TablesPage.jsx'));
const MenuPage = lazy(() => import('./pages/restaurants/MenuPage.jsx'));
const POSPage = lazy(() => import('./pages/restaurants/POSPage.jsx'));
const OrdersPage = lazy(() => import('./pages/restaurants/OrdersPage.jsx'));
const RestaurantReportsPage = lazy(() => import('./pages/restaurants/RestaurantReportsPage.jsx'));
const InventoryPage = lazy(() => import('./pages/inventory/InventoryPage.jsx'));
const CategoriesPage = lazy(() => import('./pages/inventory/CategoriesPage.jsx'));
const SuppliersPage = lazy(() => import('./pages/inventory/SuppliersPage.jsx'));
const PurchasesPage = lazy(() => import('./pages/inventory/PurchasesPage.jsx'));
const StockMovementsPage = lazy(() => import('./pages/inventory/StockMovementsPage.jsx'));
const LowStockPage = lazy(() => import('./pages/inventory/LowStockPage.jsx'));
const PaymentsPage = lazy(() => import('./pages/finance/PaymentsPage.jsx'));
const InvoicesPage = lazy(() => import('./pages/finance/InvoicesPage.jsx'));
const ExpensesPage = lazy(() => import('./pages/finance/ExpensesPage.jsx'));
const RevenuePage = lazy(() => import('./pages/finance/RevenuePage.jsx'));
const AccountingPage = lazy(() => import('./pages/finance/AccountingPage.jsx'));
const HotelReportsPage = lazy(() => import('./pages/reports/HotelReportsPage.jsx'));
const InventoryReportsPage = lazy(() => import('./pages/reports/InventoryReportsPage.jsx'));
const FinancialReportsPage = lazy(() => import('./pages/reports/FinancialReportsPage.jsx'));
const StaffPage = lazy(() => import('./pages/admin/StaffPage.jsx'));
const RolesPage = lazy(() => import('./pages/admin/RolesPage.jsx'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage.jsx'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage.jsx'));
const AIAssistantPage = lazy(() => import('./pages/admin/AIAssistantPage.jsx'));

function PrivateRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader label="Loading Tahir Guest Palace…" />;
  return isAuthenticated ? children : <Navigate to="/login" replace />;
}

function PublicRoute({ children }) {
  const { isAuthenticated, loading } = useAuth();
  if (loading) return <PageLoader />;
  return isAuthenticated ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  return (
    <AuthProvider>
      <Suspense fallback={<PageLoader />}>
        <Routes>
          <Route
            path="/login"
            element={
              <PublicRoute>
                <LoginPage />
              </PublicRoute>
            }
          />
          <Route
            path="/"
            element={
              <PrivateRoute>
                <AppLayout />
              </PrivateRoute>
            }
          >
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<DashboardPage />} />
            <Route path="rooms" element={<RoomsPage />} />
            <Route path="room-types" element={<RoomTypesPage />} />
            <Route path="reservations" element={<ReservationsPage />} />
            <Route path="guests" element={<GuestsPage />} />
            <Route path="checkin" element={<CheckinPage />} />
            <Route path="housekeeping" element={<HousekeepingPage />} />
            <Route path="restaurants" element={<RestaurantsPage />} />
            <Route path="restaurants/tables" element={<TablesPage />} />
            <Route path="restaurants/menu" element={<MenuPage />} />
            <Route path="restaurants/pos" element={<POSPage />} />
            <Route path="restaurants/orders" element={<OrdersPage />} />
            <Route path="restaurants/reports" element={<RestaurantReportsPage />} />
            <Route path="inventory" element={<InventoryPage />} />
            <Route path="inventory/categories" element={<CategoriesPage />} />
            <Route path="inventory/suppliers" element={<SuppliersPage />} />
            <Route path="inventory/purchases" element={<PurchasesPage />} />
            <Route path="inventory/movements" element={<StockMovementsPage />} />
            <Route path="inventory/low-stock" element={<LowStockPage />} />
            <Route path="finance/payments" element={<PaymentsPage />} />
            <Route path="finance/invoices" element={<InvoicesPage />} />
            <Route path="finance/expenses" element={<ExpensesPage />} />
            <Route path="finance/revenue" element={<RevenuePage />} />
            <Route path="finance/accounting" element={<AccountingPage />} />
            <Route path="reports/hotel" element={<HotelReportsPage />} />
            <Route path="reports/inventory" element={<InventoryReportsPage />} />
            <Route path="reports/financial" element={<FinancialReportsPage />} />
            <Route path="admin/staff" element={<StaffPage />} />
            <Route path="admin/roles" element={<RolesPage />} />
            <Route path="admin/settings" element={<SettingsPage />} />
            <Route path="admin/audit" element={<AuditLogsPage />} />
            <Route path="ai" element={<AIAssistantPage />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
    </AuthProvider>
  );
}