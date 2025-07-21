import React from 'react';
import styles from './MockupSection.module.css';
import mockup from '../assets/privoraa-mockup-1.jpg';

const MockupSection = () => {
  return (
    <section className={styles.mockup}>
      <div className={styles.container}>
        <h2 className={styles.heading}>See Privoraa in Action</h2>
        <p className={styles.subtext}>
          Preview how Privoraa simplifies your digital life with a private AI experience.
        </p>
        <div className={styles.imageWrapper}>
          <img
            src={mockup}
            alt="Privoraa App Mockup"
            className={styles.image}
          />
        </div>
      </div>
    </section>
  );
};

export default MockupSection;
