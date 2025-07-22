import React from 'react';
import { Link } from 'react-router-dom'; // <-- 1. Import Link
import styles from './WaitlistSection.module.css';

const WaitlistSection = () => {
  // We keep the container and header styles you love...
  return (
    <section id="waitlist" className={styles.waitlistContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Ready to Begin?</h2>
        <p className={styles.subtitle}>
          Be the first to experience the future of AI-powered privacy. Create your account today.
        </p>
      </div>
      
      {/* 2. ...but replace the form with a single, clear action button. */}
      {/* This button reuses the styling from your old submit button for consistency. */}
      <div className={styles.form}>
        <Link to="/signup" className={styles.submitButton} style={{ width: 'auto', textDecoration: 'none' }}>
           Create Your Account
        </Link>
      </div>
    </section>
  );
};

export default WaitlistSection;