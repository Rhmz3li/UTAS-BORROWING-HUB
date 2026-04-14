/**
 * API base URL for backend requests.
 * Set VITE_API_URL in client/.env (e.g. VITE_API_URL=http://localhost:5000) to override.
 */
export const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:5000';
