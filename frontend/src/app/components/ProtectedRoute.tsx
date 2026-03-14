import { Navigate } from "react-router";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  const token = localStorage.getItem("strangr_token");

  if (!token) {
    // If no token exists, redirect to login page
    return <Navigate to="/" replace />;
  }

  // If token exists, render the protected component
  return <>{children}</>;
}
