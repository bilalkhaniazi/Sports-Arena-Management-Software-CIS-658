import { useState, useEffect } from "react";
import { Navigate, Routes, Route, useLocation } from "react-router-dom";
import Loader from "./common/Loader";
import PageTitle from "./components/PageTitle";
import SignIn from "./pages/Authentication/SignIn";
import SignUp from "./pages/Authentication/SignUp";
import DashboardOverview from "./pages/Dashboard/DashboardOverview";
import ArenaManagement from "./pages/ArenaManagement";
import BookingHistory from "./pages/BookingHistory";
import BookingManagement from "./pages/BookingManagement";
import BookingSettings from "./pages/BookingSettings";
import CustomMessage from "./pages/CustomMessage";
import UniqueBookingCustomers from "./pages/UniqueBookingCustomers";
import DefaultLayout from "./layout/DefaultLayout";
import PublicLayout from "./layout/PublicLayout";
import ProtectedRoute from "./common/ProtectedRoute";
import Landing from "./pages/Public/Landing";
import ArenasPage from "./pages/Public/Arenas";
import ArenaDetail from "./pages/Public/ArenaDetail";
import BookingsPage from "./pages/Public/Bookings";
import CancellationRequests from "./pages/CancellationRequests";
import ProfilePage from "./pages/Public/Profile";
import { getCurrentUserRole, getDefaultRouteForRole } from "./utils/auth";

const RoleHome = () => {
  const role = getCurrentUserRole();

  if (!role) {
    return <Landing />;
  }

  return <Navigate to={getDefaultRouteForRole(role)} replace />;
};

function App() {
  const [loading, setLoading] = useState(true);
  const { pathname } = useLocation();

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [pathname]);

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) return <Loader />;

  return (
    <Routes>
      <Route element={<PublicLayout />}>
        <Route
          path="/"
          element={
            <>
              <PageTitle title="CrossCourts" />
              <RoleHome />
            </>
          }
        />

        <Route
          path="/arenas"
          element={
            <>
              <PageTitle title="Browse Arenas | CrossCourts" />
              <ArenasPage />
            </>
          }
        />
        <Route
          path="/arenas/:arenaId"
          element={
            <>
              <PageTitle title="Arena Details | CrossCourts" />
              <ArenaDetail />
            </>
          }
        />
        <Route element={<ProtectedRoute allowedRoles={["customer"]} />}>
          <Route
            path="/bookings"
            element={
              <>
                <PageTitle title="My Bookings | CrossCourts" />
                <BookingsPage />
              </>
            }
          />
          <Route
            path="/profile"
            element={
              <>
                <PageTitle title="Profile | CrossCourts" />
                <ProfilePage />
              </>
            }
          />
        </Route>

        <Route
          path="/auth/signin"
          element={
            <>
              <PageTitle title="Signin | CrossCourts" />
              <SignIn />
            </>
          }
        />
        <Route
          path="/auth/signup"
          element={
            <>
              <PageTitle title="Signup | CrossCourts" />
              <SignUp />
            </>
          }
        />
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["operator", "admin"]} />}>
        <Route element={<DefaultLayout />}>
          <Route
            path="/operator"
            element={
              <>
                <PageTitle title="Operator Dashboard | CrossCourts" />
                <DashboardOverview />
              </>
            }
          />
          <Route
            path="/operator/arenas"
            element={
              <>
                <PageTitle title="Operator Arena Management | CrossCourts" />
                <ArenaManagement />
              </>
            }
          />
          <Route
            path="/operator/booking-management"
            element={
              <>
                <PageTitle title="Operator Booking Management | CrossCourts" />
                <BookingManagement />
              </>
            }
          />
          <Route
            path="/operator/cancellation-requests"
            element={
              <>
                <PageTitle title="Cancellation requests | CrossCourts" />
                <CancellationRequests />
              </>
            }
          />
          <Route
            path="/operator/booking-history"
            element={
              <>
                <PageTitle title="Operator Booking History | CrossCourts" />
                <BookingHistory />
              </>
            }
          />
          <Route
            path="/operator/booking-customers"
            element={
              <>
                <PageTitle title="Customers (bookings) | CrossCourts" />
                <UniqueBookingCustomers />
              </>
            }
          />
          <Route
            path="/operator/booking-settings"
            element={
              <>
                <PageTitle title="Operator Booking Settings | CrossCourts" />
                <BookingSettings />
              </>
            }
          />
          <Route
            path="/operator/custom-message"
            element={
              <>
                <PageTitle title="Operator Messages | CrossCourts" />
                <CustomMessage />
              </>
            }
          />
        </Route>
      </Route>

      <Route element={<ProtectedRoute allowedRoles={["admin"]} />}>
        <Route element={<DefaultLayout />}>
          <Route
            path="/admin"
            element={
              <>
                <PageTitle title="Admin Dashboard | CrossCourts" />
                <DashboardOverview />
              </>
            }
          />
          <Route
            path="/admin/arenas"
            element={
              <>
                <PageTitle title="Admin Arena Management | CrossCourts" />
                <ArenaManagement />
              </>
            }
          />
          <Route
            path="/admin/bookings"
            element={
              <>
                <PageTitle title="Admin Booking Oversight | CrossCourts" />
                <BookingHistory />
              </>
            }
          />
          <Route
            path="/admin/cancellation-requests"
            element={
              <>
                <PageTitle title="Cancellation requests | CrossCourts" />
                <CancellationRequests />
              </>
            }
          />
          <Route
            path="/admin/booking-customers"
            element={
              <>
                <PageTitle title="Customers (bookings) | CrossCourts" />
                <UniqueBookingCustomers />
              </>
            }
          />
          <Route
            path="/admin/messages"
            element={
              <>
                <PageTitle title="Admin Messaging | CrossCourts" />
                <CustomMessage />
              </>
            }
          />
        </Route>
      </Route>

      <Route path="/booking-management" element={<Navigate to="/operator/booking-management" replace />} />
      <Route path="/booking-history" element={<Navigate to="/operator/booking-history" replace />} />
      <Route path="/booking-customers" element={<Navigate to="/operator/booking-customers" replace />} />
      <Route path="/booking-settings" element={<Navigate to="/operator/booking-settings" replace />} />
      <Route path="/custom-message" element={<Navigate to="/operator/custom-message" replace />} />
      <Route
        path="/cancellation-requests"
        element={<Navigate to="/operator/cancellation-requests" replace />}
      />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default App;
