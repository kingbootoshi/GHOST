# Building a GHOST Plug-in

> **Scaffold**

```bash
npx ghost-cli create-module my-weather
````

creates:

```
src/modules/my-weather/
├── index.ts          # entry, exports AssistantModule
├── ui.tsx            # optional React pane
└── schema.sql        # if you prefer raw SQL
```

## 1. Minimal module

```ts
import { AssistantModule, defineTable } from '../../main/modules';

const weather: AssistantModule = {
  id: 'weather',
  meta: { title: 'Weather', icon: '⛅️' },

  functions: {
    'get-now': async ({ city }: { city: string }, ctx) => {
      const res = await fetch(`https://wttr.in/${city}?format=j1`).then(r => r.json());
      return res.current_condition[0];
    }
  },

  async init(ctx) {
    // Persistent cache with sync enabled
    defineTable('weather','cache','city TEXT, data TEXT', ctx.db, { sync: true });
  }
};

export default weather;
```

* **All tables live inside the encrypted DB.**
* **Never touch `fs` or `net`** directly; use `fetch` or Node APIs through main if needed.

## 2. Add a mini-agent (optional)

```ts
export const agent = {
  systemPrompt: `You are WeatherBot. Answer only about weather.`,
  model: 'openrouter/mistral-small',
  temperature: 0.2
};
```

The Core Agent merges this into its tool-calling planner.

## 3. Testing

```bash
npm run test -- module:weather
```

The test helper boots an in-memory encrypted DB + fake Supabase.

## 4. Sync flags

| Flag             | Effect                            |
| ---------------- | --------------------------------- |
| `{ sync: true }` | Table is replicated via PowerSync |
| omit / false     | Local-only                        |

## 5. IPC from a module

```ts
const notes = await ctx.invoke('notes','list', { tag:'urgent' });
```

Zero coupling: you just call the public function of another plug-in.