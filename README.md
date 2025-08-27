# MCP Forward Auth

Express middleware for forward authentication using [mcp-oauth-proxy](https://github.com/obot-platform/mcp-oauth-proxy).

## Installation

```bash
npm install mcp-forward-auth
```

The package will automatically download the appropriate `mcp-oauth-proxy` binary for your platform during installation.

## Usage

### Basic Usage

```typescript
import express from 'express';
import { createForwardAuthMiddleware } from 'mcp-forward-auth';

const app = express();

// Apply forward auth middleware with required OAuth configuration
app.use(createForwardAuthMiddleware({
  oauth: {
    clientId: 'your-oauth-client-id',        // Required
    clientSecret: 'your-oauth-client-secret',
    encryptionKey: 'your-encryption-key',    // Required
    databaseDsn: 'sqlite:///tmp/auth.db',    // Optional
    authorizeUrl: 'https://accounts.google.com/oauth/authorize', // Optional
    scopesSupported: 'openid email profile' // Optional
  }
}));

// Your protected routes
app.get('/api/user', (req, res) => {
  // Access forwarded headers
  const user = req.headers['x-forwarded-user'];
  const email = req.headers['x-forwarded-email'];
  const name = req.headers['x-forwarded-name'];
  const token = req.headers['x-forwarded-access-token'];

  res.json({ user, email, name });
});

app.listen(3000);
```

### Advanced Configuration

```typescript
import { createForwardAuthMiddleware } from 'mcp-forward-auth';

const middleware = createForwardAuthMiddleware({
  proxyPort: 8080,        // Port for mcp-oauth-proxy (default: 8080)
  binaryPath: '/path/to/mcp-oauth-proxy', // Custom binary path
  timeout: 30000,         // Request timeout in ms (default: 30000)
  retryAttempts: 3,       // Retry attempts (default: 3)
  retryDelay: 1000,       // Delay between retries in ms (default: 1000)
  oauth: {                // OAuth configuration (required)
    clientId: 'your-oauth-client-id',        // Required
    clientSecret: 'your-oauth-client-secret',
    encryptionKey: 'your-32-char-encryption-key', // Required
    databaseDsn: 'postgresql://user:pass@localhost/auth', // Optional
    authorizeUrl: 'https://provider.com/oauth/authorize',  // Optional
    scopesSupported: 'openid email profile'               // Optional
  },
  env: {                  // Additional environment variables
    'CUSTOM_VAR': 'value'
  }
});

app.use(middleware);
```

### Using the Middleware Class

```typescript
import { ForwardAuthMiddleware } from 'mcp-forward-auth';

const authMiddleware = new ForwardAuthMiddleware({
  proxyPort: 8080
});

// Use the middleware
app.use(authMiddleware.middleware);

// Check proxy status
const status = authMiddleware.getProxyStatus();
console.log('Proxy PID:', status?.pid);

// Stop the proxy when shutting down
process.on('SIGTERM', () => {
  authMiddleware.stop();
});
```

## How It Works

1. **Binary Management**: The package automatically downloads and manages the `mcp-oauth-proxy` binary
2. **Request Interception**: Incoming requests are intercepted by the middleware
3. **Header Cleanup**: Removes any existing `Authorization` and `X-Forwarded-*` headers from the request
4. **OAuth Proxy**: Forwards the request to the local `mcp-oauth-proxy` instance
5. **Authentication**: The proxy handles OAuth flows and returns authentication headers
6. **Header Forwarding**: Adds the following headers to authenticated requests:
   - `X-Forwarded-User`: User identifier
   - `X-Forwarded-Email`: User email address
   - `X-Forwarded-Name`: User display name
   - `X-Forwarded-Access-Token`: OAuth access token

## Configuration

The middleware automatically configures the `mcp-oauth-proxy` binary with the following environment variables based on your OAuth configuration:

### Required Configuration
- `OAUTH_CLIENT_ID`: OAuth client ID (required)
- `ENCRYPTION_KEY`: 32-character encryption key for securing tokens (required)

### Optional Configuration
- `OAUTH_CLIENT_SECRET`: OAuth client secret
- `DATABASE_DSN`: Database connection string (defaults to in-memory if not provided)
- `OAUTH_AUTHORIZE_URL`: Custom OAuth authorization URL
- `SCOPES_SUPPORTED`: Space-separated list of OAuth scopes

### Additional Environment Variables
You can pass additional environment variables through the `env` configuration option.

See the [mcp-oauth-proxy documentation](https://github.com/obot-platform/mcp-oauth-proxy) for a complete list of configuration options.

## Binary Version

The binary version is controlled by the `mcpOauthProxyVersion` field in the package configuration. By default, it uses `"latest"` to always download the most recent release.

To pin to a specific version, you can configure it in your `package.json`:

```json
{
  "config": {
    "mcpOauthProxyVersion": "v1.0.0"
  }
}
```

## Security

- The middleware automatically removes any existing `Authorization` headers from incoming requests
- It strips any `X-Forwarded-*` headers that clients might try to spoof
- Authentication is handled entirely by the `mcp-oauth-proxy` binary
- Only authenticated requests receive the forwarded headers

## TypeScript Support

The package includes full TypeScript definitions:

```typescript
import { ForwardAuthConfig, ForwardedHeaders, ProxyProcess } from 'mcp-forward-auth';

const config: ForwardAuthConfig = {
  proxyPort: 8080,
  timeout: 15000
};
```

## Error Handling

The middleware handles various error conditions:

- Binary download failures (graceful degradation)
- Proxy startup failures (returns 500 with error details)
- Proxy health check failures (automatic retries)
- Network timeouts (configurable timeout and retry logic)

## License

MIT
