import React from "react";
import styles from "./Footer.module.css";

const Footer = () => {
  return (
    <footer className={styles.footer}>
      <p>© {new Date().getFullYear()} Privoraa. All rights reserved.</p>
      <div className={styles.links}>
        <a href="https://privoraa.vercel.app/" target="_blank" rel="noopener noreferrer">Home</a>
        <a href="mailto:contact@privoraa.com">Contact</a>
        <a href="#">Privacy Policy</a>
      </div>
    </footer>
  );
};

export default Footer;
