import { useState } from 'react';
import styles from './HeroSection.module.css';

const HeroSection = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, submitting, success, error
    const [message, setMessage] = useState('');

    const handleSubmit = async (e) => {
        e.preventDefault();
        
        // Basic email validation
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            setStatus('error');
            setMessage('Please enter a valid email address.');
            return;
        }

        setStatus('submitting');
        setMessage('');

        // Replace with your actual backend endpoint when ready
        // const apiUrl = import.meta.env.VITE_API_URL;
        // For now, we'll simulate a successful submission
        setTimeout(() => {
            setStatus('success');
            setMessage('You’re on the waitlist! Thank you 🎉');
            setEmail('');
        }, 1000);
    };

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <h1 className={styles.headline}>Privoraa — Your Private AI Companion</h1>
                
                {/* New 1-line subheadline */}
                <p className={styles.tagline}>Where smart conversations meet real-world solutions.</p>

                <p className={styles.subheadline}>
                    Built to help you focus, remember, and feel safe — even offline.
                </p>

                {status !== 'success' && (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <input
                            type="email"
                            placeholder="Enter your email"
                            className={styles.input}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            disabled={status === 'submitting'}
                        />
                        <button type="submit" className={styles.button} disabled={status === 'submitting'}>
                            {status === 'submitting' ? 'Joining...' : 'Join Waitlist'}
                        </button>
                    </form>
                )}

                {status === 'error' && <p className={styles.errorMessage}>{message}</p>}
                {status === 'success' && <p className={styles.successMessage}>{message}</p>}
            </div>
        </section>
    );
};

export default HeroSection;