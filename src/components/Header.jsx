import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useUserAuth } from '../context/UserAuthContext';
import styles from './Header.module.css';
import ThemeToggle from './ThemeToggle';
import logoImage from '../assets/logo.png';

const Header = () => {
  const [isScrolled, setIsScrolled] = useState(false);
  const { isAuthenticated, logout } = useUserAuth();

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
      
      <Link to="/" className={styles.logoLink}>
        <img src={logoImage} alt="Privoraa Logo" className={styles.logoImage} />
        <span className={styles.logoName}>Privoraa</span>
      </Link>
      
      <nav className={styles.nav}>
        <a href="/#features">Features</a>
        
        {isAuthenticated ? (
          <>
            <Link to="/dashboard">Dashboard</Link>
            {/* Use a button styled like a link for the logout action */}
            <button onClick={logout} className={styles.navAction}>Logout</button>
          </>
        ) : (
          <>
            <Link to="/login">Login</Link>
            {/* REMOVED the special className to make it a standard link */}
            <Link to="/signup">Sign Up</Link>
          </>
        )}
      </nav>

      <div className={styles.actions}>
        <ThemeToggle />
      </div>
    </header>
  );
};

export default Header;