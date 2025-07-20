import styles from './HeroSection.module.css';
import logo from '../assets/privoraa-logo.png';

const HeroSection = () => {
    // Placeholder for form submission logic
    const handleSubmit = (e) => {
        e.preventDefault();
        alert("Thank you for joining the waitlist!");
    };

    return (
        <section className={styles.section}>
            <div className={styles.logoContainer}>
                <img src={logo} alt="Privoraa Logo" className={styles.logo} />
            </div>
            <h1 className={styles.headline}>Privoraa — Your Private AI Companion</h1>
            <p className={styles.subheadline}>
                Built to chat, think, and remember — privately and offline.
            </p>
            <form onSubmit={handleSubmit} className={styles.form}>
                <input
                    type="email"
                    placeholder="Enter your email to join the waitlist"
                    className={styles.input}
                    required
                />
                <button type="submit" className={styles.button}>
                    Join Waitlist
                </button>
            </form>
        </section>
    );
};

export default HeroSection;