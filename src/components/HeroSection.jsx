// src/components/HeroSection.jsx
import React from 'react';
import styles from './HeroSection.module.css';

const HeroSection = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.overlay}>
        <div className={styles.content}>
          <h1 className={styles.title}>Privoraa</h1>
          <p className={styles.subtitle}>
            Where intelligent chat meets complete privacy — and works even offline.
          </p>
          <p className={styles.tagline}>
            Built for those who value control, speed, and secure communication.
          </p>
          <a href="#waitlist" className={styles.cta}>
            Join Waitlist 🚀
          </a>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
