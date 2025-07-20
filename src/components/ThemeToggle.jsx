import React, { useContext } from 'react';
import ThemeContext from '../context/ThemeContext';
import styles from './ThemeToggle.module.css';

const ThemeToggle = () => {
    const { theme, toggleTheme } = useContext(ThemeContext);
    return (
        <button className={styles.toggleButton} onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
        </button>
    );
};
export default ThemeToggle;