import showcaseImg from '../assets/echomind-mockup-2.jpg';
import styles from './ShowcaseSection.module.css';

const ShowcaseSection = () => {
    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <img src={showcaseImg} alt="EchoMind Application Showcase" className={styles.image} />
            </div>
        </section>
    )
}

export default ShowcaseSection;