const API_URL = 'http://localhost:3001';

export const register = async (userData) => {
    try {
        console.log('Registering user with API:', API_URL);
        const response = await fetch(`${API_URL}/api/auth/register`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(userData),
            mode: 'cors'
        });

        // Check if the response is HTML (error page)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            console.error('Received HTML response instead of JSON');
            throw new Error('Server error. Please try again later.');
        }

        const responseText = await response.text();
        console.log('Registration response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Error parsing JSON:', e);
            throw new Error('Invalid server response. Please try again.');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Registration failed');
        }

        return data;
    } catch (error) {
        console.error('Registration error:', error);
        throw error;
    }
};

export const login = async (credentials) => {
    try {
        console.log('Logging in user with API:', API_URL);
        const response = await fetch(`${API_URL}/api/auth/login`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            body: JSON.stringify(credentials),
            mode: 'cors'
        });

        // Check if the response is HTML (error page)
        const contentType = response.headers.get('content-type');
        if (contentType && contentType.includes('text/html')) {
            console.error('Received HTML response instead of JSON');
            throw new Error('Server error. Please try again later.');
        }

        const responseText = await response.text();
        console.log('Login response:', responseText);
        
        let data;
        try {
            data = JSON.parse(responseText);
        } catch (e) {
            console.error('Error parsing JSON:', e);
            throw new Error('Invalid server response. Please try again.');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Login failed');
        }

        // Store token and user data in localStorage
        localStorage.setItem('token', data.token);
        localStorage.setItem('user', JSON.stringify(data.user));
        
        // Store login timestamp
        localStorage.setItem('loginTime', Date.now().toString());
        
        // Dispatch login event
        window.dispatchEvent(new CustomEvent('login'));
        
        // Force reload WebSocket connection
        window.dispatchEvent(new CustomEvent('auth_changed'));
        
        return data;
    } catch (error) {
        console.error('Login error:', error);
        throw error;
    }
};

export const logout = () => {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    localStorage.removeItem('loginTime');
    
    // Force reload WebSocket connection
    window.dispatchEvent(new CustomEvent('auth_changed'));
};

export const getCurrentUser = () => {
    const user = localStorage.getItem('user');
    return user ? JSON.parse(user) : null;
};