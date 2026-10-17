// Secrets set with `wrangler secret put` (not in wrangler.jsonc, so `wrangler types` doesn't see them).
interface McpSecrets {
  GITHUB_CLIENT_ID: string;
  GITHUB_CLIENT_SECRET: string;
}
interface Env extends McpSecrets {}
declare namespace Cloudflare {
  interface Env extends McpSecrets {}
}
