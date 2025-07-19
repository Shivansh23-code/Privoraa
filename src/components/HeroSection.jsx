import { useState } from 'react';
import styles from './HeroSection.module.css';

const HeroSection = () => {
    const [email, setEmail] = useState('');
    // ... same form submission logic as before ...

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <h1 className={styles.headline}>Meet EchoMind</h1>
                <h2 className={styles.subheadline}>Your second brain — remembers what matters, even offline.</h2>
                <p className={styles.description}>
                    The private AI assistant designed to help you focus, stay organized, and never forget a thing — even when life goes offline.
                </p>
                
                <form className={styles.form}>
                    <button className={styles.button}>Join the Waitlist</button>
                </form>

                <p className={styles.ctaSubtext}>
                    Early access invites going out soon. Don’t miss yours.
                </p>
            </div>
        </section>
    );
};

export default HeroSection;