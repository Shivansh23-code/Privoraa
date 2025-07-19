import styles from './AudienceSection.module.css';
import useFadeIn from '../hooks/useFadeIn';

const audienceData = {
    'For Students': [
        "Organize classes, reminders, study plans",
        "Ask follow-ups across time — it remembers",
        "Works offline, saves everything privately"
    ],
    'For Freelancers': [
        "Smart task + project tracking",
        "Auto-draft emails and proposals",
        "No data ever sent to the cloud"
    ],
    'For Small Business Owners': [
        "Voice-command assistant for daily ops",
        "Get analytics from your business data",
        "Never forget a deadline again"
    ]
};

const AudienceSection = () => {
    const [ref, isVisible] = useFadeIn({ threshold: 0.1 });

    return (
        <section ref={ref} className={`${styles.section} fade-in-section ${isVisible ? 'is-visible' : ''}`}>
            <div className={styles.container}>
                {Object.entries(audienceData).map(([title, benefits]) => (
                    <div key={title} className={styles.card}>
                        <h3 className={styles.cardTitle}>{title}</h3>
                        <ul className={styles.benefitList}>
                            {benefits.map((benefit, index) => (
                                <li key={index}>✅ {benefit}</li>
                            ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}

export default AudienceSection;