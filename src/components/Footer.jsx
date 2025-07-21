// src/components/Footer.jsx

import React from 'react';
import styles from './Footer.module.css';

const footerLinks = [
  {
    title: 'Product',
    links: [
      { label: 'Features', href: '#features' },
      { label: 'Security', href: '#' },
      { label: 'Pricing', href: '#' },
    ],
  },
  {
    title: 'Company',
    links: [
      { label: 'About Us', href: '#' },
      { label: 'Careers', href: '#' },
      { label: 'Contact', href: '#' },
    ],
  },
  {
    title: 'Legal',
    links: [
      { label: 'Privacy Policy', href: '#' },
      { label: 'Terms of Service', href: '#' },
    ],
  },
];

// Simple SVG icon components for social media
const SocialIcon = ({ href, children }) => (
  <a href={href} target="_blank" rel="noopener noreferrer" className={styles.socialLink}>
    {children}
  </a>
);

const Footer = () => {
  return (
    <footer className={styles.footerContainer}>
      <div className={styles.mainContent}>
        <div className={styles.brandColumn}>
          <h3 className={styles.brandName}>Privoraa</h3>
          <p className={styles.brandSlogan}>
            Intelligent Privacy, Effortlessly Managed.
          </p>
          <div className={styles.socials}>
            <SocialIcon href="#">
              <svg fill="currentColor" viewBox="0 0 24 24"><path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" /></svg>
            </SocialIcon>
            <SocialIcon href="#">
              <svg fill="currentColor" viewBox="0 0 24 24"><path d="M12 0C5.373 0 0 5.373 0 12s5.373 12 12 12 12-5.373 12-12S18.627 0 12 0zm-1.25 17.25h-3.5v-7.5h3.5v7.5zM10.5 8.5a1.75 1.75 0 110-3.5 1.75 1.75 0 010 3.5zM18.5 17.25h-3.5v-3.625c0-.875-.016-2-1.25-2s-1.438.938-1.438 1.938v3.687h-3.5v-7.5h3.363v1.562h.047c.469-.875 1.625-1.812 3.312-1.812 3.547 0 4.203 2.336 4.203 5.375v4.375z" /></svg>
            </SocialIcon>
          </div>
        </div>
        <div className={styles.linksGrid}>
          {footerLinks.map((column) => (
            <div key={column.title} className={styles.linkColumn}>
              <h4 className={styles.columnTitle}>{column.title}</h4>
              <ul>
                {column.links.map((link) => (
                  <li key={link.label}>
                    <a href={link.href} className={styles.footerLink}>
                      {link.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
      <div className={styles.copyrightBar}>
        <p>&copy; {new Date().getFullYear()} Privoraa. All rights reserved.</p>
      </div>
    </footer>
  );
};

export default Footer;