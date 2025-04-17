# openCodex Proxy

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
   git clone (https://github.com/TheonlyAquarius/openCodex/new/main)
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
