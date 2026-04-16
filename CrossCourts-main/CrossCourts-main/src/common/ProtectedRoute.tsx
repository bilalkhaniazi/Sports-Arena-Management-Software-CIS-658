import { useEffect, useState } from "react";
import { Navigate, Outlet } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import Loader from "./Loader";
import { getAxiosErrorMessage } from "../utils/apiError";
import {
  clearStoredAuth,
  getCurrentUserRole,
  getDefaultRouteForRole,
  getStoredUser,
  setStoredUser,
  UserRole,
} from "../utils/auth";

const API_BASE_URL = "http://localhost:5000/api";

interface ProtectedRouteProps {
  allowedRoles?: UserRole[];
}

const ProtectedRoute = ({ allowedRoles }: ProtectedRouteProps) => {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);
  const token = localStorage.getItem("token");
  const currentRole = getCurrentUserRole();

  useEffect(() => {
    if (!token || !getStoredUser()) {
      setIsAuthenticated(false);
      return;
    }

    axios
      .get(`${API_BASE_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${token}` },
      })
      .then((response) => {
        if (response.data?.user) {
          setStoredUser({
            ...getStoredUser(),
            ...response.data.user,
          });
        }

        setIsAuthenticated(true);
      })
      .catch((error) => {
        if (axios.isAxiosError(error) && error.response?.status && error.response.status >= 500) {
          toast.error(
            getAxiosErrorMessage(error, {
              noResponse:
                "Cannot verify your session (no response from API). Start the backend and MySQL.",
              fallback: "Session check failed.",
            }),
            { toastId: "auth-me-server-error" },
          );
        }
        clearStoredAuth();
        setIsAuthenticated(false);
      });
  }, [token]);

  if (isAuthenticated === null) return <Loader />;

  if (!isAuthenticated) {
    return <Navigate to="/auth/signin" replace />;
  }

  if (allowedRoles?.length && currentRole && !allowedRoles.includes(currentRole)) {
    return <Navigate to={getDefaultRouteForRole(currentRole)} replace />;
  }

  return <Outlet />;
};

export default ProtectedRoute;
