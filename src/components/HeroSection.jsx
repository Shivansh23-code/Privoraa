import { useState } from 'react';
import styles from './HeroSection.module.css';

const HeroSection = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsError(false);
        
        const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:8085';

        try {
            const response = await fetch(`${apiUrl}/api/waitlist/join`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email }),
            });

            const data = await response.json();

            if (!response.ok) {
                throw new Error(data.message || 'An error occurred.');
            }

            setMessage(data.message);
            setEmail('');
        } catch (error) {
            setMessage(error.message);
            setIsError(true);
        }
    };

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <h1 className={styles.title}>Your Second Brain.</h1>
                <p className={styles.subtitle}>
                    A Context-Aware Assistant That Works Even When the Internet Doesn’t.
                </p>
                
                <form onSubmit={handleSubmit} className={styles.form}>
                    <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={styles.input}
                    />
                    <button type="submit" className={styles.button}>
                        🔒 Join Waitlist
                    </button>
                </form>

                <p className={styles.ctaSubtext}>
                    Get early access to EchoMind before public launch. Your AI, your rules.
                </p>

                {message && <p className={`${styles.message} ${isError ? styles.error : styles.success}`}>{message}</p>}
            </div>
        </section>
    );
};

export default HeroSection;