import axios, { AxiosError, InternalAxiosRequestConfig } from "axios";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050";

/**
 * Axios instance pre-configured with the API base URL.
 * Cookies carry the auth session, so callers do not need to attach tokens.
 */
const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  withCredentials: true,
  headers: {
    "Content-Type": "application/json",
  },
});

type RetryableRequestConfig = InternalAxiosRequestConfig & { _retry?: boolean };

// Normalize error responses so callers always get a readable message
axiosInstance.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ detail?: string; message?: string }>) => {
    const originalRequest = error.config as RetryableRequestConfig | undefined;
    const isUnauthorized = error.response?.status === 401;
    const isRefreshRequest = originalRequest?.url?.includes("/refresh");
    const isPublicAuthRequest =
      originalRequest?.url?.includes("/login") ||
      originalRequest?.url?.includes("/register") ||
      originalRequest?.url?.includes("/auth/google");

    if (
      isUnauthorized &&
      originalRequest &&
      !originalRequest._retry &&
      !isRefreshRequest &&
      !isPublicAuthRequest
    ) {
      originalRequest._retry = true;
      try {
        await axios.post(`${API_BASE_URL}/api/refresh`, undefined, {
          withCredentials: true,
        });
        return axiosInstance(originalRequest);
      } catch {
        return Promise.reject(new Error("Session expired. Please log in again."));
      }
    }

    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;
