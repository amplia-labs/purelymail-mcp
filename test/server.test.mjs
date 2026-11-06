import assert from "node:assert/strict";
import { createServer as createHttpServer } from "node:http";
import { after, before, beforeEach, describe, it } from "node:test";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { PurelymailClient } from "../dist/client.js";
import { createServer } from "../dist/server.js";
import { tools } from "../dist/tools.js";

const TOKEN = "test-token";

let http;
let baseUrl;
let requests;
let reply;

before(async () => {
  http = createHttpServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      requests.push({
        method: req.method,
        url: req.url,
        token: req.headers["purelymail-api-token"],
        contentType: req.headers["content-type"],
        body: JSON.parse(body),
      });
      reply(res);
    });
  });
  await new Promise((resolve) => http.listen(0, "127.0.0.1", resolve));
  baseUrl = `http://127.0.0.1:${http.address().port}`;
});

after(() => http.close());

beforeEach(() => {
  requests = [];
  reply = json({ type: "success", result: {} });
});

function json(payload, status = 200) {
  return (res) => {
    res.writeHead(status, { "Content-Type": "application/json" });
    res.end(JSON.stringify(payload));
  };
}

async function connect({ readOnly = false, timeoutMs } = {}) {
  const purelymail = new PurelymailClient({ token: TOKEN, baseUrl, timeoutMs });
  const server = createServer({ client: purelymail, readOnly });
  const client = new Client({ name: "test", version: "0" });
  const [clientSide, serverSide] = InMemoryTransport.createLinkedPair();
  await Promise.all([server.connect(serverSide), client.connect(clientSide)]);
  return client;
}

async function assertRejectedBeforeApi(client, name, args) {
  const result = await client
    .callTool({ name, arguments: args })
    .catch((error) => ({ isError: true, content: [{ text: error.message }] }));
  assert.equal(result.isError, true);
  assert.equal(requests.length, 0);
}

describe("tool catalogue", () => {
  it("exposes all 19 API operations with unique names and paths", async () => {
    const client = await connect();
    const listed = (await client.listTools()).tools;
    assert.equal(listed.length, 19);
    assert.equal(new Set(tools.map((t) => t.path)).size, 19);
  });

  it("annotates tools by kind", async () => {
    const client = await connect();
    const byName = Object.fromEntries(
      (await client.listTools()).tools.map((t) => [t.name, t.annotations]),
    );
    assert.equal(byName.list_users.readOnlyHint, true);
    assert.equal(byName.list_users.destructiveHint, false);
    assert.equal(byName.create_user.readOnlyHint, false);
    assert.equal(byName.create_user.destructiveHint, false);
    assert.equal(byName.delete_domain.destructiveHint, true);
  });

  it("hides every non-read tool in read-only mode", async () => {
    const client = await connect({ readOnly: true });
    const names = (await client.listTools()).tools.map((t) => t.name).toSorted();
    assert.deepEqual(names, [
      "check_account_credit",
      "get_ownership_code",
      "get_user",
      "list_domains",
      "list_password_reset_methods",
      "list_routing_rules",
      "list_users",
    ]);
    await assertRejectedBeforeApi(client, "delete_domain", { name: "x.com" });
  });
});

