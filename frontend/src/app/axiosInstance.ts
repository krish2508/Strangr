import axios from "axios";
import { authToken } from "./authToken";

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:5050";

/**
 * Axios instance pre-configured with the API base URL.
 * The request interceptor automatically attaches the Bearer token
 * from authToken so individual API calls never need to handle this.
 */
const axiosInstance = axios.create({
  baseURL: `${API_BASE_URL}/api`,
  headers: {
    "Content-Type": "application/json",
  },
});

// Attach the auth token to every outgoing request
axiosInstance.interceptors.request.use((config) => {
  const token = authToken.get();
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Normalize error responses so callers always get a readable message
axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    const message =
      error.response?.data?.detail ||
      error.response?.data?.message ||
      error.message ||
      "An unexpected error occurred";
    return Promise.reject(new Error(message));
  }
);

export default axiosInstance;
