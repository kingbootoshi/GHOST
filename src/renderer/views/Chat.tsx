import React, { useState, useEffect, useRef } from 'react';

// Shared application-wide types
import { ChatMessage } from '../../types';

interface ChatProps {
  onLock: () => void;
}

export function Chat({ onLock }: ChatProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadChatHistory();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const loadChatHistory = async () => {
    try {
      const history = await window.ghost.getChatLog();
      setMessages(history);
    } catch (error) {
      console.error('Failed to load chat history:', error);
    }
  };

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = input;
    setInput('');
    setLoading(true);

    // Add user message to UI immediately
    const tempUserMessage: ChatMessage = {
      id: 'temp-user',
      role: 'user',
      content: userMessage,
      timestamp: Date.now()
    };
    setMessages(prev => [...prev, tempUserMessage]);

    try {
      const response = await window.ghost.sendChat(userMessage);
      
      // Update messages with the actual messages
      const updatedHistory = await window.ghost.getChatLog();
      setMessages(updatedHistory);
    } catch (error) {
      console.error('Failed to send message:', error);
      // Remove temporary message on error
      setMessages(prev => prev.filter(m => m.id !== 'temp-user'));
    } finally {
      setLoading(false);
    }
  };

  const handleLock = async () => {
    await window.ghost.lock();
    onLock();
  };

  return (
    <div className="chat-container">
      <header className="chat-header">
        <h1>GHOST</h1>
        <button onClick={handleLock} className="lock-button">
          Lock
        </button>
      </header>

      <div className="messages-container">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`message ${message.role}`}
          >
            <div className="message-content">{message.content}</div>
            <div className="message-time">
              {new Date(message.timestamp).toLocaleTimeString()}
            </div>
          </div>
        ))}
        {loading && (
          <div className="message assistant loading">
            <div className="message-content">Processing...</div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} className="input-form">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
        />
        <button type="submit" disabled={loading || !input.trim()}>
          Send
        </button>
      </form>
    </div>
  );
}