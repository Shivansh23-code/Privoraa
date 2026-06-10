// src/context/ThemeContext.jsx
// Privoraa is dark-only by design (ink/teal/violet system). The .dark class is
// kept on <html> so existing `dark:` utilities keep applying.
import React, { createContext, useEffect } from 'react';

const ThemeContext = createContext({ theme: 'dark' });

const ThemeProvider = ({ children }) => {
  useEffect(() => {
    localStorage.removeItem('theme'); // clean up the old toggle-based value
    document.documentElement.classList.remove('light');
    document.documentElement.classList.add('dark');
  }, []);

  return (
    <ThemeContext.Provider value={{ theme: 'dark' }}>
      {children}
    </ThemeContext.Provider>
  );
};

export { ThemeContext, ThemeProvider };
