// src/components/HeroSection.jsx
import React from 'react';
import styles from './HeroSection.module.css';

const HeroSection = () => {
  return (
    <section className={styles.hero}>
      {/* ✅ Hidden SEO Text */}
      <div className={styles["visually-hidden"]}>
        Privoraa is an offline-first, privacy-focused AI assistant that helps you stay productive, secure, and informed across education, health, fitness, and more — without relying on the internet.
      </div>

      <div className={styles.overlay}>
        <div className={styles.content}>
          <h1 className={styles.title}>Privoraa</h1>
          <p className={styles.subtitle}>
            Your Offline-First, Privacy-Focused AI Assistant
          </p>
          <p className={styles.tagline}>
            Built to help you focus, remember, and feel secure — even without the internet.
          </p>
          <a href="#waitlist" className={styles.cta}>Join the Waitlist</a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
