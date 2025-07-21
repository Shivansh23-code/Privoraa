// src/components/FeaturesSection.jsx

import React, { useEffect, useRef, useState } from 'react';
import styles from './FeaturesSection.module.css';

// Feature data array for easy management
const featuresData = [
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.286zm0 13.036h.008v.008h-.008v-.008z" />
      </svg>
    ),
    title: 'Unbreakable Security',
    description: 'Our AI-driven security protocols adapt in real-time to neutralize threats before they can impact you.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
      </svg>
    ),
    title: 'AI-Powered Insights',
    description: 'Gain clarity on your digital footprint. Privoraa intelligently analyzes and simplifies your privacy settings.',
  },
  {
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 1.5H8.25A2.25 2.25 0 006 3.75v16.5a2.25 2.25 0 002.25 2.25h7.5A2.25 2.25 0 0018 20.25V3.75a2.25 2.25 0 00-2.25-2.25H13.5m-3 0V3h3V1.5m-3 0h3m-3 18.75h3" />
      </svg>
    ),
    title: 'Seamless Integration',
    description: 'Effortlessly connect Privoraa across your devices and platforms for consistent, unified protection everywhere.',
  },
];

const FeaturesSection = () => {
  const sectionRef = useRef(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => {
        // We only want to trigger this once
        if (entry.isIntersecting) {
          setIsVisible(true);
          observer.unobserve(sectionRef.current);
        }
      },
      {
        root: null, // observing relative to the viewport
        rootMargin: '0px',
        threshold: 0.1, // trigger when 10% of the element is visible
      }
    );

    if (sectionRef.current) {
      observer.observe(sectionRef.current);
    }

    // Cleanup observer on component unmount
    return () => {
      if (sectionRef.current) {
        observer.unobserve(sectionRef.current);
      }
    };
  }, []);

  return (
    <section ref={sectionRef} id="features" className={styles.featuresContainer}>
      <div className={styles.header}>
        <span className={styles.preTitle}>FEATURES</span>
        <h2 className={styles.title}>Why Choose Privoraa?</h2>
        <p className={styles.subtitle}>
          We've built a powerful, intuitive, and modern platform to give you
          control over your digital privacy.
        </p>
      </div>
      <div className={`${styles.cardsGrid} ${isVisible ? styles.visible : ''}`}>
        {featuresData.map((feature, index) => (
          <div key={index} className={styles.card}>
            <div className={styles.iconWrapper}>{feature.icon}</div>
            <h3 className={styles.cardTitle}>{feature.title}</h3>
            <p className={styles.cardDescription}>{feature.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default FeaturesSection;