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
          
          {/* 🔹 Clear Subheadline */}
          <p className={styles.subtitle}>
            Your Private, Offline-First AI Companion
          </p>

          {/* 🔹 Supporting Line for Clarity */}
          <p className={styles.description}>
            Stay productive, secure, and informed — even when you're offline. From notes to health to logic, Privoraa keeps thinking with you.
          </p>

          <a href="#waitlist" className={styles.cta}>Join the Waitlist</a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
