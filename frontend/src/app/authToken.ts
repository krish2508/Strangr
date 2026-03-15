/**
 * authToken - Abstraction over token storage.
 *
 * All reads/writes of the access token go through here so that
 * switching from localStorage to HttpOnly cookies (or any other
 * mechanism) is a single-file change.
 */
export const authToken = {
  get(): string | null {
    return localStorage.getItem("strangr_token");
  },

  set(token: string): void {
    localStorage.setItem("strangr_token", token);
  },

  clear(): void {
    localStorage.removeItem("strangr_token");
  },
};
