import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext.jsx';
import { RestaurantProvider } from './context/RestaurantContext.jsx';
import AppLayout from './components/layout/AppLayout.jsx';
import { PageLoader } from './components/ui/index.jsx';
import { PERM } from './utils/permissions.js';

const LoginPage = lazy(() => import('./pages/auth/LoginPage.jsx'));
const DashboardPage = lazy(() => import('./pages/dashboard/DashboardPage.jsx'));
const RoomsPage = lazy(() => import('./pages/hotel/RoomsPage.jsx'));
const RoomTypesPage = lazy(() => import('./pages/hotel/RoomTypesPage.jsx'));
const ReservationsPage = lazy(() => import('./pages/hotel/ReservationsPage.jsx'));
const GuestsPage = lazy(() => import('./pages/hotel/GuestsPage.jsx'));
const CheckinPage = lazy(() => import('./pages/hotel/CheckinPage.jsx'));
const HousekeepingPage = lazy(() => import('./pages/hotel/HousekeepingPage.jsx'));
const Guest360Page = lazy(() => import('./pages/hotel/Guest360Page.jsx'));
const ReservationCalendarPage = lazy(() => import('./pages/hotel/ReservationCalendarPage.jsx'));
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
const PurchaseRequestsPage = lazy(() => import('./pages/inventory/PurchaseRequestsPage.jsx'));
const StockMovementsPage = lazy(() => import('./pages/inventory/StockMovementsPage.jsx'));
const LowStockPage = lazy(() => import('./pages/inventory/LowStockPage.jsx'));
const PaymentsPage = lazy(() => import('./pages/finance/PaymentsPage.jsx'));
const InvoicesPage = lazy(() => import('./pages/finance/InvoicesPage.jsx'));
const InvoicePrintPage = lazy(() => import('./pages/finance/InvoicePrintPage.jsx'));
const ReceiptPrintPage = lazy(() => import('./pages/finance/ReceiptPrintPage.jsx'));
const ShiftsPage = lazy(() => import('./pages/finance/ShiftsPage.jsx'));
const ExpensesPage = lazy(() => import('./pages/finance/ExpensesPage.jsx'));
const RevenuePage = lazy(() => import('./pages/finance/RevenuePage.jsx'));
const AccountingPage = lazy(() => import('./pages/finance/AccountingPage.jsx'));
const HotelReportsPage = lazy(() => import('./pages/reports/HotelReportsPage.jsx'));
const KPIsPage = lazy(() => import('./pages/reports/KPIsPage.jsx'));
const InventoryReportsPage = lazy(() => import('./pages/reports/InventoryReportsPage.jsx'));
const FinancialReportsPage = lazy(() => import('./pages/reports/FinancialReportsPage.jsx'));
const AmenitiesReportPage = lazy(() => import('./pages/reports/AmenitiesReportPage.jsx'));
const EventsReportPage = lazy(() => import('./pages/reports/EventsReportPage.jsx'));
const OutletReportPage = lazy(() => import('./pages/reports/OutletReportPage.jsx'));
const CombinedReportPage = lazy(() => import('./pages/reports/CombinedReportPage.jsx'));
const StaffPage = lazy(() => import('./pages/admin/StaffPage.jsx'));
const UserDetailPage = lazy(() => import('./pages/admin/UserDetailPage.jsx'));
const RolesPage = lazy(() => import('./pages/admin/RolesPage.jsx'));
const SettingsPage = lazy(() => import('./pages/admin/SettingsPage.jsx'));
const AuditLogsPage = lazy(() => import('./pages/admin/AuditLogsPage.jsx'));
const AIAssistantPage = lazy(() => import('./pages/admin/AIAssistantPage.jsx'));
const AmenitiesPage = lazy(() => import('./pages/amenities/AmenitiesPage.jsx'));
const AmenityDetailPage = lazy(() => import('./pages/amenities/AmenityDetailPage.jsx'));
const AppointmentsPage = lazy(() => import('./pages/amenities/AppointmentsPage.jsx'));
const ConferenceHallsPage = lazy(() => import('./pages/events/ConferenceHallsPage.jsx'));
const EventsPage = lazy(() => import('./pages/events/EventsPage.jsx'));
const EventServicesPage = lazy(() => import('./pages/events/EventServicesPage.jsx'));
const MaintenancePage = lazy(() => import('./pages/maintenance/MaintenancePage.jsx'));
const NotificationsPage = lazy(() => import('./pages/admin/NotificationsPage.jsx'));
const GlobalSearchPage = lazy(() => import('./pages/admin/GlobalSearchPage.jsx'));

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

