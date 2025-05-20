import React, { useEffect, useState } from 'react';

export default function EchoUI() {
  const [logs, setLogs] = useState<Array<{ text: string; ts: number }>>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  const loadLogs = async () => {
    try {
      const data = await window.ghost.invokeModule('echo', 'get-log', {});
      setLogs(data as Array<{ text: string; ts: number }>);
    } catch (err) {
      console.error('[EchoUI] failed to fetch logs', err);
    }
  };

  useEffect(() => {
    loadLogs();
  }, []);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim()) return;
    setLoading(true);
    try {
      await window.ghost.invokeModule('echo', 'reply', { text: input });
      setInput('');
      await loadLogs();
    } catch (err) {
      console.error('[EchoUI] send error', err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{ padding: 16 }}>
      <h2>Echo</h2>
      <form onSubmit={handleSend} style={{ marginBottom: 16 }}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Enter text…"
          disabled={loading}
          style={{ width: '70%', marginRight: 8 }}
        />
        <button type="submit" disabled={loading}>Send</button>
      </form>

      <ul style={{ listStyle: 'none', padding: 0 }}>
        {logs.map((l, idx) => (
          <li key={idx} style={{ marginBottom: 4 }}>
            {new Date(l.ts).toLocaleTimeString()}: {l.text}
          </li>
        ))}
      </ul>
    </div>
  );
} 