describe("requests", () => {
  it("POSTs JSON with the token header to the tool's path", async () => {
    const client = await connect();
    await client.callTool({
      name: "get_user",
      arguments: { userName: "a@b.com" },
    });
    assert.deepEqual(requests, [
      {
        method: "POST",
        url: "/api/v0/getUser",
        token: TOKEN,
        contentType: "application/json",
        body: { userName: "a@b.com" },
      },
    ]);
  });

  it("sends an empty object for tools without arguments", async () => {
    reply = json({ type: "success", result: { users: ["a@b.com"] } });
    const client = await connect();
    const result = await client.callTool({ name: "list_users", arguments: {} });
    assert.deepEqual(requests[0].body, {});
    assert.deepEqual(JSON.parse(result.content[0].text), { users: ["a@b.com"] });
  });

  it("omits optional arguments that were not given", async () => {
    const client = await connect();
    await client.callTool({
      name: "update_domain_settings",
      arguments: { name: "b.com", recheckDns: true },
    });
    assert.deepEqual(requests[0].body, { name: "b.com", recheckDns: true });
  });

  it("allows an empty matchUser and passes routing fields through", async () => {
    const client = await connect();
    const args = {
      domainName: "b.com",
      prefix: true,
      matchUser: "",
      targetAddresses: ["c@d.com"],
      catchall: true,
    };
    const result = await client.callTool({
      name: "create_routing_rule",
      arguments: args,
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(requests[0].body, args);
  });

  it("rejects invalid input before reaching the API", async () => {
    const client = await connect();
    await assertRejectedBeforeApi(client, "delete_routing_rule", {
      routingRuleId: "12",
    });
  });
});

describe("responses", () => {
  it("reports an empty result as success", async () => {
    const client = await connect();
    const result = await client.callTool({
      name: "delete_user",
      arguments: { userName: "a@b.com" },
    });
    assert.equal(result.isError, undefined);
    assert.deepEqual(JSON.parse(result.content[0].text), { success: true });
  });

  it("accepts the bare `{result}` envelope from the spec", async () => {
    reply = json({ result: { credit: "1.50" } });
    const client = await connect();
    const result = await client.callTool({
      name: "check_account_credit",
      arguments: {},
    });
    assert.deepEqual(JSON.parse(result.content[0].text), { credit: "1.50" });
  });

  it("treats HTTP 200 with type=error as a failure", async () => {
    reply = json({
      type: "error",
      code: "invalidToken",
      message: "Token not valid.",
    });
    const client = await connect();
    const result = await client.callTool({
      name: "check_account_credit",
      arguments: {},
    });
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, "Purelymail API error (invalidToken): Token not valid.");
  });

  it("falls back to defaults when an error has non-string fields", async () => {
    reply = json({ type: "error", code: { a: 1 }, message: null });
    const client = await connect();
    const result = await client.callTool({ name: "list_users", arguments: {} });
    assert.equal(result.isError, true);
    assert.equal(result.content[0].text, "Purelymail API error (unknown): Unknown error");
  });

  it("fails on a non-2xx status even if the body has a result", async () => {
    reply = json({ result: {} }, 500);
    const client = await connect();
    const result = await client.callTool({ name: "list_users", arguments: {} });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /HTTP 500/);
  });

  it("fails on a body that is not JSON", async () => {
    reply = (res) => {
      res.writeHead(502, { "Content-Type": "text/html" });
      res.end("<html>Bad Gateway</html>");
    };
    const client = await connect();
    const result = await client.callTool({ name: "list_users", arguments: {} });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Non-JSON response .*HTTP 502/);
  });

  it("fails on JSON without a result", async () => {
    reply = json({ hello: "world" });
    const client = await connect();
    const result = await client.callTool({ name: "list_users", arguments: {} });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /Unexpected response/);
  });

  it("does not follow redirects", async () => {
    reply = (res) => {
      res.writeHead(302, { Location: `${baseUrl}/elsewhere` });
      res.end();
    };
    const client = await connect();
    const result = await client.callTool({ name: "list_users", arguments: {} });
    assert.equal(result.isError, true);
    assert.equal(requests.length, 1);
  });

  it("warns that a timed-out write may have been applied", async () => {
    reply = () => {};
    const client = await connect({ timeoutMs: 50 });
    const result = await client.callTool({
      name: "delete_user",
      arguments: { userName: "a@b.com" },
    });
    assert.equal(result.isError, true);
    assert.match(result.content[0].text, /may or may not have been applied/);
  });

  it("never exposes the token in errors", async () => {
    reply = json({ type: "error", code: "x", message: "nope" });
    const client = await connect();
    const result = await client.callTool({ name: "list_users", arguments: {} });
    assert.doesNotMatch(JSON.stringify(result), new RegExp(TOKEN));
  });
});
