import { useState } from 'react';
import styles from './HeroSection.module.css';

const HeroSection = () => {
    const [email, setEmail] = useState('');
    const [status, setStatus] = useState('idle'); // idle, loading, success
    const [message, setMessage] = useState('');

    const handleSubmit = (e) => {
        e.preventDefault();
        setStatus('loading');
        // Simulate API call
        setTimeout(() => {
            setStatus('success');
            setMessage("You're on the list! ✅");
        }, 1500);
    };

    return (
        <section className={styles.section}>
            <div className={`${styles.container} ${styles.animated}`}>
                <h1 className={styles.headline}>Privoraa</h1>
                <p className={styles.tagline}>One App. Many Possibilities.</p>
                
                {/* New Description */}
                <p className={styles.description}>
                    Privoraa is an all-in-one smart assistant platform focused on privacy, offline capability, and real-world productivity.
                </p>

                {status !== 'success' && (
                    <form onSubmit={handleSubmit} className={styles.form}>
                        <input
                            type="email" // Better validation
                            placeholder="Enter your email"
                            className={styles.input}
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required // Better validation
                            disabled={status === 'loading'}
                        />
                        <button type="submit" className={styles.button} disabled={status === 'loading'}>
                            {status === 'loading' ? <div className={styles.spinner}></div> : 'Join Waitlist'}
                        </button>
                    </form>
                )}

                {status === 'success' && (
                    <div className={styles.successMessage}>{message}</div>
                )}
            </div>
        </section>
    );
};

export default HeroSection;