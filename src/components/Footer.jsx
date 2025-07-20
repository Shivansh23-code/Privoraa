import React from 'react';
import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <p className={styles.description}>
          Privoraa is your secure, offline-first AI assistant designed to protect your privacy while helping you focus, remember, and grow. Built for those who value control and peace of mind.
        </p>
        <div className={styles.links}>
          <a href="#features">Features</a>
          <a href="#waitlist">Join Waitlist</a>
          <a href="mailto:support@privoraa.com">Contact</a>
          <a href="/privacy" target="_blank" rel="noopener noreferrer">Privacy</a>
        </div>
        <p className={styles.copy}>&copy; {new Date().getFullYear()} Privoraa. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;
