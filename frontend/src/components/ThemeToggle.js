import React, { useState, useEffect } from 'react';
import { Button } from 'react-bootstrap';
import { Moon, Sun } from 'react-bootstrap-icons';

const ThemeToggle = () => {
  const [darkMode, setDarkMode] = useState(false);

  // Check for saved theme preference or default to light
  useEffect(() => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
      setDarkMode(true);
      document.body.classList.add('dark-mode');
    }
  }, []);

  // Toggle theme
  const toggleTheme = () => {
    if (darkMode) {
      // Switch to light mode
      document.body.classList.remove('dark-mode');
      localStorage.setItem('theme', 'light');
    } else {
      // Switch to dark mode
      document.body.classList.add('dark-mode');
      localStorage.setItem('theme', 'dark');
    }
    setDarkMode(!darkMode);
  };

  return (
    <Button 
      variant={darkMode ? "light" : "dark"} 
      size="sm" 
      onClick={toggleTheme}
      className="theme-toggle glass-card"
      aria-label="Toggle theme"
      title={darkMode ? "Switch to Light Mode" : "Switch to Dark Mode"}
    >
      {darkMode ? <Sun /> : <Moon />}
    </Button>
  );
};

export default ThemeToggle;
