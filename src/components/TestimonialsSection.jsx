import styles from './TestimonialsSection.module.css';
import useFadeIn from '../hooks/useFadeIn';

const testimonials = [
    {
        quote: "EchoMind is like having a digital twin — it actually understands me.",
        author: "Beta User (Student, 22)"
    },
    {
        quote: "Finally an AI that doesn’t just hallucinate answers but remembers my goals.",
        author: "Freelance Web Developer"
    }
];

const TestimonialsSection = () => {
    const [ref, isVisible] = useFadeIn({ threshold: 0.1 });

    return(
        <section ref={ref} className={`${styles.section} fade-in-section ${isVisible ? 'is-visible' : ''}`}>
             <h2 className={styles.mainTitle}>Real Stories, Real Impact</h2>
            <div className={styles.container}>
                {testimonials.map((testimonial, index) => (
                    <blockquote key={index} className={styles.testimonialCard}>
                        <p className={styles.quote}>“{testimonial.quote}”</p>
                        <cite className={styles.author}>— {testimonial.author}</cite>
                    </blockquote>
                ))}
            </div>
        </section>
    );
}

export default TestimonialsSection;