import React, { useContext } from 'react';
import { Sun, Moon } from 'lucide-react';
import styles from './ThemeToggle.module.css';
import { ThemeContext } from '../context/ThemeContext.jsx';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button
      onClick={toggleTheme}
      aria-label="Toggle theme"
      className={styles.toggleBtn}
    >
      {theme === 'dark' ? (
        <Sun size={22} />
      ) : (
        <Moon size={22} />
      )}
    </button>
  );
};

export default ThemeToggle;
