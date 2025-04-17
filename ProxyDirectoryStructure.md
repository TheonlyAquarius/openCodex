openai-proxy/ 
├── src/
│   ├── index.ts             # Entrypoint, spins up the server
│   ├── plugins/
│   │   ├── v1-responses.ts  # Logic for handling /v1/responses → /v1/chat/completions
│   │   └── base-plugin.ts   # Base interface for plugins
│   ├── router.ts            # Loads available plugins and mounts them
│   └── config.ts            # Endpoint rules, timeouts, fallbacks
├── test/
│   └── contract.test.ts     # Sends mocks against each plugin version
├── package.json
└── README.md
