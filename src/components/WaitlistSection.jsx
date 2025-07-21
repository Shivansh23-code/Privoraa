// src/components/WaitlistSection.jsx

import React, { useState } from 'react';
import styles from './WaitlistSection.module.css';

const WaitlistSection = () => {
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  const validateEmail = (email) => {
    // A simple regex for email validation
    const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return regex.test(email);
  };

  const handleBlur = () => {
    if (email && !validateEmail(email)) {
      setError('Please enter a valid email address.');
    } else {
      setError('');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (!validateEmail(email)) {
      setError('Please enter a valid email address.');
      return;
    }

    setIsSubmitting(true);

    // Simulate an API call
    await new Promise((resolve) => setTimeout(resolve, 2000));

    // Simulate a random success/error outcome
    if (Math.random() > 0.1) { // 90% chance of success
      setIsSuccess(true);
    } else {
      setError('Something went wrong. Please try again.');
    }

    setIsSubmitting(false);
  };
  
  // Render a success message view if the form was submitted successfully
  if (isSuccess) {
    return (
      <section id="waitlist" className={styles.waitlistContainer}>
        <div className={styles.successMessage}>
          <h3>Thank You!</h3>
          <p>You're on the waitlist. We'll email you when Privoraa is ready.</p>
        </div>
      </section>
    );
  }

  // Render the form
  return (
    <section id="waitlist" className={styles.waitlistContainer}>
      <div className={styles.header}>
        <h2 className={styles.title}>Join the Waitlist</h2>
        <p className={styles.subtitle}>
          Be the first to experience the future of AI-powered privacy.
        </p>
      </div>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <div className={styles.inputWrapper}>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onBlur={handleBlur}
            placeholder="your.email@example.com"
            className={`${styles.inputField} ${error ? styles.inputError : ''}`}
            aria-label="Email address"
            required
          />
          <button
            type="submit"
            className={styles.submitButton}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <span className={styles.loader}></span>
            ) : (
              'Join Now'
            )}
          </button>
        </div>
        {error && <p className={styles.errorMessage}>{error}</p>}
      </form>
    </section>
  );
};

export default WaitlistSection;