import styles from './BenefitsSection.module.css';

const BenefitsSection = () => {
    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <div className={styles.benefit}>
                    <span className={styles.icon}>🧠</span>
                    <h3 className={styles.title}>Always-on Chat</h3>
                    <p>Built for daily help, even offline</p>
                </div>
                <div className={styles.benefit}>
                    <span className={styles.icon}>🔐</span>
                    <h3 className={styles.title}>Total Privacy</h3>
                    <p>No external APIs, no tracking</p>
                </div>
                <div className={styles.benefit}>
                    <span className={styles.icon}>⚡</span>
                    <h3 className={styles.title}>Fast & Lightweight</h3>
                    <p>Optimized for low-end devices</p>
                </div>
            </div>
        </section>
    );
};

export default BenefitsSection;