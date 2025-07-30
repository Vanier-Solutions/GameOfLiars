// API Configuration
const getApiUrl = () => {
  // In development, use localhost or IP address
  if (import.meta.env.DEV) {
    // Check if we're accessing via IP address
    const currentHost = window.location.hostname;
    if (currentHost !== 'localhost' && currentHost !== '127.0.0.1') {
      // We're accessing via IP address, use the same hostname
      return `http://${currentHost}:5051`;
    }
    return 'http://localhost:5051';
  }
  
  
  return import.meta.env.VITE_API_URL || 'https:/GameOfLiars.vercel.app';
};

export const API_URL = getApiUrl(); 