// src/components/ThemeToggle.jsx

import React, { useContext } from 'react';
import { ThemeContext } from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

// You can keep these as inline SVGs or import them
const SunIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path d="M12 2.25a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0V3a.75.75 0 01.75-.75zM7.5 12a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM18.894 6.106a.75.75 0 011.06.044l1.5 1.5a.75.75 0 01-1.06 1.06l-1.5-1.5a.75.75 0 01.044-1.06zM21.75 12a.75.75 0 01-.75.75h-2.25a.75.75 0 010-1.5H21a.75.75 0 01.75.75zM17.894 17.894a.75.75 0 01-1.06.044l-1.5-1.5a.75.75 0 011.06-1.06l1.5 1.5a.75.75 0 01-.044 1.06zM12 18.75a.75.75 0 01.75.75v2.25a.75.75 0 01-1.5 0v-2.25a.75.75 0 01.75-.75zM5.106 17.894a.75.75 0 01.044-1.06l1.5-1.5a.75.75 0 011.06 1.06l-1.5 1.5a.75.75 0 01-1.06-.044zM4.5 12a.75.75 0 01-.75.75H1.5a.75.75 0 010-1.5h2.25a.75.75 0 01.75.75zM6.106 6.106a.75.75 0 01.044 1.06l-1.5 1.5a.75.75 0 01-1.06-1.06l1.5-1.5a.75.75 0 011.06-.044z" />
  </svg>
);

const MoonIcon = (props) => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" {...props}>
    <path fillRule="evenodd" d="M9.528 1.718a.75.75 0 01.162.819A8.97 8.97 0 009 6a9 9 0 009 9 8.97 8.97 0 003.463-.69a.75.75 0 01.981.981A10.503 10.503 0 0118 18a10.5 10.5 0 01-10.5-10.5c0-1.25.21-2.446.6-3.546a.75.75 0 01.819-.162z" clipRule="evenodd" />
  </svg>
);


const ThemeToggle = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);
  const isDark = theme === 'dark';

  return (
    <button
      className={`${styles.toggle} ${isDark ? styles.dark : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
    >
      <SunIcon className={styles.sun} />
      <MoonIcon className={styles.moon} />
      <span className={styles.slider} />
    </button>
  );
};

export default ThemeToggle;