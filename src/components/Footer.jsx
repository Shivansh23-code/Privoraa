import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
        <div className={styles.links}>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="mailto:hello@privoraa.com">hello@privoraa.com</a>
        </div>
        <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} Privoraa
        </p>
    </footer>
  );
};

export default Footer;