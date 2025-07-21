// src/components/MockupSection.jsx

import React from 'react';
import styles from './MockupSection.module.css';
import mockupImage from '../assets/privoraa-mockup-1.jpg'; // Make sure your image is here

const MockupSection = () => {
  return (
    <section className={styles.mockupContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Visualize Your Privacy</h2>
        <p className={styles.subtitle}>
          See how Privoraa's intuitive dashboard puts you back in control of
          your data, all in one place.
        </p>
      </div>
      <div className={styles.imageWrapper}>
        <img
          src={mockupImage}
          alt="Privoraa dashboard mockup on a device"
          className={styles.mockupImage}
        />
      </div>
    </section>
  );
};

export default MockupSection;