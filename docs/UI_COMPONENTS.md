# GHOST UI Components

## Overview

GHOST's UI is built with React and TypeScript, following a component-based architecture. The interface features a dark theme and focuses on simplicity and security.

## Component Hierarchy

```
App
├── Onboarding          # First-time setup
├── Unlock              # Password/biometric entry
└── Chat                # Main chat interface
    ├── Header          # App title and controls
    ├── MessageList     # Chat messages
    ├── MessageInput    # Text input
    └── LoadingState    # Processing indicator
```

## Core Components

### App Component

The root component that manages application-level state and routing.

```typescript
// src/renderer/app.tsx
function App() {
  const [currentView, setCurrentView] = useState<AppView>('loading');
  const [authState, setAuthState] = useState<AuthState | null>(null);

  // View routing based on auth state
  return (
    <div className="app">
      {currentView === 'onboarding' && <Onboarding />}
      {currentView === 'unlock' && <Unlock />}
      {currentView === 'chat' && <Chat />}
    </div>
  );
}
```

**Props:** None

**State:**
- `currentView`: Current active view
- `authState`: Authentication status

### Onboarding Component

Handles first-time password setup and optional biometric enrollment.

```typescript
// src/renderer/views/Onboarding.tsx
export function Onboarding({ onPasswordCreated }: OnboardingProps) {
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Password creation logic
}
```

**Props:**
- `onPasswordCreated: () => void` - Callback after successful setup

**Features:**
- Password strength validation
- Confirmation matching
- Error display
- Loading states

### Unlock Component

Provides password and biometric unlock options.

```typescript
// src/renderer/views/Unlock.tsx
export function Unlock({ 
  onUnlocked, 
  canUseBiometric, 
  biometricEnabled 
}: UnlockProps) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  // Unlock methods
}
```

**Props:**
- `onUnlocked: () => void` - Success callback
- `canUseBiometric?: boolean` - Touch ID availability
- `biometricEnabled?: boolean` - Touch ID setup status

**Features:**
- Password input
- Touch ID button (macOS)
- Error handling
- Loading states

### Chat Component

Main chat interface with message history and input.

```typescript
// src/renderer/views/Chat.tsx
export function Chat({ onLock }: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);

  // Chat functionality
}
```

**Props:**
- `onLock: () => void` - Lock callback

**Features:**
- Message history
- Real-time updates
- Auto-scroll
- Loading indicators

## Styling System

### Theme Variables

```css
:root {
  /* Colors */
  --color-background: #1a1a1a;
  --color-surface: #2a2a2a;
  --color-primary: #4a90e2;
  --color-text: #ffffff;
  --color-text-secondary: #aaaaaa;
  --color-error: #ff6b6b;
  --color-success: #28a745;
  
  /* Spacing */
  --spacing-xs: 0.25rem;
  --spacing-sm: 0.5rem;
  --spacing-md: 1rem;
  --spacing-lg: 1.5rem;
  --spacing-xl: 2rem;
  
  /* Typography */
  --font-sans: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
  --font-size-sm: 0.875rem;
  --font-size-md: 1rem;
  --font-size-lg: 1.25rem;
  
  /* Borders */
  --radius-sm: 0.25rem;
  --radius-md: 0.375rem;
  --radius-lg: 0.5rem;
}
```

### Component Styling

```css
/* Component structure */
.component {
  /* Layout */
  display: flex;
  flex-direction: column;
  
  /* Spacing */
  padding: var(--spacing-md);
  gap: var(--spacing-sm);
  
  /* Colors */
  background: var(--color-surface);
  color: var(--color-text);
  
  /* Borders */
  border-radius: var(--radius-md);
}

/* Modifiers */
.component--loading {
  opacity: 0.6;
  pointer-events: none;
}

.component--error {
  border-color: var(--color-error);
}
```

## Common Patterns

### Loading States

```typescript
function LoadingButton({ loading, children, ...props }) {
  return (
    <button disabled={loading} {...props}>
      {loading ? <Spinner /> : children}
    </button>
  );
}
```

### Error Handling

```typescript
function ErrorMessage({ error }) {
  if (!error) return null;
  
  return (
    <div className="error-message">
      <Icon name="alert" />
      <span>{error}</span>
    </div>
  );
}
```

### Form Handling

```typescript
function useForm(initialValues, onSubmit) {
  const [values, setValues] = useState(initialValues);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      await onSubmit(values);
    } catch (error) {
      setErrors({ submit: error.message });
    } finally {
      setLoading(false);
    }
  };

  return { values, errors, loading, handleSubmit };
}
```

## Hooks

### useAuth

Manages authentication state across components.

```typescript
export function useAuth() {
  const [authState, setAuthState] = useState<AuthState | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshAuthState = useCallback(async () => {
    try {
      const state = await window.ghost.getAuthState();
      setAuthState(state);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refreshAuthState();
  }, [refreshAuthState]);

  return { authState, loading, refreshAuthState };
}
```

### useMessages

Handles chat message operations.

```typescript
export function useMessages() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);

  const loadMessages = useCallback(async () => {
    const messages = await window.ghost.getChatLog();
    setMessages(messages);
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    setLoading(true);
    try {
      await window.ghost.sendChat(text);
      await loadMessages(); // Refresh
    } finally {
      setLoading(false);
    }
  }, [loadMessages]);

  return { messages, loading, sendMessage, loadMessages };
}
```

