import React, { useContext } from 'react';
import styles from './ThemeToggle.module.css';
import { ThemeContext } from '../context/ThemeContext';
import { Sun, Moon } from 'lucide-react';

const ThemeToggle = () => {
  const { theme, toggleTheme } = useContext(ThemeContext);

  return (
    <button
      onClick={toggleTheme}
      className={`${styles.toggle} ${theme === 'dark' ? styles.dark : ''}`}
      aria-label="Toggle theme"
    >
      <div className={styles.iconWrapper}>
        <Sun className={styles.sun} />
        <Moon className={styles.moon} />
      </div>
      <div className={styles.slider}></div>
    </button>
  );
};

export default ThemeToggle;
