import { Navigate, Outlet } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectAccessToken } from "./authSlice";

export function ProtectedRoute() {
  const accessToken = useSelector(selectAccessToken);
  if (!accessToken) return <Navigate to="/login" replace />;
  return <Outlet />;
}