### useKeyboard

Keyboard shortcut handling.

```typescript
export function useKeyboard(shortcuts: Record<string, () => void>) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const key = `${e.ctrlKey ? 'ctrl+' : ''}${e.key}`;
      
      if (shortcuts[key]) {
        e.preventDefault();
        shortcuts[key]();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}
```

## Animation

### Transitions

```css
/* Smooth transitions */
.fade-enter {
  opacity: 0;
}

.fade-enter-active {
  opacity: 1;
  transition: opacity 300ms ease-in;
}

.fade-exit {
  opacity: 1;
}

.fade-exit-active {
  opacity: 0;
  transition: opacity 300ms ease-out;
}
```

### Loading Animations

```css
@keyframes spin {
  to { transform: rotate(360deg); }
}

.spinner {
  animation: spin 1s linear infinite;
}

@keyframes pulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.5; }
}

.loading-text {
  animation: pulse 1.5s ease-in-out infinite;
}
```

## Accessibility

### Focus Management

```typescript
function Dialog({ isOpen, onClose, children }) {
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      dialogRef.current?.focus();
    }
  }, [isOpen]);

  return (
    <div
      ref={dialogRef}
      role="dialog"
      aria-modal="true"
      tabIndex={-1}
    >
      {children}
    </div>
  );
}
```

### ARIA Labels

```typescript
<button
  aria-label="Lock application"
  title="Lock (Cmd+L)"
  onClick={handleLock}
>
  <LockIcon />
</button>

<input
  type="password"
  aria-label="Master password"
  placeholder="Enter password"
  required
/>
```

### Keyboard Navigation

```typescript
function MessageList({ messages, onSelectMessage }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const handleKeyDown = (e: KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowUp':
        setSelectedIndex(Math.max(0, selectedIndex - 1));
        break;
      case 'ArrowDown':
        setSelectedIndex(Math.min(messages.length - 1, selectedIndex + 1));
        break;
      case 'Enter':
        onSelectMessage(messages[selectedIndex]);
        break;
    }
  };

  return (
    <div onKeyDown={handleKeyDown} tabIndex={0}>
      {messages.map((msg, idx) => (
        <MessageItem
          key={msg.id}
          message={msg}
          selected={idx === selectedIndex}
        />
      ))}
    </div>
  );
}
```

## Responsive Design

### Breakpoints

```css
/* Mobile first approach */
.container {
  padding: 1rem;
}

/* Tablet */
@media (min-width: 768px) {
  .container {
    padding: 2rem;
    max-width: 768px;
    margin: 0 auto;
  }
}

/* Desktop */
@media (min-width: 1024px) {
  .container {
    max-width: 1024px;
  }
}
```

### Flexible Layouts

```css
.chat-container {
  display: flex;
  flex-direction: column;
  height: 100vh;
}

.messages {
  flex: 1;
  overflow-y: auto;
}

.input-area {
  flex-shrink: 0;
  padding: 1rem;
}
```

## Component Testing

### Unit Tests

```typescript
// Onboarding.test.tsx
import { render, fireEvent, waitFor } from '@testing-library/react';
import { Onboarding } from './Onboarding';

test('validates password match', async () => {
  const { getByLabelText, getByText } = render(
    <Onboarding onPasswordCreated={jest.fn()} />
  );

  fireEvent.change(getByLabelText('Password'), {
    target: { value: 'test123' }
  });

  fireEvent.change(getByLabelText('Confirm Password'), {
    target: { value: 'test456' }
  });

  fireEvent.click(getByText('Create Password'));

  await waitFor(() => {
    expect(getByText('Passwords do not match')).toBeInTheDocument();
  });
});
```

### Integration Tests

```typescript
// Chat.integration.test.tsx
test('sends and displays messages', async () => {
  const { getByPlaceholderText, getByText, findByText } = render(<Chat />);
  
  const input = getByPlaceholderText('Type a message...');
  fireEvent.change(input, { target: { value: 'Hello' } });
  fireEvent.click(getByText('Send'));

  await waitFor(() => {
    expect(findByText('Hello')).toBeInTheDocument();
    expect(findByText(/Echo: Hello/)).toBeInTheDocument();
  });
});
```

## Performance

### Memoization

```typescript
// Expensive list rendering
const MessageList = React.memo(({ messages }) => {
  return messages.map(msg => (
    <Message key={msg.id} {...msg} />
  ));
}, (prevProps, nextProps) => {
  return prevProps.messages.length === nextProps.messages.length;
});
```

### Virtualization

```typescript
// For long lists
import { FixedSizeList } from 'react-window';

function VirtualMessageList({ messages }) {
  const Row = ({ index, style }) => (
    <div style={style}>
      <Message {...messages[index]} />
    </div>
  );

  return (
    <FixedSizeList
      height={600}
      itemCount={messages.length}
      itemSize={80}
      width="100%"
    >
      {Row}
    </FixedSizeList>
  );
}
```

## Future Components

1. **Settings Panel** - User preferences
2. **Plugin Manager** - Install/manage plugins
3. **Search Interface** - Search messages
4. **Export Dialog** - Data export options
5. **Theme Picker** - UI customization
6. **Keyboard Shortcuts** - Help overlay
7. **Status Bar** - Connection status
8. **Notification System** - Toast messages