import axiosInstance from "./axiosInstance";

export const api = {
  async register(data: { name: string; email: string; password: string }) {
    const res = await axiosInstance.post("/register", data);
    return res.data;
  },

  async googleLogin(token: string) {
    const res = await axiosInstance.post("/auth/google", { token });
    return res.data;
  },

  async login(data: { email: string; password: string }) {
    const res = await axiosInstance.post("/login", data);
    return res.data; // { access_token, refresh_token, token_type }
  },

  async getCurrentUser() {
    // Token is automatically injected by the Axios interceptor
    const res = await axiosInstance.get("/users/me");
    return res.data;
  },

  async getTurnCredentials(): Promise<{
    ttl_seconds: number;
    ice_servers: RTCIceServer[];
  }> {
    const res = await axiosInstance.get("/webrtc/turn-credentials");
    return res.data;
  },
};
