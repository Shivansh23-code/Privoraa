import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
        <div className={styles.links}>
            <a href="#">Terms</a> | 
            <a href="#">Privacy</a> | 
            <a href="mailto:contact@privoraa.com">Contact</a>
        </div>
        <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} Privoraa
        </p>
    </footer>
  );
};

export default Footer;