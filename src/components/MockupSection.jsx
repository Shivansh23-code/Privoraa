import styles from './MockupSection.module.css';
import mockupImg from '../assets/privoraa-mockup-2.jpg';

const MockupSection = () => {
    return (
        <section className={styles.section}>
            <img src={mockupImg} alt="Privoraa App Screenshot" className={styles.mockup} />
        </section>
    );
};

export default MockupSection;