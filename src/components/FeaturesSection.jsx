import React from 'react';
import styles from './FeaturesSection.module.css';

const features = [
  {
    title: 'Private by Design',
    description: 'Your data never leaves your device. Privoraa is built for privacy from the ground up.',
  },
  {
    title: 'Offline First',
    description: 'No internet? No problem. Privoraa works offline so you’re never dependent on the cloud.',
  },
  {
    title: 'Multi-Domain Intelligence',
    description: 'From education to fitness, Privoraa understands you across diverse categories.',
  },
  {
    title: 'Open Source Core',
    description: 'Transparent, secure, and built for the community. You can trust and improve Privoraa.',
  },
];

const FeaturesSection = () => {
  return (
    <section className={styles.features}>
      <div className={styles.container}>
        <h2>Why Choose Privoraa?</h2>
        <div className={styles.grid}>
          {features.map((feature, index) => (
            <div className={styles.card} key={index}>
              <h3>{feature.title}</h3>
              <p>{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default FeaturesSection;
