import { useState } from 'react';
import styles from './HeroSection.module.css';

const HeroSection = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        // ... same form submission logic as before ...
    };

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <h1 className={styles.title}>EchoMind: Your Private, Always-On Second Brain.</h1>
                <p className={styles.subtitle}>
                    EchoMind helps you stay focused, organized, and at peace — even when you’re offline, overwhelmed, or alone.
                </p>
                
                <form onSubmit={handleSubmit} className={styles.form}>
                    <input
                        type="email"
                        placeholder="Enter your email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={styles.input}
                    />
                    <button type="submit" className={styles.button}>
                        Join Early Access
                    </button>
                </form>

                <p className={styles.ctaSubtext}>
                    Limited invites going out soon. Secure yours.
                </p>

                {message && <p className={`${styles.message} ${isError ? styles.error : styles.success}`}>{message}</p>}
            </div>
        </section>
    );
};

export default HeroSection;