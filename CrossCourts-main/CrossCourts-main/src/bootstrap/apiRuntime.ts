import axios from "axios";

const LOCAL_BACKEND_ORIGIN = "http://localhost:5000";

const normalizeOrigin = (value: string) => value.replace(/\/+$/, "");

const getBackendOrigin = () => {
  const configured = (import.meta.env.VITE_API_ORIGIN || "").trim();
  return normalizeOrigin(configured || LOCAL_BACKEND_ORIGIN);
};

const replaceLocalOrigin = (url: string) => {
  if (!url) return url;
  const backendOrigin = getBackendOrigin();
  return url.replace(LOCAL_BACKEND_ORIGIN, backendOrigin);
};

const patchFetch = () => {
  if (typeof window === "undefined" || !window.fetch) return;

  const originalFetch = window.fetch.bind(window);
  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    if (typeof input === "string") {
      return originalFetch(replaceLocalOrigin(input), init);
    }

    if (input instanceof URL) {
      return originalFetch(new URL(replaceLocalOrigin(input.toString())), init);
    }

    if (input instanceof Request) {
      const nextUrl = replaceLocalOrigin(input.url);
      if (nextUrl !== input.url) {
        const cloned = new Request(nextUrl, input);
        return originalFetch(cloned, init);
      }
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;
};

const patchAxios = () => {
  axios.interceptors.request.use((config) => {
    if (typeof config.url === "string") {
      config.url = replaceLocalOrigin(config.url);
    }
    return config;
  });
};

export const installApiRuntimePatches = () => {
  patchFetch();
  patchAxios();
};
