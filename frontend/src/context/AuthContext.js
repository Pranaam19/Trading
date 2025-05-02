import React, { createContext, useContext, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { register, login, logout, getCurrentUser } from '../services/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    useEffect(() => {
        const currentUser = getCurrentUser();
        setUser(currentUser);
        setLoading(false);
    }, []);

    const handleRegister = async (userData) => {
        try {
            const data = await register(userData);
            setUser(data.user);
            navigate('/dashboard');
            return data;
        } catch (error) {
            throw error;
        }
    };

    const handleLogin = async (credentials) => {
        try {
            const data = await login(credentials);
            setUser(data.user);
            navigate('/dashboard');
            return data;
        } catch (error) {
            throw error;
        }
    };

    const handleLogout = () => {
        logout();
        setUser(null);
        navigate('/');
    };

    const value = {
        user,
        loading,
        register: handleRegister,
        login: handleLogin,
        logout: handleLogout
    };

    return (
        <AuthContext.Provider value={value}>
            {!loading && children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
}; 