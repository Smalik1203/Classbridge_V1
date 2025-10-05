import React, { createContext, useContext, useState, useEffect } from 'react';
import { lightTheme, darkTheme } from '../ui/theme';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    // Return a fallback theme to prevent crashes
    return {
      isDarkMode: false,
      theme: lightTheme,
      toggleTheme: () => {},
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
      
      // Force update all Ant Design components
      const antdComponents = document.querySelectorAll('.ant-layout, .ant-card, .ant-table, .ant-input, .ant-select, .ant-btn, .ant-modal, .ant-drawer');
      antdComponents.forEach(component => {
        component.classList.toggle('dark-theme', isDarkMode);
      });
    } catch (error) {
      console.error('Error updating theme:', error);
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
