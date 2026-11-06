<div align="center">

# Purelymail MCP

**Manage your [Purelymail](https://purelymail.com) account from any MCP client**

[![npm version](https://img.shields.io/npm/v/@amplia-labs/purelymail-mcp?style=flat-square)](https://www.npmjs.com/package/@amplia-labs/purelymail-mcp)
[![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-3c873a?style=flat-square)](https://nodejs.org)
[![License](https://img.shields.io/badge/License-MIT-blue?style=flat-square)](LICENSE)

[Features](#features) • [Getting started](#getting-started) • [Configuration](#configuration) • [Tools](#tools) • [Security](#security) • [Development](#development)

</div>

An [MCP](https://modelcontextprotocol.io) server that gives AI assistants access to the [Purelymail API](https://news.purelymail.com/api/index.html). Ask for what you need in plain language, and let your assistant handle mailboxes, domains and routing for you:

> Which of my domains are failing DNS checks?

> Create `sales@example.com` and forward `hello@example.com` to it.

> How much account credit do I have left?

## Features

- **Full API coverage**: all 19 operations, across users, password reset methods, app passwords, routing rules, domains and billing.
- **Read-only mode**: expose only the 7 tools that cannot change anything.
- **Safety annotations**: tools are marked as read-only or destructive, so clients can ask for confirmation.
- **Reliable error reporting**: failures are detected from the response body, because the API reports them with HTTP 200.
- **Nothing to install**: MCP clients run the package through `npx`.

## Getting started

You need [Node.js](https://nodejs.org) 20 or later and an API token from your Purelymail account settings.

### Claude Code

```bash
claude mcp add purelymail \
  -e PURELYMAIL_API_TOKEN=your-token \
  -- npx -y @amplia-labs/purelymail-mcp
```

### Other MCP clients

Add the server to your client's MCP configuration:

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

> [!TIP]
> Trying it for the first time? Set `PURELYMAIL_READ_ONLY` to `true` and ask for your account credit. It confirms that everything works without changing your account.

## Configuration

| Variable               | Required | Description                                        |
| ---------------------- | -------- | -------------------------------------------------- |
| `PURELYMAIL_API_TOKEN` | Yes      | API token from your Purelymail account settings    |
| `PURELYMAIL_READ_ONLY` | No       | Set to `true` or `1` to expose only the read tools |

## Tools

| Area           | Read                                 | Write                                  | Destructive                                                    |
| -------------- | ------------------------------------ | -------------------------------------- | -------------------------------------------------------------- |
| Users          | `list_users`, `get_user`             | `create_user`                          | `modify_user`, `delete_user`                                   |
| Password reset | `list_password_reset_methods`        |                                        | `upsert_password_reset_method`, `delete_password_reset_method` |
| App passwords  |                                      | `create_app_password`                  | `delete_app_password`                                          |
| Routing        | `list_routing_rules`                 | `create_routing_rule`                  | `delete_routing_rule`                                          |
| Domains        | `list_domains`, `get_ownership_code` | `add_domain`, `update_domain_settings` | `delete_domain`                                                |
| Billing        | `check_account_credit`               |                                        |                                                                |

Tools that can lock someone out of an account, such as `modify_user`, are also marked as destructive.

### API notes

- `list_password_reset_methods` returns the methods under a key named `users`. That name comes from the API.
- `delete_password_reset_method` requires `target`, even though the API spec marks it as optional, because the spec does not say what happens without it.
- `delete_app_password` needs the full password, because the API cannot list app passwords.
- Requests are never retried automatically. After a timeout, check the current state before repeating a write.

## Security

> [!WARNING]
> The API token grants administrative access to your whole account. `delete_domain` deletes a domain **and all of its users**. Use read-only mode unless you need to make changes, and review destructive actions before approving them.

> [!IMPORTANT]
> Passwords given to `create_user` and `modify_user`, and those returned by `create_app_password`, pass through the model's context and your client's conversation history. Rotate any that are sensitive afterwards.

## Development

```bash
git clone https://github.com/amplia-labs/purelymail-mcp.git
cd purelymail-mcp
npm install
npm run build
```

To try a local build, use `node /path/to/purelymail-mcp/dist/index.js` as the command in your MCP client. Development tools require Node.js 20.19 or later.

| Command             | Description                                                   |
| ------------------- | ------------------------------------------------------------- |
| `npm run check`     | Runs types, linting, formatting, knip, jscpd, build and tests |
| `npm run lint:fix`  | Fixes linting issues                                          |
| `npm run format`    | Formats the code                                              |
| `npm run changeset` | Describes a change for the next release                       |

Tests use a fake HTTP server and never call the real API.

### Releasing

Releases are automated with [Changesets](https://changesets.dev):

1. Add a changeset to any pull request that changes the package.
2. After it merges, the [publish workflow](.github/workflows/publish.yml) opens a **Version Packages** pull request.
3. Merging that pull request runs all checks and publishes to npm through [trusted publishing](https://docs.npmjs.com/trusted-publishers), so no npm token is stored in the repository.
