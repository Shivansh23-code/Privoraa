import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={styles.footer}>
      <div className={styles.container}>
        <p className={styles.description}>
          Privoraa is your secure, offline-first AI assistant designed to protect your privacy while helping you focus, remember, and grow. Built for those who value control and peace of mind.
        </p>

        <nav className={styles.links}>
          <a href="#features">Features</a>
          <a href="#waitlist">Join Waitlist</a>
          <a href="mailto:support@privoraa.com">Contact</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
        </nav>

        <p className={styles.copy}>
          &copy; {currentYear} Privoraa. All rights reserved.
        </p>
      </div>
    </footer>
  );
};

export default Footer;
