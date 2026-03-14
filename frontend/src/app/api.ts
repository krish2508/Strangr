const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050";

export const api = {
  async register(data: { name: string; email: string; password: string }) {
    const response = await fetch(`${API_BASE_URL}/register`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Registration failed");
    }

    return response.json();
  },

  async login(data: { email: string; password: string }) {
    const response = await fetch(`${API_BASE_URL}/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(data),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Login failed");
    }

    return response.json(); // { access_token, refresh_token, token_type }
  },

  async getCurrentUser(token: string) {
    const response = await fetch(`${API_BASE_URL}/users/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`
      }
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.detail || "Failed to fetch user");
    }

    return response.json();
  }
};
