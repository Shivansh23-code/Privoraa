import styles from './HeroSection.module.css';
import logo from '../assets/logo.png'; // Assuming this is your chosen logo

const HeroSection = () => {
    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Thank you for joining the waitlist!");
    };

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <div className={styles.headlineContainer}>
                    <img src={logo} alt="Privoraa Logo" className={styles.logo} />
                    <h1 className={styles.headline}>Privoraa</h1>
                </div>

                <p className={styles.subheadline}>
                    Your private AI companion, built to help you focus, remember, and feel safe — even offline.
                </p>
                
                <form onSubmit={handleSubmit} className={styles.form}>
                    <input
                        type="email"
                        placeholder="Enter your email"
                        className={styles.input}
                        required
                    />
                    <button type="submit" className={styles.button}>
                        Join Early Access
                    </button>
                </form>

                <div className={styles.valueProps}>
                    <div className={styles.prop}>🧠 Remembers your thoughts, not just conversations.</div>
                    <div className={styles.prop}>🔐 Private and offline-first — no trackers.</div>
                    <div className={styles.prop}>⚡ Fast, lightweight, and designed for your lifestyle.</div>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;