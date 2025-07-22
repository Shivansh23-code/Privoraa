import React from 'react';
import { useUserAuth } from '../context/UserAuthContext';

function Dashboard() {
  const { user, logout } = useUserAuth();

  return (
    <div style={{ padding: '50px' }}>
      <h2>Welcome to your Dashboard, {user?.name || 'User'}!</h2>
      <p>Your email is: {user?.email}</p>
      <br />
      <p>This is your protected dashboard area. Only logged-in users can see this.</p>
      <br />
      <button onClick={logout} style={{ padding: '10px 20px' }}>Logout</button>
    </div>
  );
}

export default Dashboard;