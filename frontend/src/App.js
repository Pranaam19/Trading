import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { Container } from 'react-bootstrap';
import 'bootstrap/dist/css/bootstrap.min.css';

// Components
import Navbar from './components/Navbar';
import Home from './pages/Home';
import Login from './pages/Login';
import Register from './pages/Register';
import Dashboard from './pages/Dashboard';
import Trading from './pages/Trading';
import NotificationCenter from './components/NotificationCenter';
import { WebSocketProvider } from './context/WebSocketContext';
import { AuthProvider } from './context/AuthContext';

function App() {
  return (
    <Router>
      <AuthProvider>
        <WebSocketProvider>
          <div className="App">
            <Navbar />
            <Container className="mt-4">
              <div className="position-fixed top-0 end-0 p-3" style={{ zIndex: 1050 }}>
                <NotificationCenter />
              </div>
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
