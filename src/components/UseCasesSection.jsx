import styles from './UseCasesSection.module.css';
import useFadeIn from '../hooks/useFadeIn';

const useCases = [
    {
        icon: '💬',
        text: '“I asked EchoMind to summarize 6 emails, and it gave me 1 action plan — offline.”'
    },
    {
        icon: '🧠',
        text: '“It reminded me about a client deadline I forgot I even set.”'
    },
    {
        icon: '🔐',
        text: '“I journal to it every night, and it remembers — but never leaks.”'
    },
    {
        icon: '⚡',
        text: '“EchoMind works without WiFi. It’s like having my brain backed up.”'
    }
];

const UseCasesSection = () => {
    const [ref, isVisible] = useFadeIn({ threshold: 0.1 });

    return (
        <section ref={ref} className={`${styles.section} fade-in-section ${isVisible ? 'is-visible' : ''}`}>
            <div className={styles.container}>
                <div className={styles.intro}>
                    <h2 className={styles.title}>Stop Managing Apps. Start Directing Your Thoughts.</h2>
                    <p className={styles.subtitle}>EchoMind isn’t another tool to juggle. It’s a unified space where your context lives, works, and assists you instantly.</p>
                </div>
                <div className={styles.grid}>
                    {useCases.map((item, index) => (
                        <div key={index} className={styles.card}>
                            <span className={styles.icon}>{item.icon}</span>
                            <p className={styles.text}>{item.text}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default UseCasesSection;