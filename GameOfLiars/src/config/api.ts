// API Configuration
const getApiUrl = () => {
  // In development, use the same hostname as the frontend
  if (import.meta.env.DEV) {
    const currentHost = window.location.hostname;
    return `http://${currentHost}:5051`;
  }
  
  // In production, use same-origin so cookies are first-party and Vercel rewrites proxy to backend
  return '';
};

export const API_URL = getApiUrl(); 