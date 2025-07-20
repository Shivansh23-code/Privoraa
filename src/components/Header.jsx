import styles from './Header.module.css';
import logo from '../assets/privoraa-icon-1.png'; // Using your final chosen icon

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <a href="/" className={styles.logoLink}>
          <img src={logo} alt="Privoraa Logo" className={styles.logoImage} />
          <span className={styles.logoText}>Privoraa</span>
        </a>
      </div>
    </header>
  );
};

export default Header;