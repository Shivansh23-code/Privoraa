import React from 'react';

const PatternTable = ({ patterns, onEdit, onDelete }) => {
  return (
    <table border="1" cellPadding="5">
      <thead>
        <tr>
          <th>ID</th>
          <th>Category</th>
          <th>Pattern</th>
          <th>Response</th>
          <th>Actions</th>
        </tr>
      </thead>
      <tbody>
        {patterns.map((p) => (
          <tr key={p.id}>
            <td>{p.id}</td>
            <td>{p.category}</td>
            <td>{p.pattern}</td>
            <td>{p.response}</td>
            <td>
              <button onClick={() => onEdit(p)}>Edit</button>
              <button onClick={() => onDelete(p.id)}>Delete</button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
};

export default PatternTable;
