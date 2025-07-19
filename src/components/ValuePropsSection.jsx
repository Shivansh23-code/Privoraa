import styles from './ValuePropsSection.module.css';
import useFadeIn from '../hooks/useFadeIn';

const valueProps = [
    {
        icon: '🧠',
        title: 'Contextual Memory',
        description: 'Remembers your tasks, notes, and goals — forever.'
    },
    {
        icon: '🔐',
        title: 'Privacy First',
        description: 'No cloud, no tracking, no leaks. Your data stays yours.'
    },
    {
        icon: '📴',
        title: 'Offline Capable',
        description: 'Use EchoMind even during power cuts or network loss.'
    }
];

const ValuePropsSection = () => {
    const [ref, isVisible] = useFadeIn({ threshold: 0.2 });

    return (
        <section ref={ref} className={`${styles.section} fade-in-section ${isVisible ? 'is-visible' : ''}`}>
            <div className={styles.container}>
                {valueProps.map((prop) => (
                    <div key={prop.title} className={styles.card}>
                        <div className={styles.icon}>{prop.icon}</div>
                        <h3 className={styles.title}>{prop.title}</h3>
                        <p className={styles.description}>{prop.description}</p>
                    </div>
                ))}
            </div>
        </section>
    );
};

export default ValuePropsSection;