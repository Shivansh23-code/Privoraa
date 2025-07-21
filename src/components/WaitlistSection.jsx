import React, { useState } from 'react';
import styles from './WaitlistSection.module.css';

const WaitlistSection = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(''); // '', 'success', 'error'
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const validateEmail = (email) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setStatus('');
    setMessage('');

    if (!validateEmail(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
      return;
    }

    setLoading(true);
    try {
      // Simulate API
      await new Promise((res) => setTimeout(res, 1500));

      // TODO: Replace with actual submission logic
      setStatus('success');
      setMessage('You’ve successfully joined the waitlist!');
      setEmail('');
    } catch (error) {
      setStatus('error');
      setMessage('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleBlur = () => {
    if (email && !validateEmail(email)) {
      setStatus('error');
      setMessage('Please enter a valid email address.');
    } else {
      setStatus('');
      setMessage('');
    }
  };

  return (
    <section className={styles.waitlist} aria-labelledby="waitlist-heading">
      <h2 id="waitlist-heading">Join Our Waitlist</h2>
      <p>Be the first to experience a secure, offline-first AI assistant.</p>
      <form onSubmit={handleSubmit} className={styles.form} noValidate>
        <input
          type="email"
          name="email"
          value={email}
          placeholder="Enter your email"
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleBlur}
          required
          className={`${styles.input} ${status === 'error' ? styles.error : ''}`}
          aria-invalid={status === 'error'}
          aria-describedby="email-feedback"
        />

        <button type="submit" className={styles.button} disabled={loading}>
          {loading ? (
            <>
              Submitting<span className={styles.spinner} aria-hidden="true"></span>
            </>
          ) : (
            'Join Waitlist'
          )}
        </button>

        <p
          id="email-feedback"
          className={`${styles.message} ${status === 'error' ? styles.error : status === 'success' ? styles.success : ''}`}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      </form>
    </section>
  );
};

export default WaitlistSection;
