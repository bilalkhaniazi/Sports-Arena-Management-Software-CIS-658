import { Link, Outlet, useLocation } from "react-router-dom";

import DarkModeSwitcher from "../components/Header/DarkModeSwitcher";
import { getCurrentUserRole } from "../utils/auth";

/**
 * Public / customer shell: same page background and dark mode toggle as the operator app.
 * Theme is shared via localStorage key `color-theme` and `body.dark` (see useColorMode).
 */
const PublicLayout = () => {
  useLocation();
  const role = getCurrentUserRole();
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

  return (
    <div className="min-h-screen bg-whiten text-slate-900 dark:bg-boxdark-2 dark:text-slate-100">
      <header className="sticky top-0 z-50 w-full border-b border-stroke bg-white/95 backdrop-blur dark:border-strokedark dark:bg-boxdark/95">
        <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-4">
          <div className="flex flex-wrap items-center gap-4 sm:gap-8">
            <Link to="/" className="text-lg font-semibold text-black dark:text-white">
              CrossCourts
            </Link>
            <nav className="flex flex-wrap items-center gap-4 text-sm font-medium">
              <Link
                to="/arenas"
                className="text-body-color hover:text-primary dark:text-bodydark dark:hover:text-primary"
              >
                Arenas
              </Link>
              {token && role === "customer" ? (
                <>
                  <Link
                    to="/bookings"
                    className="text-body-color hover:text-primary dark:text-bodydark dark:hover:text-primary"
                  >
                    My Bookings
                  </Link>
                  <Link
                    to="/profile"
                    className="text-body-color hover:text-primary dark:text-bodydark dark:hover:text-primary"
                  >
                    Profile
                  </Link>
                </>
              ) : null}
              {role === "operator" ? (
                <Link
                  to="/operator"
                  className="text-body-color hover:text-primary dark:text-bodydark dark:hover:text-primary"
                >
                  Dashboard
                </Link>
              ) : null}
              {role === "admin" ? (
                <Link
                  to="/admin"
                  className="text-body-color hover:text-primary dark:text-bodydark dark:hover:text-primary"
                >
                  Admin
                </Link>
              ) : null}
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <ul className="m-0 flex list-none items-center p-0">
              <DarkModeSwitcher />
            </ul>
            {!token ? (
              <div className="flex items-center gap-2 text-sm">
                <Link
                  to="/auth/signin"
                  className="rounded-lg px-3 py-2 text-body-color hover:text-primary dark:text-bodydark"
                >
                  Sign in
                </Link>
                <Link
                  to="/auth/signup"
                  className="rounded-lg bg-primary px-4 py-2 font-medium text-white hover:bg-opacity-90"
                >
                  Sign up
                </Link>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      <Outlet />
    </div>
  );
};

export default PublicLayout;
