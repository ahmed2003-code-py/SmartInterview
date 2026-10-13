import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useAuth } from "@/lib/auth";
import { Spinner } from "@/components/ui/spinner";

export function RequireAuth() {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading)
    return (
      <div className="grid min-h-dvh place-items-center text-muted">
        <Spinner />
      </div>
    );
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <Outlet />;
}

export function GuestOnly() {
  const { user, loading } = useAuth();
  if (loading) return null;
  if (user) return <Navigate to="/dashboard" replace />;
  return <Outlet />;
}
