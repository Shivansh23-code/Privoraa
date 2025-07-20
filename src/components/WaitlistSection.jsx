import React, { useState } from 'react';
import styles from './WaitlistSection.module.css';

const WaitlistSection = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(''); // 'error' | 'success' | ''
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  // Basic email validation regex
  const validateEmail = (email) => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  };

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
      // Simulate API call delay
      await new Promise((r) => setTimeout(r, 1500));

      // TODO: Replace above with actual API call to submit waitlist email

      setStatus('success');
      setMessage('Thank you for joining the waitlist!');
      setEmail('');
    } catch (err) {
      setStatus('error');
      setMessage('Oops! Something went wrong. Please try again.');
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
    <section className={styles.waitlist}>
      <h2>Join Our Waitlist</h2>
      <p>Be the first to get exclusive access to Privoraa’s AI assistant.</p>
      <form className={styles.form} onSubmit={handleSubmit} noValidate>
        <input
          type="email"
          name="email"
          placeholder="Enter your email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          onBlur={handleBlur}
          className={`${styles.input} ${status === 'error' ? styles.error : ''}`}
          aria-invalid={status === 'error'}
          aria-describedby="email-status"
          required
        />
        <button type="submit" disabled={loading} className={styles.button}>
          {loading ? (
            <>
              Submitting
              <span className={styles.spinner} aria-hidden="true"></span>
            </>
          ) : (
            'Join Waitlist'
          )}
        </button>
        <p
          id="email-status"
          className={`${styles.message} ${
            status === 'error' ? styles.error : status === 'success' ? styles.success : ''
          }`}
          role={status === 'error' ? 'alert' : 'status'}
        >
          {message}
        </p>
      </form>
    </section>
  );
};

export default WaitlistSection;
