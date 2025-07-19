import { useState } from 'react';
import styles from './HeroSection.module.css';
const HeroSection = () => {
    const [email, setEmail] = useState('');
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);

    const handleSubmit = async (e) => {
        e.preventDefault();
        setMessage('');
        setIsError(false);

        try {
            const response = await fetch('http://localhost:8085/api/waitlist/join', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ email })
            });

            // Check if response has JSON before trying to parse
            const contentType = response.headers.get("content-type");
            const data = contentType && contentType.includes("application/json")
                ? await response.json()
                : { message: "No response body" };

            if (!response.ok) {
                throw new Error(data.message || `HTTP error! status: ${response.status}`);
            }

            setMessage(data.message || "✅ Successfully joined the waitlist!");
            setEmail('');
        } catch (error) {
            setMessage(error.message || "❌ Something went wrong.");
            setIsError(true);
        }
    };

    return (
        <section className={styles.section}>
            <div className={styles.container}>
                <h1 className={styles.title}>Your AI That Thinks With You, Not For You</h1>
                <p className={styles.subtitle}>
                    Meet EchoMind — Your private, offline-friendly personal business agent. Built for creators, students, and small business owners who want focus, privacy, and real help—not another generic chatbot.
                </p>
                <form onSubmit={handleSubmit} className={styles.form}>
                    <input
                        type="email"
                        placeholder="your@email.com"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        className={styles.input}
                    />
                    <button type="submit" className={styles.button}>
                        🔒 Join the Early Access List
                    </button>
                </form>
                {message && <p className={`${styles.message} ${isError ? styles.error : styles.success}`}>{message}</p>}
            </div>
        </section>
    );

    // Styles
    // const sectionStyles = {
    //     textAlign: 'center',
    //     padding: '6rem 2rem',
    //     backgroundColor: 'var(--color-white)',
    //     display: 'flex',
    //     flexDirection: 'column',
    //     alignItems: 'center',
    // };
    // const containerStyles = { maxWidth: '800px' };
    // const h1Styles = { fontSize: '3.5rem', color: 'var(--color-text)' };
    // const pStyles = { fontSize: '1.25rem', color: '#6C757D', margin: '1.5rem 0 2.5rem 0' };
    // const formStyles = { display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap' };
    // const inputStyles = {
    //     padding: '1rem',
    //     fontSize: '1rem',
    //     width: '300px',
    //     borderRadius: '8px',
    //     border: '1px solid var(--color-border)'
    // };
    // const buttonStyles = {
    //     padding: '1rem 2rem',
    //     fontSize: '1rem',
    //     backgroundColor: 'var(--color-primary)',
    //     color: 'var(--color-white)',
    //     border: 'none',
    //     borderRadius: '8px',
    //     cursor: 'pointer',
    //     fontWeight: '500'
    // };
    // const messageStyles = {
    //     marginTop: '1rem',
    //     color: isError ? 'var(--color-error)' : 'var(--color-success)',
    //     fontWeight: '500'
    // };

    // return (
    //     <section style={sectionStyles}>
    //         <div style={containerStyles}>
    //             <h1 style={h1Styles}>Your AI That Thinks With You, Not For You</h1>
    //             <p style={pStyles}>
    //                 Meet EchoMind — Your private, offline-friendly personal business agent. Built for creators,
    //                 students, and small business owners who want focus, privacy, and real help—not another generic chatbot.
    //             </p>
    //             <form onSubmit={handleSubmit} style={formStyles}>
    //                 <input
    //                     type="email"
    //                     placeholder="your@email.com"
    //                     value={email}
    //                     onChange={(e) => setEmail(e.target.value)}
    //                     required
    //                     style={inputStyles}
    //                 />
    //                 <button type="submit" style={buttonStyles}>
    //                     🔒 Join the Early Access List
    //                 </button>
    //             </form>
    //             {message && <p style={messageStyles}>{message}</p>}
    //         </div>
    //     </section>
    // );
};

export default HeroSection;
