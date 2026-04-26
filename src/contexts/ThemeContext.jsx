import React, { createContext, useContext, useEffect } from 'react';
import { lightTheme } from '@/shared/ui/theme';

const ThemeContext = createContext();

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    return {
      isDarkMode: false,
      theme: lightTheme,
      toggleTheme: () => {},
    };
  }
  return context;
};

export const ThemeProvider = ({ children }) => {
  useEffect(() => {
    document.body.className = 'light-theme';
    try {
      localStorage.setItem('theme', 'light');
    } catch {
      // ignore storage errors
    }
  }, []);

  const value = {
    isDarkMode: false,
    theme: lightTheme,
    toggleTheme: () => {},
  };

  return (
    <ThemeContext.Provider value={value}>
      {children}
    </ThemeContext.Provider>
  );
};
