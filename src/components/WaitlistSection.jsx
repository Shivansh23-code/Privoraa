import React, { useState } from 'react';
import styles from './WaitlistSection.module.css';

const WaitlistSection = () => {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState(null);

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('http://localhost:8081/api/waitlist', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email }),
      });

      if (res.ok) {
        setStatus('success');
        setEmail('');
      } else {
        const data = await res.json();
        if (data.message?.includes('already exists')) {
          setStatus('exists');
        } else {
          setStatus('error');
        }
      }
    } catch (err) {
      console.error(err);
      setStatus('error');
    }
  };

  return (
    <section className={styles.waitlistSection}>
      <div className={styles.container}>
        <h2>Join the Waitlist</h2>
        <p className={styles.subtext}>
          Be the first to know when Privoraa launches. Get early access and updates!
        </p>
        <form onSubmit={handleSubmit} className={styles.form}>
          <input
            type="email"
            placeholder="Enter your email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <button type="submit">Join Now</button>
        </form>
        {status === 'success' && (
          <p className={styles.success}>🎉 You’ve been added to the waitlist!</p>
        )}
        {status === 'exists' && (
          <p className={styles.exists}>⚠️ This email is already on the list.</p>
        )}
        {status === 'error' && (
          <p className={styles.error}>❌ Something went wrong. Please try again.</p>
        )}
      </div>
    </section>
  );
};

export default WaitlistSection;
