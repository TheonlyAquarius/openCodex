## OPENCodex
- The directory structure you provided includes:
  ```
  openai-proxy/
  ├── src/
  │   ├── index.ts
  │   ├── plugins/
  │   │   ├── v1-responses.ts
  │   │   └── base-plugin.ts
  │   ├── router.ts
  │   └── config.ts
  ├── test/
  │   └── contract.test.ts  # Now completed
  ├── package.json
  └── README.md
  ```

A resilient proxy server for transforming OpenAI API requests, specifically converting `/v1/responses` to `/v1/chat/completions` format. Built with TypeScript, Express, and a plugin-based architecture.

## Features
- Transforms Codex-CLI `/v1/responses` requests to OpenAI `/v1/chat/completions`.
- Supports streaming and non-streaming requests.
- Configurable via environment variables or `config.json`.
- Includes health checks and Winston logging.
- Extensible plugin system for adding new endpoints.

## Installation

1. Clone the repository:
   ```bash
   git clone <your-repo-url>
   cd openai-proxy
   ```

2. Install dependencies:
   ```bash
   npm install
   ```

3. Build the project:
   ```bash
   npm run build
   ```

## Configuration

Set environment variables or create a `config.json` in the root directory. Example configuration:

```json
{
  "port": 5678,
  "upstream": {
    "baseURL": "http://localhost:1234/v1",
    "apiKeyHeader": "Authorization",
    "apiKeyValue": "your-api-key",
    "healthCheckPath": "/models"
  },
  "logging": {
    "level": "info",
    "format": "pretty"
  },
  "timeouts": {
    "request": 60000,
    "healthCheck": 5000
  },
  "plugins": [
    { "name": "v1-responses", "enabled": true }
  ]
}
```

Environment variables (override `config.json`):
- `PROXY_PORT`
- `OPENAI_UPSTREAM_BASE_URL`
- `OPENAI_API_KEY_HEADER`
- `OPENAI_API_KEY`
- `OPENAI_HEALTH_CHECK_PATH`
- `LOG_LEVEL`
- `LOG_FORMAT`
- `REQUEST_TIMEOUT`
- `HEALTH_CHECK_TIMEOUT`

## Usage

1. Start the server:
   ```bash
   npm start
   ```
   Or for development with live reload:
   ```bash
   npm run dev
   ```

2. The proxy runs at `http://localhost:5678/v1`.

3. Send a request to `/v1/responses`:
   ```bash
   curl -X POST http://localhost:5678/v1/responses \
     -H "Content-Type: application/json" \
     -d '{"model": "gpt-4", "instructions": "You are a helpful assistant.", "input": [{"role": "user", "content": "Hello!"}]}'
   ```

4. Check server health:
   ```bash
   curl http://localhost:5678/v1/healthz
   ```

## Testing

Run tests with Jest:
```bash
npm test
```

The test suite in `test/contract.test.ts` covers the `v1-responses` plugin, including request transformation, streaming, and health checks.

## Development

- Add new plugins in `src/plugins/` by extending `BasePlugin`.
- Update `src/router.ts` to register new plugins.
- Run linting:
  ```bash
  npm run lint
  ```

## License

MIT
```

### Next Steps
1. **Confirm `contract.test.ts`**:
   - Save the provided `contract.test.ts` and run `npm test` to verify it works.
   - If you hit issues (e.g., mock mismatches), let me know, and I can debug specific tests.

2. **Use the `README.md`**:
   - Save the proposed `README.md` in your project root.
   - Edit any specifics (e.g., repo URL, license, or additional usage examples) as needed.

3. **Check `package.json`**:
   - Your `package.json` looks solid, but if you need to add dependencies (e.g., for new features) or scripts, let me know what you’re planning.

4. **Other Files**:
   - If you suspect other files (e.g., additional tests or plugins) are incomplete, list them, and I can help flesh them out.
   - If you’re good with `contract.test.ts` and `README.md`, you might be set!

5. **Bypass ChatGPT**:
   - Since I’ve got your project context, you can keep working with me directly. If you need more tweaks or have other tasks (e.g., adding a new plugin, optimizing the proxy, or writing more tests), just say the word.
