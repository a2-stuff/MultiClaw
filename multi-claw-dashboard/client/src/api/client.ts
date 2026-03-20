import axios from "axios";

const api = axios.create({ baseURL: "/api" });

type ErrorListener = (message: string) => void;
let errorListener: ErrorListener | null = null;

/** Register a global listener for API errors (used by ToastProvider) */
export function onApiError(listener: ErrorListener | null) {
  errorListener = listener;
}

api.interceptors.request.use((config) => {
  const token = localStorage.getItem("token");
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    if (err.response?.status === 401) {
      localStorage.removeItem("token");
      window.location.href = "/login";
    } else if (errorListener && !err.config?.silentError) {
      const message =
        err.response?.data?.error ||
        err.response?.data?.message ||
        (err.response ? `Request failed (${err.response.status})` : "Network error — check your connection");
      errorListener(message);
    }
    return Promise.reject(err);
  }
);

/**
 * Make an API call that won't trigger global error toasts.
 * Use for optional/background requests where errors are handled locally.
 */
export function silentApi() {
  return {
    get: <T = any>(url: string, config?: any) =>
      api.get<T>(url, { ...config, silentError: true } as any),
    post: <T = any>(url: string, data?: any, config?: any) =>
      api.post<T>(url, data, { ...config, silentError: true } as any),
  };
}

export { api };
