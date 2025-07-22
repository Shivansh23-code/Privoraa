import React, { useState } from 'react';
// 1. You must import 'Link' here to use it in your component
import { Link } from 'react-router-dom'; 
import { useUserAuth } from '../context/UserAuthContext';

// We don't need useNavigate here, so it's removed for cleanup.

const SignUp = () => {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');

    // 2. You must call a hook with parentheses: useUserAuth()
    const { signUp } = useUserAuth();

    const handleSubmit = async (e) => {
        e.preventDefault();
        setError('');
        try {
            await signUp(name, email, password);
            // Navigation to the dashboard is handled by the context
        } catch (err) {
            setError('Failed to create an account. The email might already be in use.');
            console.error(err);
        }
    };

    return (
        <div style={{ maxWidth: '400px', margin: '50px auto', padding: '20px', border: '1px solid #ccc', borderRadius: '8px' }}>
            <h2>Create Your Account</h2>
            {error && <p style={{ color: 'red' }}>{error}</p>}
            <form onSubmit={handleSubmit}>
                <div style={{ marginBottom: '15px' }}>
                    <label>Name:</label>
                    <input
                        type="text"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label>Email:</label>
                    <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <div style={{ marginBottom: '15px' }}>
                    <label>Password:</label>
                    <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength="6"
                        style={{ width: '100%', padding: '8px', boxSizing: 'border-box' }}
                    />
                </div>
                <button type="submit" style={{ width: '100%', padding: '10px', backgroundColor: '#007bff', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
                    Sign Up
                </button>
            </form>
            <div style={{ marginTop: '20px', textAlign: 'center' }}>
                Already have an account? <Link to="/login">Login</Link>
            </div>
        </div>
    );
}

export default SignUp;