import React, { useState, useEffect } from 'react';
import { getWaitlist } from './adminApi';
import { useAdminAuth } from '../context/AdminAuthContext';

function Dashboard() {
  const [waitlist, setWaitlist] = useState([]);
  const [error, setError] = useState('');
  const { logout } = useAdminAuth();

  useEffect(() => {
    const fetchWaitlist = async () => {
      try {
        const response = await getWaitlist();
        setWaitlist(response.data);
      } catch (err) {
        setError('Failed to fetch waitlist. Please try again.');
        console.error(err);
      }
    };

    fetchWaitlist();
  }, []);

  return (
    <div style={{ padding: '20px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2>Admin Dashboard - Waitlist</h2>
        <button onClick={logout} style={{ padding: '8px 16px', backgroundColor: '#dc3545', color: 'white', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Logout
        </button>
      </div>
      <hr />
      {error && <p style={{ color: 'red' }}>{error}</p>}
      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: '20px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Email</th>
            <th style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'left' }}>Joined At</th>
          </tr>
        </thead>
        <tbody>
          {waitlist.length > 0 ? (
            waitlist.map((item) => (
              <tr key={item.id}>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>{item.email}</td>
                <td style={{ border: '1px solid #ddd', padding: '8px' }}>
                  {new Date(item.created_at).toLocaleString()}
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan="2" style={{ border: '1px solid #ddd', padding: '8px', textAlign: 'center' }}>
                No users on the waitlist yet.
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default Dashboard;