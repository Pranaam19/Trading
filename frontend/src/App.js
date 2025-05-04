import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';
import './styles/animations.css';

// Components
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Trading from './pages/Trading';
import NotificationCenter from './components/NotificationCenter';
import ParticleBackground from './components/ParticleBackground';
import ThemeToggle from './components/ThemeToggle';
import { WebSocketProvider } from './context/WebSocketContext';
import { AuthProvider } from './context/AuthContext';

function App() {
  const [loading, setLoading] = useState(true);

  // Simulate loading for a smoother experience
  useEffect(() => {
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  if (loading) {
    return (
      <div className="loading-screen gradient-bg d-flex justify-content-center align-items-center" style={{ height: '100vh', width: '100vw' }}>
        <div className="text-center">
          <div className="custom-spinner mx-auto mb-4"></div>
          <h2 className="text-white">Loading Trading Platform</h2>
          <p className="text-white">Connecting to markets...</p>
        </div>
      </div>
    );
  }
  return (
    <Router>
      <AuthProvider>
        <WebSocketProvider>
          <div className="App">
            <ParticleBackground />
            <Navbar />
            <div className="position-fixed top-0 end-0 p-3 d-flex" style={{ zIndex: 1050 }}>
              <div className="me-2">
                <ThemeToggle />
              </div>
              <NotificationCenter />
            </div>
            <Container className="mt-4 glass-card p-4">
              <Routes>
                <Route path="/" element={<Home />} />
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                <Route path="/dashboard" element={<Dashboard />} />
                <Route path="/trading" element={<Trading />} />
              </Routes>
            </Container>
          </div>
        </WebSocketProvider>
      </AuthProvider>
    </Router>
  );
}

export default App;
