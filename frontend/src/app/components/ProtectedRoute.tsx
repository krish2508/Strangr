import { Navigate } from "react-router";
import { authToken } from "../authToken";

interface ProtectedRouteProps {
  children: React.ReactNode;
}

export function ProtectedRoute({ children }: ProtectedRouteProps) {
  if (!authToken.get()) {
    // If no token exists, redirect to login page
    return <Navigate to="/" replace />;
  }

  // If token exists, render the protected component
  return <>{children}</>;
}
