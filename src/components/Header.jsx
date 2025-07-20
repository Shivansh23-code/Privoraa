import styles from './Header.module.css';
import ThemeToggle from './ThemeToggle';

const Header = () => {
  return (
    <header className={styles.header}>
      <div className={styles.logo}>
        <img src="/logo.png" alt="Privoraa Logo" />
        <span>Privoraa</span>
      </div>
      <ThemeToggle />
    </header>
  );
};

export default Header;
