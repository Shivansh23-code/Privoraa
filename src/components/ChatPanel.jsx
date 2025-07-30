import React, { useState, useEffect, useRef } from 'react';
import { getHistory, askQuestion } from '../api/chatApi';
import './ChatPanel.css';

const ChatPanel = ({ floating = false }) => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [chatType, setChatType] = useState('GPT');
  const chatBodyRef = useRef(null);

  const userId = localStorage.getItem('privoraa_user_id') || 'temp-user';

  const scrollToBottom = () => {
    if (chatBodyRef.current) {
      chatBodyRef.current.scrollTop = chatBodyRef.current.scrollHeight;
    }
  };

  useEffect(() => {
    const fetchHistory = async () => {
      try {
        const res = await getHistory(userId); // fetch from local API or mocked
        setMessages(res.data || []);
      } catch (err) {
        console.error("Failed to fetch chat history", err);
      }
    };
    fetchHistory();
  }, [userId]);

  useEffect(() => {
    scrollToBottom();
  }, [messages, isLoading]);

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim()) return;

    const userMessage = { sender: 'user', message: input };
    setMessages(prev => [...prev, userMessage]); 
    const currentInput = input;
    setInput('');
    setIsLoading(true);

    const payload = { userId, message: currentInput, chatType };

    try {
      const res = await askQuestion(payload);
      const aiMessage = { sender: 'ai', response: res.data.response };
      setMessages(prev => [...prev, aiMessage]); 
    } catch (error) {
      console.error('Error sending message', error);
      const errorMsg = { sender: 'ai', response: 'Sorry, an error occurred while connecting to the AI.' };
      setMessages(prev => [...prev, errorMsg]);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`chat-widget ${floating ? 'floating' : 'embedded'}`}>
      <div className="chat-header">
        <select value={chatType} onChange={e => setChatType(e.target.value)}>
          <option value="GPT">Gemini</option>
          <option value="Privoraa">Privoraa</option>
        </select>
      </div>

      <div className="chat-body" ref={chatBodyRef}>
        {messages.map((msg, idx) => (
          <div key={idx} className={msg.sender === 'user' ? 'user-msg' : 'ai-msg'}>
            <p>{msg.message || msg.response}</p>
          </div>
        ))}
        {isLoading && (
          <div className="ai-msg">
            <p><i>Typing...</i></p>
          </div>
        )}
      </div>

      <form className="chat-input" onSubmit={handleSendMessage}>
        <input
          value={input}
          onChange={e => setInput(e.target.value)}
          placeholder="Ask something..."
          disabled={isLoading}
        />
        <button type="submit" disabled={isLoading}>Send</button>
      </form>
    </div>
  );
};

export default ChatPanel;
