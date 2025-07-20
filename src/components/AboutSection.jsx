import styles from './AboutSection.module.css';

const AboutSection = () => {
    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <h2 className={styles.title}>What is Privoraa?</h2>
                <div className={styles.grid}>
                    <div className={styles.card}>
                        <h3>🧠 What it is</h3>
                        <p>A smart, private assistant that lives on your device to help you think, create, and organize without compromising your data.</p>
                    </div>
                    <div className={styles.card}>
                        <h3>🔍 Why it’s different</h3>
                        <p>Unlike cloud-based AIs, Privoraa works offline, remembers your context, and never sends your personal information to a server.</p>
                    </div>
                    <div className={styles.card}>
                        <h3>🔒 How it protects privacy</h3>
                        <p>By operating 100% on your device, we eliminate the risk of cloud data breaches. Your secrets always stay with you.</p>
                    </div>
                </div>
            </div>
        </section>
    );
};

export default AboutSection;