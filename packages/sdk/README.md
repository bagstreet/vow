# vow-agent-sdk

Dependency-free client for the Vow Agent API (Node 18+, browsers).

```js
import { VowAgent } from 'vow-agent-sdk';
const vow = new VowAgent({ token: process.env.VOW_AGENT_TOKEN });
await vow.whoami();                                   // roles this token can use
await vow.remember('fitness', 'Ran 5 km in 28 min', { verified: true });
const hits = await vow.recall('running');
```

Errors throw `VowAgentError` with `status` and `body`. See `docs/API.md`.
