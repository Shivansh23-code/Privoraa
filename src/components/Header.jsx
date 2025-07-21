// src/components/Header.jsx

import React, { useState, useEffect } from 'react';
import styles from './Header.module.css';
import ThemeToggle from './ThemeToggle';

import logoImage from '../assets/logo.png';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 10);
    };

    window.addEventListener('scroll', handleScroll);

    return () => {
      window.removeEventListener('scroll', handleScroll);
    };
  }, []);

  return (
    <header className={`${styles.header} ${isScrolled ? styles.scrolled : ''}`}>
      
      <a href="#" className={styles.logoLink}>
        <img src={logoImage} alt="Privoraa Logo" className={styles.logoImage} />
        <span className={styles.logoName}>Privoraa</span>
      </a>
       
      
      <nav className={styles.nav}>
        <a href="#features">Features</a>
        <a href="#waitlist">Waitlist</a>
      </nav>
      <div className={styles.actions}>
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;