import React, { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext();

export const themes = {
  default: {
    name: 'Default',
    bg: '#0b0d11',
    sidebar: '#0d1117',
    label: 'Sombre'
  },
  midnight: {
    name: 'midnight',
    bg: '#0f172a',
    sidebar: '#1e293b',
    label: 'Minuit'
  },
  forest: {
    name: 'forest',
    bg: '#061a14',
    sidebar: '#0a261e',
    label: 'Forêt'
  },
  slate: {
    name: 'slate',
    bg: '#1a1a1a',
    sidebar: '#262626',
    label: 'Ardoise'
  }
};

export function ThemeProvider({ children }) {
  const [currentTheme, setCurrentTheme] = useState(() => {
    return localStorage.getItem('appyaya-theme') || 'default';
  });

  useEffect(() => {
    localStorage.setItem('appyaya-theme', currentTheme);
    document.documentElement.setAttribute('data-theme', currentTheme);
  }, [currentTheme]);

  return (
    <ThemeContext.Provider value={{ currentTheme, setTheme: setCurrentTheme, themes }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
