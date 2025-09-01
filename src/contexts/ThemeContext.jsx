import React, { createContext, useContext, useState, useEffect } from 'react';
import { lightTheme, darkTheme } from '../ui/theme';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    console.error('useTheme must be used within a ThemeProvider');
    // Return a fallback theme to prevent crashes
    return {
      isDarkMode: false,
      theme: lightTheme,
      toggleTheme: () => console.warn('Theme toggle not available'),
    };
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  const [isDarkMode, setIsDarkMode] = useState(() => {
    try {
      // Check localStorage for saved preference
      const saved = localStorage.getItem('theme');
      if (saved) {
        return saved === 'dark';
      }
      // Check system preference
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    } catch (error) {
      console.warn('Error reading theme preference:', error);
      return false; // Default to light theme
    }
  });

  const theme = isDarkMode ? darkTheme : lightTheme;

  const toggleTheme = () => {
    setIsDarkMode(!isDarkMode);
  };

  useEffect(() => {
    try {
      // Save theme preference to localStorage
      localStorage.setItem('theme', isDarkMode ? 'dark' : 'light');
      
      // Update document body class for global styling
      document.body.className = isDarkMode ? 'dark-theme' : 'light-theme';
    } catch (error) {
      console.warn('Error saving theme preference:', error);
    }
  }, [isDarkMode]);

  const value = {
    isDarkMode,
    theme,
    toggleTheme,
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
