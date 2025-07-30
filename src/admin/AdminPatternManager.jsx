import React, { useEffect, useState } from 'react';
import PatternForm from '../components/PatternForm';
import PatternTable from '../components/PatternTable';

const STORAGE_KEY = 'privoraa_patterns';

const AdminPatternManager = () => {
  const [patterns, setPatterns] = useState([]);
  const [editing, setEditing] = useState(null);

  // Load patterns from localStorage
  const fetchPatterns = () => {
    const stored = localStorage.getItem(STORAGE_KEY);
    const data = stored ? JSON.parse(stored) : [];
    setPatterns(data);
  };

  useEffect(() => {
    fetchPatterns();
  }, []);

  const handleAddOrUpdate = (data) => {
    const current = [...patterns];

    if (editing) {
      const updated = current.map(p =>
        p.id === editing.id ? { ...p, ...data } : p
      );
      localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
      setEditing(null);
    } else {
      const newPattern = {
        id: Date.now(), // Unique ID based on timestamp
        ...data
      };
      current.push(newPattern);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(current));
    }

    fetchPatterns();
  };

  const handleEdit = (pattern) => {
    setEditing(pattern);
  };

  const handleDelete = (id) => {
    const updated = patterns.filter(p => p.id !== id);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
    fetchPatterns();
  };

  return (
    <div style={{ padding: '2rem' }}>
      <h2>🔧 Admin: Manage Privoraa Patterns (Local Mode)</h2>
      <PatternForm
        onSubmit={handleAddOrUpdate}
        existingPattern={editing}
        onCancel={() => setEditing(null)}
      />
      <PatternTable
        patterns={patterns}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />
    </div>
  );
};

export default AdminPatternManager;
