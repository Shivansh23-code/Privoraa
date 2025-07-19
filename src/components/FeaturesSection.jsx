import styles from './FeaturesSection.module.css';
import useFadeIn from '../hooks/useFadeIn'; // Import the hook

const FeaturesSection = () => {
    const [ref, isVisible] = useFadeIn({ threshold: 0.1 }); // Use the hook
    const features = [ /* ... your features array ... */ ];

    return (
        // Apply the animation classes and the ref
        <section ref={ref} className={`${styles.section} fade-in-section ${isVisible ? 'is-visible' : ''}`}>
            {/* ... rest of your component ... */}
            <div className={styles.container}>
                <h2 className={styles.title}>An Agent Built For You</h2>
                <div className={styles.grid}>
                    {features.map((feature, index) => (
                        <div key={index} className={styles.featureCard}>
                            <p className={styles.featureText}>
                                <span className={styles.featureIcon}>✓</span>
                                {feature}
                            </p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FeaturesSection;