import { createBrowserRouter } from "react-router";
import { Login } from "./components/Login";
import { Landing } from "./components/Landing";
import { Onboarding } from "./components/Onboarding";
import { Navigate } from "react-router";
import { Chat } from "./components/Chat";
import { VideoChat } from "./components/VideoChat";
import { ProtectedRoute } from "./components/ProtectedRoute";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Login />,
  },
  {
    path: "/landing",
    element: (
      <ProtectedRoute>
        <Landing />
      </ProtectedRoute>
    ),
  },
  {
    path: "/onboarding",
    element: (
      <ProtectedRoute>
        <Onboarding />
      </ProtectedRoute>
    ),
  },
  {
    path: "/matching",
    element: <Navigate to="/landing" replace />,
  },
  {
    path: "/chat",
    element: (
      <ProtectedRoute>
        <Chat />
      </ProtectedRoute>
    ),
  },
  {
    path: "/video-chat",
    element: (
      <ProtectedRoute>
        <VideoChat />
      </ProtectedRoute>
    ),
  },
]);