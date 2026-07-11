import { mockApi } from "./mockApi.js";
import { realApi } from "./realApi.js";
import { lanApi } from "./lanApi.js";

const mode = import.meta.env?.VITE_API_MODE || "mock";
const testMode = import.meta.env?.VITE_TEST_MODE === "true";
const isProduction = import.meta.env?.PROD === true;

if (mode === "mock" && isProduction) {
  console.warn(
    "[question-box] Production build is using mockApi. This is Demo data only, not a real backend."
  );
}

if (mode === "real" && !import.meta.env?.VITE_API_BASE_URL) {
  console.warn("[question-box] VITE_API_MODE=real selected without VITE_API_BASE_URL. Requests will use same-origin API paths.");
}

if (testMode) {
  console.warn("[question-box] VITE_TEST_MODE=true: using LAN shared mock API.");
}

export const api = testMode ? lanApi : (mode === "real" ? realApi : mockApi);
export { mockApi };
