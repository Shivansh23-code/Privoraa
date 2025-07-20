import showcaseImg from '../assets/privoraa-mockup-2.jpg'; // Using your final chosen mockup
import styles from './ShowcaseSection.module.css';

const ShowcaseSection = () => {
    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <img src={showcaseImg} alt="Privoraa Application Mockup" className={styles.image} />
            </div>
        </section>
    );
};

export default ShowcaseSection;