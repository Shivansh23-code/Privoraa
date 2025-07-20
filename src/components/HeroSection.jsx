import React from 'react';
import styles from './HeroSection.module.css';
import { Link } from 'react-scroll';

const HeroSection = () => {
  return (
    <section className={styles.hero}>
      <div className={styles.content}>
        <h1>Your Private AI Companion</h1>
        <p>
          Meet <strong>Privoraa</strong> — the offline-first AI assistant that helps you focus, remember, and feel safe.
        </p>
        <Link
          to="waitlist"
          smooth={true}
          duration={500}
          className={styles.ctaButton}
        >
          Join Waitlist
        </Link>
      </div>
    </section>
  );
};

export default HeroSection;
