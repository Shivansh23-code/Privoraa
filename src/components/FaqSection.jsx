import { useState } from 'react';
import styles from './FaqSection.module.css';
import useFadeIn from '../hooks/useFadeIn';

const faqData = [
    {
        question: 'Is EchoMind really private?',
        answer: 'Yes. 100%. Your data is stored locally on your device and is never sent to the cloud. We have no access to it.'
    },
    {
        question: 'What platforms will be supported?',
        answer: 'Our initial launch will be focused on desktop platforms, including Windows, macOS, and Linux.'
    },
    {
        question: 'How is this different from other AI chatbots?',
        answer: 'EchoMind is not just a chatbot. It\'s a contextual agent that understands your projects, notes, and goals to provide truly personal assistance, all while being completely offline and private.'
    }
];

const FaqItem = ({ faq, isOpen, onClick }) => {
    return (
        <div className={styles.faqItem}>
            <button className={styles.question} onClick={onClick}>
                <span>{faq.question}</span>
                <span className={`${styles.icon} ${isOpen ? styles.open : ''}`}>+</span>
            </button>
            <div className={`${styles.answer} ${isOpen ? styles.open : ''}`}>
                <p>{faq.answer}</p>
            </div>
        </div>
    );
};

const FaqSection = () => {
    const [openIndex, setOpenIndex] = useState(null);
    const [ref, isVisible] = useFadeIn({ threshold: 0.1 });

    const handleClick = index => {
        setOpenIndex(index === openIndex ? null : index);
    };

    return (
        <section ref={ref} className={`${styles.section} fade-in-section ${isVisible ? 'is-visible' : ''}`}>
            <div className={styles.container}>
                <h2 className={styles.title}>Frequently Asked Questions</h2>
                <div className={styles.faqList}>
                    {faqData.map((faq, index) => (
                        <FaqItem
                            key={index}
                            faq={faq}
                            isOpen={index === openIndex}
                            onClick={() => handleClick(index)}
                        />
                    ))}
                </div>
            </div>
        </section>
    );
};

export default FaqSection;