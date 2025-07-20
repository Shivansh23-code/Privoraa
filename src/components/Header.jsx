import styles from './Header.module.css';
import logo from '../assets/privoraa-logo.png';
import ThemeToggle from './ThemeToggle'; // Import the new component

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.container}>
        <a href="/" className={styles.logoLink}>
          <img src={logo} alt="Privoraa Logo" className={styles.logoImage} />
          <span className={styles.brandName}>Privoraa</span>
        </a>
        <ThemeToggle /> {/* Add the toggle button */}
      </div>
    </header>
  );
};
export default Header;