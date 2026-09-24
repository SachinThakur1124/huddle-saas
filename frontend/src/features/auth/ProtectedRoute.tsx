import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAccessToken, selectAuthStatus } from "./authSlice";

export function ProtectedRoute() {
  const accessToken = useSelector(selectAccessToken);
  const status = useSelector(selectAuthStatus);

  if (status === "refreshing") {
    return <div className="auth-screen">Loading...</div>;
  }
  if (!accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
