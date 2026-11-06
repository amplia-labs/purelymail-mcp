#!/usr/bin/env node
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { PurelymailClient } from "./client.js";
import { createServer } from "./server.js";

const token = process.env.PURELYMAIL_API_TOKEN?.trim();
if (!token) {
  console.error(
    "PURELYMAIL_API_TOKEN is not set. Get your API token from your Purelymail account settings.",
  );
  process.exit(1);
}

const readOnly = ["1", "true"].includes(
  process.env.PURELYMAIL_READ_ONLY?.trim().toLowerCase() ?? "",
);

const server = createServer({ client: new PurelymailClient({ token }), readOnly });
await server.connect(new StdioServerTransport());
