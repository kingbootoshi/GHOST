import React, { useState, useRef, useEffect } from 'react';
import GhostAnimator from './GhostAnimator';

interface Message {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: number;
}

interface ChatInterfaceProps {
  onLock: () => void;
}

/**
 * Chat interface component for interacting with the AI
 */
const ChatInterface: React.FC<ChatInterfaceProps> = ({ onLock }) => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '1',
      content: 'Hello! I\'m GHOST, your personal AI assistant. How can I help you today?',
      role: 'assistant',
      timestamp: Date.now()
    }
  ]);
  const [input, setInput] = useState<string>('');
  const [isSending, setIsSending] = useState<boolean>(false);
  const [isOpen, setIsOpen] = useState<boolean>(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  
  // Scroll to bottom whenever messages change
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // Listen for hotkey toggle
  useEffect(() => {
    const removeListener = window.electronAPI.onToggleChat(() => {
      setIsOpen(prev => !prev);
    });
    
    return () => {
      removeListener();
    };
  }, []);
  
  // Send message to AI
  const handleSendMessage = async () => {
    if (!input.trim() || isSending) return;
    
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: Date.now()
    };
    
    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsSending(true);
    
    try {
      // This would be the actual AI call in a fully implemented version
      // For now we'll just simulate a response
      setTimeout(() => {
        const assistantMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: `I received your message: "${input}"`,
          role: 'assistant',
          timestamp: Date.now()
        };
        
        setMessages(prev => [...prev, assistantMessage]);
        setIsSending(false);
      }, 1000);
    } catch (error) {
      console.error('Error sending message:', error);
      setIsSending(false);
    }
  };
  
  // Handle form submission
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    handleSendMessage();
  };
  
  // Handle keydown events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Send message on Enter without shift key
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };
  
  if (!isOpen) {
    return null; // Hide UI when closed
  }
  
  return (
    <div className="chat-container">
      <div className="chat-header">
        <div className="chat-title">
          <GhostAnimator visible={true} size={40} />
          <h2>GHOST</h2>
        </div>
        <div className="chat-controls">
          <button className="settings-button" onClick={() => {/* Open settings */}}>
            ⚙️
          </button>
          <button className="lock-button" onClick={onLock}>
            🔒
          </button>
          <button className="minimize-button" onClick={() => setIsOpen(false)}>
            —
          </button>
        </div>
      </div>
      
      <div className="chat-messages">
        {messages.map(message => (
          <div 
            key={message.id} 
            className={`message ${message.role === 'user' ? 'user-message' : 'ghost-message'}`}
          >
            {message.content}
          </div>
        ))}
        {isSending && (
          <div className="message ghost-message typing-indicator">
            <span>•</span><span>•</span><span>•</span>
          </div>
        )}
        <div ref={messagesEndRef}></div>
      </div>
      
      <form className="chat-input-container" onSubmit={handleSubmit}>
        <textarea
          className="chat-input"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a message..."
          rows={1}
          disabled={isSending}
        />
        <button 
          type="submit" 
          className="send-button"
          disabled={isSending || !input.trim()}
        >
          Send
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;