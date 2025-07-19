// src/components/Footer.jsx

const Footer = () => {
  const footerStyles = {
    width: '100%',
    padding: '2rem',
    textAlign: 'center',
    marginTop: '4rem',
    borderTop: `1px solid var(--color-border)`,
    color: '#6C757D'
  };

  const textStyles = {
    fontSize: '0.9rem'
  }

  return (
    <footer style={footerStyles}>
        <p style={textStyles}>
            &copy; {new Date().getFullYear()} EchoMind. All rights reserved.
            <br/>
            Solving the psychological wound of being disconnected.
        </p>
    </footer>
  );
};

export default Footer;