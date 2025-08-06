// API Configuration
const getApiUrl = () => {
  // In development, use the same hostname as the frontend
  if (import.meta.env.DEV) {
    // Get the current hostname from the browser
    const currentHost = window.location.hostname;
    return `http://${currentHost}:5051`;
  }
  
  // In production, use environment variable or Railway URL
  return import.meta.env.VITE_API_URL || 'https://your-railway-app.railway.app';
};

export const API_URL = getApiUrl(); 