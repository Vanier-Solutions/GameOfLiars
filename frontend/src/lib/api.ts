
export function getBaseUrl() {
    return import.meta.env.VITE_API_BASE_URL || 'https://gameofliars.com';
}