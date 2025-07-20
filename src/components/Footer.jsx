import styles from './Footer.module.css';

const Footer = () => {
  return (
    <footer className={styles.footer}>
        <div className={styles.links}>
            <a href="#">Privacy Policy</a>
            <a href="#">Terms of Service</a>
            <a href="mailto:contact@privoraa.com">Contact</a>
        </div>
        <p className={styles.copyright}>
            &copy; {new Date().getFullYear()} Privoraa. All rights reserved.
        </p>
    </footer>
  );
};

export default Footer;