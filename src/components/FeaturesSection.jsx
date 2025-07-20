// src/components/FeaturesSection.jsx
import React from 'react';
import styles from './FeaturesSection.module.css';

const features = [
  {
    title: 'Works Offline',
    description: 'Use AI tools even without internet — perfect for remote areas or focus time.',
  },
  {
    title: 'Privacy First',
    description: 'No data leaves your device. Your prompts and content stay yours.',
  },
  {
    title: 'All-in-One',
    description: 'From notes to code and learning — Privoraa adapts to your needs.',
  },
];

const FeaturesSection = () => {
  return (
    <section className={styles.features}>
      <h2 className={styles.heading}>Why Choose Privoraa?</h2>
      <div className={styles.grid}>
        {features.map((feature, index) => (
          <div key={index} className={`${styles.card} fade-in`}>
            <h3 className={styles.title}>{feature.title}</h3>
            <p className={styles.description}>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturesSection;
