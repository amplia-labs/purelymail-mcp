# purelymail-mcp

MCP server for the [Purelymail API](https://news.purelymail.com/api/index.html).
It covers all 19 API operations: users, password reset methods, app passwords,
routing rules, domains and account credit.

## Usage

Requires Node.js 20 or later. There is nothing to install: MCP clients run the
package through `npx`.

| Variable               | Required | Description                                     |
| ---------------------- | -------- | ----------------------------------------------- |
| `PURELYMAIL_API_TOKEN` | yes      | API token from your Purelymail account settings |
| `PURELYMAIL_READ_ONLY` | no       | `true` or `1` exposes only the 7 read tools     |

### Claude Code

```bash
claude mcp add purelymail \
  -e PURELYMAIL_API_TOKEN=your-token \
  -- npx -y @amplia-labs/purelymail-mcp
```

### Other MCP clients

```json
{
  "mcpServers": {
    "purelymail": {
      "command": "npx",
      "args": ["-y", "@amplia-labs/purelymail-mcp"],
      "env": { "PURELYMAIL_API_TOKEN": "your-token" }
    }
  }
}
```

## Tools

| Area           | Read                                 | Write                                  | Destructive                                                    |
| -------------- | ------------------------------------ | -------------------------------------- | -------------------------------------------------------------- |
| Users          | `list_users`, `get_user`             | `create_user`                          | `modify_user`, `delete_user`                                   |
| Password reset | `list_password_reset_methods`        |                                        | `upsert_password_reset_method`, `delete_password_reset_method` |
| App passwords  |                                      | `create_app_password`                  | `delete_app_password`                                          |
| Routing        | `list_routing_rules`                 | `create_routing_rule`                  | `delete_routing_rule`                                          |
| Domains        | `list_domains`, `get_ownership_code` | `add_domain`, `update_domain_settings` | `delete_domain`                                                |
| Billing        | `check_account_credit`               |                                        |                                                                |

Tools carry the MCP annotations `readOnlyHint` and `destructiveHint`, which
clients can use to ask for confirmation.

## Security

- The token grants administrative access to the whole account. Use
  `PURELYMAIL_READ_ONLY=true` when you only need to look things up.
- `delete_domain` deletes the domain **and all of its users**.
- Passwords given to `create_user` and `modify_user`, and those returned by
  `create_app_password`, pass through the model's context and the MCP client's
  conversation history. Rotate any that are sensitive afterwards.

## API behavior

- Errors come back as **HTTP 200** with
  `{"type":"error","code":...,"message":...}`, which the spec does not document.
  The client inspects the response body and reports these as `isError`.
- `list_password_reset_methods` returns the methods under a key named `users`.
  That name comes from the API itself.
- `delete_password_reset_method` requires `target`, even though the spec marks it
  optional, because the spec does not say what happens without it.
- Requests are never retried automatically. After a timeout, check the current
  state before repeating a write.

## Development

```bash
git clone https://github.com/amplia-labs/purelymail-mcp.git
cd purelymail-mcp
npm install
npm run build
```

To run a local build from an MCP client, use
`node /path/to/purelymail-mcp/dist/index.js` as the command.

### Quality checks

```bash
npm run check
```

Runs these in order, stopping at the first failure:

| Command                | Tool                                                    | What it checks                                                                             |
| ---------------------- | ------------------------------------------------------- | ------------------------------------------------------------------------------------------ |
| `npx tsc --noEmit`     | TypeScript                                              | Types                                                                                      |
| `npm run lint`         | [oxlint](https://oxc.rs/docs/guide/usage/linter.html)   | `correctness`, `suspicious` and `perf` rules, with type-aware analysis; warnings also fail |
| `npm run format:check` | [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) | Formatting                                                                                 |
| `npm run knip`         | [knip](https://knip.dev)                                | Unused exports, files and dependencies                                                     |
| `npm run cpd`          | [jscpd](https://github.com/kucherenko/jscpd)            | Duplicated code in `src` and `test`, with zero tolerance                                   |
| `npm test`             | `node:test`                                             | Build and tests                                                                            |

To fix issues automatically, run `npm run lint:fix` and `npm run format`.

The tests use a fake HTTP server and never call the real API. The development
tools require Node.js 20.19 or later.

### Releasing

1. Update the version in `package.json` and in both `version` fields of
   `server.json`. A test fails if they disagree.
2. Run `npm publish`. It runs `npm run check` first.
3. Update the [MCP Registry](https://registry.modelcontextprotocol.io):

   ```bash
   mcp-publisher login github --token <token>
   mcp-publisher publish
   ```

   The token must be a personal access token with the `read:org` scope, from an
   owner of the `amplia-labs` organization. The interactive `mcp-publisher login
   github` flow [cannot publish to organization namespaces](https://github.com/modelcontextprotocol/registry/issues/1468).

## License

[MIT](LICENSE)
