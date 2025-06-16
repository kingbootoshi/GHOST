import React, { useState, useEffect, useRef } from 'react';
import { useSupabase } from '../../renderer/components/SupabaseProvider';
import { useSupabaseAuth } from '../../renderer/hooks/useSupabaseAuth';

interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  updated_at: number;
}

export default function AiChatUI() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [partialResponse, setPartialResponse] = useState('');
  const [systemPrompt, setSystemPrompt] = useState('');
  const [showSettings, setShowSettings] = useState(false);
  const [model, setModel] = useState('@cf/meta/llama-3.3-70b-instruct-fp8-fast');
  const [temperature, setTemperature] = useState(0.7);
  const [maxTokens, setMaxTokens] = useState(256);
  const [enableTools, setEnableTools] = useState(true);
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const partialBufferRef = useRef<string>('');
  
  const { user } = useSupabaseAuth();
  const supabase = useSupabase();

  useEffect(() => {
    loadHistory();
    // Load settings from localStorage
    const savedPrompt = localStorage.getItem('ghost.systemPrompt') || '';
    const savedModel = localStorage.getItem('ghost.aiModel') || '@cf/meta/llama-3.3-70b-instruct-fp8-fast';
    const savedTemp = localStorage.getItem('ghost.temperature');
    const savedMaxTokens = localStorage.getItem('ghost.maxTokens');
    const savedEnableTools = localStorage.getItem('ghost.enableTools');
    
    setSystemPrompt(savedPrompt);
    setModel(savedModel);
    if (savedTemp) setTemperature(parseFloat(savedTemp));
    if (savedMaxTokens) setMaxTokens(parseInt(savedMaxTokens));
    if (savedEnableTools !== null) setEnableTools(savedEnableTools === 'true');
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages, partialResponse]);

  useEffect(() => {
    // Subscribe to partial updates
    const handler = (_event: any, data: { chunk: string }) => {
      partialBufferRef.current += data.chunk;
      setPartialResponse(partialBufferRef.current);
    };

    window.ghost.on('ai-chat:partial', handler);

    return () => {
      window.ghost.off('ai-chat:partial', handler);
    };
  }, []);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const loadHistory = async () => {
    try {
      // Module functions are exported using camelCase; ensure we invoke the correct name
      const history = await window.ghost.invokeModule('ai-chat', 'getHistory', {});
      setMessages(history as ChatMessage[]);
    } catch (err) {
      console.error('[AiChat] Failed to load history:', err);
    }
  };

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    if (!user) {
      alert('Please log in with Supabase to use AI chat');
      return;
    }

    const userMessage = input;
    setInput('');
    setLoading(true);
    setPartialResponse('');
    partialBufferRef.current = '';

    // Add temporary user message for immediate feedback
    setMessages(prev => [...prev, {
      role: 'user',
      content: userMessage,
      updated_at: Date.now()
    }]);

    try {
      // Get fresh session token
      const { data: { session } } = await supabase.auth.getSession();
      
      if (!session?.access_token) {
        throw new Error('Session expired. Please log in again.');
      }

      await window.ghost.invokeModule('ai-chat', 'chat', {
        prompt: userMessage,
        systemPrompt: systemPrompt || undefined,
        jwt: session.access_token,
        model,
        temperature,
        maxTokens,
        tools: enableTools ? [
          {
            name: 'echo.reply',
            description: 'Echo text back to the user',
            parameters: {
              type: 'object' as const,
              properties: { text: { type: 'string' } },
              required: ['text']
            }
          }
        ] : undefined
      });

      // Reload full history to get persisted messages
      await loadHistory();
    } catch (err) {
      console.error('[AiChat] Send error:', err);
      // Remove temporary message on error
      setMessages(prev => prev.slice(0, -1));
      alert(err instanceof Error ? err.message : 'Failed to send message');
    } finally {
      setLoading(false);
      setPartialResponse('');
      partialBufferRef.current = '';
    }
  };

  const handleSystemPromptSave = () => {
    localStorage.setItem('ghost.systemPrompt', systemPrompt);
    localStorage.setItem('ghost.aiModel', model);
    localStorage.setItem('ghost.temperature', temperature.toString());
    localStorage.setItem('ghost.maxTokens', maxTokens.toString());
    localStorage.setItem('ghost.enableTools', enableTools.toString());
    setShowSettings(false);
  };

  if (!user) {
    return (
      <div style={{ padding: 16, textAlign: 'center' }}>
        <h2>AI Chat</h2>
        <p>Please log in with Supabase to use AI chat</p>
        <button onClick={() => window.location.hash = '#/settings'}>
          Go to Settings
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', position: 'relative' }}>
      <div style={{ 
        padding: '16px', 
        borderBottom: '1px solid #e0e0e0',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
      }}>
        <h2 style={{ margin: 0 }}>AI Chat</h2>
        <button 
          onClick={() => setShowSettings(!showSettings)}
          style={{ padding: '4px 8px' }}
        >
          Settings
        </button>
      </div>

      {showSettings && (
        <div style={{
          position: 'absolute',
          top: '60px',
          right: '16px',
          background: 'white',
          border: '1px solid #ccc',
          borderRadius: '4px',
          padding: '16px',
          zIndex: 10,
          boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
          width: '400px'
        }}>
          <h3 style={{ marginTop: 0 }}>AI Settings</h3>
          
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Model</div>
            <select
              value={model}
              onChange={(e) => setModel(e.target.value)}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc'
              }}
            >
              <option value="@cf/meta/llama-3.3-70b-instruct-fp8-fast">Llama 3.3 70B (Fast)</option>
              <option value="@cf/google/gemma-7b-it">Gemma 7B</option>
            </select>
          </label>
          
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>System Prompt</div>
            <textarea
              value={systemPrompt}
              onChange={(e) => setSystemPrompt(e.target.value)}
              placeholder="Enter system prompt..."
              rows={3}
              style={{
                width: '100%',
                padding: '8px',
                borderRadius: '4px',
                border: '1px solid #ccc',
                fontFamily: 'inherit',
                fontSize: '14px'
              }}
            />
          </label>
          
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Temperature: {temperature}</div>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={temperature}
              onChange={(e) => setTemperature(parseFloat(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>
          
          <label style={{ display: 'block', marginBottom: '12px' }}>
            <div style={{ marginBottom: '4px', fontSize: '14px', fontWeight: 500 }}>Max Tokens: {maxTokens}</div>
            <input
              type="range"
              min="50"
              max="2048"
              step="50"
              value={maxTokens}
              onChange={(e) => setMaxTokens(parseInt(e.target.value))}
              style={{ width: '100%' }}
            />
          </label>
          
          <label style={{ display: 'flex', alignItems: 'center', marginBottom: '12px', cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={enableTools}
              onChange={(e) => setEnableTools(e.target.checked)}
              style={{ marginRight: '8px' }}
            />
            <span style={{ fontSize: '14px' }}>Enable Tools (Echo Module)</span>
          </label>
          <div style={{ marginTop: '8px', display: 'flex', gap: '8px' }}>
            <button onClick={handleSystemPromptSave}>Save</button>
            <button onClick={() => setShowSettings(false)}>Cancel</button>
          </div>
        </div>
      )}

      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px'
      }}>
        {messages.map((message, idx) => (
          <div
            key={idx}
            style={{
              padding: '12px',
              borderRadius: '8px',
              backgroundColor: message.role === 'user' ? '#e3f2fd' : '#f5f5f5',
              alignSelf: message.role === 'user' ? 'flex-end' : 'flex-start',
              maxWidth: '70%'
            }}
          >
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>
              {message.role === 'user' ? 'You' : 'Assistant'}
            </div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{message.content}</div>
            <div style={{ 
              fontSize: '12px', 
              color: '#666', 
              marginTop: '4px' 
            }}>
              {new Date(message.updated_at).toLocaleTimeString()}
            </div>
          </div>
        ))}
        
        {loading && partialResponse && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: '#f5f5f5',
            alignSelf: 'flex-start',
            maxWidth: '70%'
          }}>
            <div style={{ fontWeight: 'bold', marginBottom: '4px' }}>Assistant</div>
            <div style={{ whiteSpace: 'pre-wrap' }}>{partialResponse}</div>
          </div>
        )}
        
        {loading && !partialResponse && (
          <div style={{
            padding: '12px',
            borderRadius: '8px',
            backgroundColor: '#f5f5f5',
            alignSelf: 'flex-start'
          }}>
            <div>Processing...</div>
          </div>
        )}
        
        <div ref={messagesEndRef} />
      </div>

      <form onSubmit={handleSend} style={{ 
        padding: '16px', 
        borderTop: '1px solid #e0e0e0',
        display: 'flex',
        gap: '8px'
      }}>
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a message..."
          disabled={loading}
          style={{
            flex: 1,
            padding: '8px 12px',
            borderRadius: '4px',
            border: '1px solid #ccc',
            fontSize: '14px'
          }}
        />
        <button 
          type="submit" 
          disabled={loading || !input.trim()}
          style={{
            padding: '8px 16px',
            borderRadius: '4px',
            border: 'none',
            backgroundColor: loading || !input.trim() ? '#ccc' : '#1976d2',
            color: 'white',
            cursor: loading || !input.trim() ? 'not-allowed' : 'pointer'
          }}
        >
          Send
        </button>
      </form>
    </div>
  );
}