import React, { useState, useEffect } from 'react';

const PatternForm = ({ onSubmit, existingPattern, onCancel }) => {
  const [category, setCategory] = useState('');
  const [pattern, setPattern] = useState('');
  const [response, setResponse] = useState('');

  useEffect(() => {
    if (existingPattern) {
      setCategory(existingPattern.category);
      setPattern(existingPattern.pattern);
      setResponse(existingPattern.response);
    }
  }, [existingPattern]);

  const handleSubmit = (e) => {
    e.preventDefault();
    onSubmit({ category, pattern, response });
    setCategory('');
    setPattern('');
    setResponse('');
  };

  return (
    <form onSubmit={handleSubmit} style={{ marginBottom: '1rem' }}>
      <input placeholder="Category" value={category} onChange={(e) => setCategory(e.target.value)} required />
      <input placeholder="Pattern" value={pattern} onChange={(e) => setPattern(e.target.value)} required />
      <input placeholder="Response" value={response} onChange={(e) => setResponse(e.target.value)} required />
      <button type="submit">{existingPattern ? 'Update' : 'Add'}</button>
      {existingPattern && <button onClick={onCancel}>Cancel</button>}
    </form>
  );
};

export default PatternForm;
