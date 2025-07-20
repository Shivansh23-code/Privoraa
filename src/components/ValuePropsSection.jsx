import styles from './ValuePropsSection.module.css';

const ValuePropsSection = () => {
    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <div className={styles.prop}>
                    <span className={styles.icon}>🧠</span>
                    <h3 className={styles.title}>Echoed Memory</h3>
                    <p className={styles.description}>Never lose a thought. Privoraa remembers your tasks, notes, and goals — forever.</p>
                </div>
                <div className={styles.prop}>
                    <span className={styles.icon}>🔐</span>
                    <h3 className={styles.title}>Privacy by Default</h3>
                    <p className={styles.description}>No cloud, no tracking, no leaks. Your data stays yours, on your device.</p>
                </div>
                <div className={styles.prop}>
                    <span className={styles.icon}>📴</span>
                    <h3 className={styles.title}>Offline-First</h3>
                    <p className={styles.description}>Powered at all times. Use Privoraa even during power cuts or network loss.</p>
                </div>
            </div>
        </section>
    );
};

export default ValuePropsSection;