import React from 'react';
import styles from './MockupSection.module.css';
import mockup from '../assets/privoraa-mockup-1.jpg';

const MockupSection = () => {
  return (
    <section className={styles.mockup}>
      <div className={styles.container}>
        <h2 className={styles.heading}>See Privoraa in Action</h2>
        <p className={styles.subtext}>
          Get a glimpse of how Privoraa helps you stay focused, secure, and productive — all without internet access.
        </p>
        <div className={styles.imageWrapper}>
          <img
            src={mockup}
            alt="Privoraa App Mockup"
            className={styles.image}
            loading="lazy"
          />
        </div>
      </div>
    </section>
  );
};

export default MockupSection;
