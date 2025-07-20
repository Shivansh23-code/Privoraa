import styles from './HeroSection.module.css';

const HeroSection = () => {
    // Note: The form is visually present but logic can be added here
    const handleJoinWaitlist = (e) => {
        e.preventDefault();
        alert("Thank you for joining the waitlist!");
    };

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <h1 className={styles.headline}>Privoraa — Your Private AI Companion</h1>
                <p className={styles.subheadline}>
                    Built to help you focus, remember, and feel safe — even offline.
                </p>
                <div className={styles.ctaContainer}>
                    <form onSubmit={handleJoinWaitlist}>
                        <button type="submit" className={styles.button}>Join Early Access</button>
                    </form>
                    <p className={styles.ctaSubtext}>
                        Limited invites going out soon. Secure yours.
                    </p>
                </div>
            </div>
        </section>
    );
};

export default HeroSection;