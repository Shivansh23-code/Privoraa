import axios from "axios";

const API_URL = 'http://localhost:8086/api/admin';

const api = axios.create({
    baseURL: API_URL,
});

api.interceptors.request.use((config) => {
    const token = localStorage.getItem('adminToken');
    if(token) {
        config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
});

export const login = (credentials) => api.post('/login', credentials);

export const getWaitlist = () => api.get('/waitlist');

export const logout = () => api.post('/logout');

export default api;