function RequirePerm({ codes, children }) {
  const { isAuthenticated, loading, canAccess } = useAuth();
  if (loading) return <PageLoader />;
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (!canAccess(...codes)) return <Navigate to="/dashboard" replace />;
  return children;
}

export default function App() {
  return (
    <AuthProvider>
      <RestaurantProvider>
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
            <Route path="dashboard" element={<RequirePerm codes={[PERM.DASHBOARD]}><DashboardPage /></RequirePerm>} />
            <Route path="rooms" element={<RequirePerm codes={[PERM.ROOMS_VIEW]}><RoomsPage /></RequirePerm>} />
            <Route path="room-types" element={<RequirePerm codes={[PERM.ROOM_TYPES_MANAGE]}><RoomTypesPage /></RequirePerm>} />
            <Route path="reservations" element={<RequirePerm codes={[PERM.RESERVATIONS_VIEW]}><ReservationsPage /></RequirePerm>} />
            <Route path="guests" element={<RequirePerm codes={[PERM.GUESTS_VIEW]}><GuestsPage /></RequirePerm>} />
            <Route path="guests/:id/360" element={<RequirePerm codes={[PERM.GUEST_360]}><Guest360Page /></RequirePerm>} />
            <Route path="checkin" element={<RequirePerm codes={[PERM.CHECKIN_VIEW, PERM.CHECKOUT_PERFORM]}><CheckinPage /></RequirePerm>} />
            <Route path="housekeeping" element={<RequirePerm codes={[PERM.HOUSEKEEPING_VIEW]}><HousekeepingPage /></RequirePerm>} />
            <Route path="reservations/calendar" element={<RequirePerm codes={[PERM.RESERVATIONS_VIEW]}><ReservationCalendarPage /></RequirePerm>} />
            <Route path="amenities" element={<RequirePerm codes={[PERM.AMENITIES_VIEW]}><AmenitiesPage /></RequirePerm>} />
            <Route path="amenities/:id" element={<RequirePerm codes={[PERM.AMENITIES_VIEW]}><AmenityDetailPage /></RequirePerm>} />
            <Route path="amenities/appointments" element={<RequirePerm codes={[PERM.APPOINTMENTS_VIEW]}><AppointmentsPage /></RequirePerm>} />
            <Route path="events/halls" element={<RequirePerm codes={[PERM.HALLS_VIEW]}><ConferenceHallsPage /></RequirePerm>} />
            <Route path="events" element={<RequirePerm codes={[PERM.EVENTS_VIEW]}><EventsPage /></RequirePerm>} />
            <Route path="events/services" element={<RequirePerm codes={[PERM.EVENTS_VIEW]}><EventServicesPage /></RequirePerm>} />
            <Route path="restaurants" element={<RequirePerm codes={[PERM.RESTAURANTS_MANAGE]}><RestaurantsPage /></RequirePerm>} />
            <Route path="restaurants/tables" element={<RequirePerm codes={[PERM.TABLES_VIEW]}><TablesPage /></RequirePerm>} />
            <Route path="restaurants/menu" element={<RequirePerm codes={[PERM.MENU_VIEW]}><MenuPage /></RequirePerm>} />
            <Route path="restaurants/pos" element={<RequirePerm codes={[PERM.POS_USE]}><POSPage /></RequirePerm>} />
            <Route path="restaurants/orders" element={<RequirePerm codes={[PERM.ORDERS_VIEW]}><OrdersPage /></RequirePerm>} />
            <Route path="restaurants/reports" element={<RequirePerm codes={[PERM.RESTAURANT_REPORTS_VIEW]}><RestaurantReportsPage /></RequirePerm>} />
            <Route path="inventory" element={<RequirePerm codes={[PERM.INVENTORY_VIEW]}><InventoryPage /></RequirePerm>} />
            <Route path="inventory/categories" element={<RequirePerm codes={[PERM.CATEGORIES_VIEW]}><CategoriesPage /></RequirePerm>} />
            <Route path="inventory/suppliers" element={<RequirePerm codes={[PERM.SUPPLIERS_VIEW]}><SuppliersPage /></RequirePerm>} />
            <Route path="inventory/purchases" element={<RequirePerm codes={[PERM.PURCHASES_VIEW]}><PurchasesPage /></RequirePerm>} />
            <Route path="inventory/movements" element={<RequirePerm codes={[PERM.INVENTORY_VIEW]}><StockMovementsPage /></RequirePerm>} />
            <Route path="inventory/low-stock" element={<RequirePerm codes={[PERM.LOW_STOCK_VIEW]}><LowStockPage /></RequirePerm>} />
            <Route path="purchase-requests" element={<RequirePerm codes={[PERM.PURCHASE_REQUESTS_VIEW]}><PurchaseRequestsPage /></RequirePerm>} />
            <Route path="shifts" element={<RequirePerm codes={[PERM.SHIFTS_VIEW]}><ShiftsPage /></RequirePerm>} />
            <Route path="maintenance" element={<RequirePerm codes={[PERM.MAINTENANCE_VIEW]}><MaintenancePage /></RequirePerm>} />
            <Route path="finance/payments" element={<RequirePerm codes={[PERM.PAYMENTS_VIEW]}><PaymentsPage /></RequirePerm>} />
            <Route path="finance/payments/:id/receipt" element={<RequirePerm codes={[PERM.PAYMENTS_VIEW]}><ReceiptPrintPage /></RequirePerm>} />
            <Route path="finance/invoices" element={<RequirePerm codes={[PERM.INVOICES_VIEW]}><InvoicesPage /></RequirePerm>} />
            <Route path="finance/invoices/:id/print" element={<RequirePerm codes={[PERM.INVOICES_VIEW]}><InvoicePrintPage /></RequirePerm>} />
            <Route path="finance/expenses" element={<RequirePerm codes={[PERM.EXPENSES_VIEW]}><ExpensesPage /></RequirePerm>} />
            <Route path="finance/revenue" element={<RequirePerm codes={[PERM.REVENUE_VIEW]}><RevenuePage /></RequirePerm>} />
            <Route path="finance/accounting" element={<RequirePerm codes={[PERM.ACCOUNTING_VIEW]}><AccountingPage /></RequirePerm>} />
            <Route path="reports/hotel" element={<RequirePerm codes={[PERM.HOTEL_REPORTS_VIEW]}><HotelReportsPage /></RequirePerm>} />
            <Route path="reports/kpis" element={<RequirePerm codes={[PERM.KPIS_VIEW]}><KPIsPage /></RequirePerm>} />
            <Route path="reports/inventory" element={<RequirePerm codes={[PERM.INVENTORY_REPORTS_VIEW]}><InventoryReportsPage /></RequirePerm>} />
            <Route path="reports/financial" element={<RequirePerm codes={[PERM.FINANCIAL_REPORTS_VIEW]}><FinancialReportsPage /></RequirePerm>} />
            <Route path="reports/amenities" element={<RequirePerm codes={[PERM.SERVICE_REPORTS_VIEW]}><AmenitiesReportPage /></RequirePerm>} />
            <Route path="reports/events" element={<RequirePerm codes={[PERM.EVENT_REPORTS_VIEW]}><EventsReportPage /></RequirePerm>} />
            <Route path="reports/outlets" element={<RequirePerm codes={[PERM.RESTAURANT_REPORTS_VIEW]}><OutletReportPage /></RequirePerm>} />
            <Route path="reports/combined" element={<RequirePerm codes={[PERM.FINANCIAL_REPORTS_VIEW]}><CombinedReportPage /></RequirePerm>} />
            <Route path="admin/staff" element={<RequirePerm codes={[PERM.STAFF_VIEW]}><StaffPage /></RequirePerm>} />
            <Route path="admin/staff/:id" element={<RequirePerm codes={[PERM.STAFF_VIEW]}><UserDetailPage /></RequirePerm>} />
            <Route path="admin/roles" element={<RequirePerm codes={[PERM.ROLES_MANAGE]}><RolesPage /></RequirePerm>} />
            <Route path="admin/settings" element={<RequirePerm codes={[PERM.SETTINGS_MANAGE]}><SettingsPage /></RequirePerm>} />
            <Route path="admin/audit" element={<RequirePerm codes={[PERM.AUDIT_VIEW]}><AuditLogsPage /></RequirePerm>} />
            <Route path="notifications" element={<RequirePerm codes={[PERM.NOTIFICATIONS_VIEW]}><NotificationsPage /></RequirePerm>} />
            <Route path="search" element={<RequirePerm codes={[PERM.GLOBAL_SEARCH]}><GlobalSearchPage /></RequirePerm>} />
            <Route path="ai" element={<RequirePerm codes={[PERM.AI_USE]}><AIAssistantPage /></RequirePerm>} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </Suspense>
      </RestaurantProvider>
    </AuthProvider>
  );
}