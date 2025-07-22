import React from 'react';
import { Link } from 'react-router-dom'; // <-- 1. Import Link
import styles from './HeroSection.module.css';

const HeroSection = () => {
  return (
    <section className={styles.heroContainer}>
      <div className={styles.contentWrapper}>
        <h1 className={styles.headline}>
          <span className={styles.iconWrapper}>
            {/* Lock Icon SVG */}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="currentColor"
              className={styles.lockIcon}
              aria-hidden="true"
            >
              <path
                fillRule="evenodd"
                d="M12 1.5a5.25 5.25 0 00-5.25 5.25v3a3 3 0 00-3 3v6.75a3 3 0 003 3h10.5a3 3 0 003-3v-6.75a3 3 0 00-3-3v-3A5.25 5.25 0 0012 1.5zm-3.75 5.25v3h7.5v-3a3.75 3.75 0 00-7.5 0z"
                clipRule="evenodd"
              />
            </svg>
          </span>
          Intelligent Privacy, Effortlessly Managed.
        </h1>
        <p className={styles.subheadline}>
          Experience the future of data protection. Privoraa uses advanced AI to
          secure your digital life, giving you peace of mind without the
          complexity.
        </p>

        {/* --- 2. Changed <a> to <Link> and updated text/destination --- */}
        <Link to="/signup" className={styles.ctaButton}>
          Get Started for Free &rarr;
        </Link>
      </div>
    </section>
  );
};

export default HeroSection;