import axios from 'axios';

const API_URL = 'http://localhost:8086/api/users';

const api = axios.create({
  baseURL: API_URL, 
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('userToken');
    if( token ) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
})

/**
 * Register a new user.
 * @param {object} userData - { name, email, password }
 */
export const signUp = (userData) => api.post('/register', userData);

/**
 * Logs in a user.
 * @param {object} credentials - { email, password }
 */
export const login = (credentials) => api.post('/login', credentials);

/**
 * Fetches the user's profile data (example for a protected route).
 */
export const getUserProfile = () => api.get('/profile');


export default api;