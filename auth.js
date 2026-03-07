/**
 * Authentication Manager
 * Handles tokens, sessions and local user state.
 */
import { API } from './api.js';

class AuthManager {
    constructor() {
        this.tokenKey = 'CUP9_SESSION_TOKEN';
        this.currentUser = null;
    }

    getToken() {
        return localStorage.getItem(this.tokenKey);
    }

    setToken(token) {
        localStorage.setItem(this.tokenKey, token);
    }

    clearSession() {
        localStorage.removeItem(this.tokenKey);
        this.currentUser = null;
    }

    async isAuthenticated() {
        const token = this.getToken();
        if (!token) return false;

        const response = await API.me(token);
        if (response.success) {
            this.currentUser = response.data;
            return true;
        } else {
            this.clearSession();
            return false;
        }
    }

    async login(email, password) {
        const res = await API.login(email, password);
        if (res.success) {
            this.setToken(res.data.token);
            this.currentUser = res.data.user;
        }
        return res;
    }

    async register(email, password, referralCode = null) {
        return await API.register(email, password, referralCode);
    }

    async loginTelegram(email, password) {
        // Accept optional email/password so Telegram-login can be bound to existing credentials
        const res = await API.loginTelegram(email, password);
        if (res.success) {
            this.setToken(res.data.token);
            this.currentUser = res.data.user;
        }
        return res;
    }

    logout() {
        this.clearSession();
    }

    getUser() {
        return this.currentUser;
    }

    isAdmin() {
        return this.currentUser?.role === 'admin';
    }
}

export const Auth = new AuthManager();