/**
 * Returns the authenticated user's ID from localStorage.
 * This is always available since chat is behind ProtectedRoute.
 */
export function useUserId(): string {
  const raw = localStorage.getItem("strangr_user");
  if (raw) {
    try {
      const parsed = JSON.parse(raw);
      if (parsed?.id) return parsed.id;
    } catch {
      // ignore
    }
  }

  // Should never reach here behind ProtectedRoute
  throw new Error("No authenticated user found. Please log in again.");
}
