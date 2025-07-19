// src/components/Header.jsx
import styles from './Header.module.css';     // 1. Import the CSS module
import logo from '../assets/echomind-icon-1.jpg';     // 2. Keep your logo import

const Header = () => {
  // 3. All inline style objects are now removed.

  return (
    <header className={styles.header}>
      <div className={styles.container}>
        {/* 4. The link now includes the image and text for better branding */}
        <a href="/" className={styles.logoLink}>
          <img src={logo} alt="EchoMind Logo" className={styles.logoImage} />
          <span className={styles.logoText}>EchoMind</span>
        </a>
      </div>
    </header>
  );
};

export default Header;