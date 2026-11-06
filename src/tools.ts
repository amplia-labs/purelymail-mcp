import { z } from "zod";

/**
 * - `read`: no side effects; the only kind exposed in read-only mode.
 * - `write`: adds or updates without losing anything.
 * - `destructive`: removes data or can lock someone out of an account.
 */
type ToolKind = "read" | "write" | "destructive";

export interface ToolDefinition {
  name: string;
  title: string;
  description: string;
  path: string;
  kind: ToolKind;
  inputSchema: z.ZodRawShape;
}

const fullUserName = z.string().min(1).describe('Full username, e.g. "user@domain.com"');

export const tools: ToolDefinition[] = [
  // Users
  {
    name: "list_users",
    title: "List users",
    description: "Lists all users under the account (up to 1000).",
    path: "/api/v0/listUser",
    kind: "read",
    inputSchema: {},
  },
  {
    name: "get_user",
    title: "Get user",
    description:
      "Retrieves a user's settings: search indexing, recovery, 2FA requirement, spam filtering and password reset methods.",
    path: "/api/v0/getUser",
    kind: "read",
    inputSchema: { userName: fullUserName },
  },
  {
    name: "create_user",
    title: "Create user",
    description: "Creates a new mailbox user on a domain.",
    path: "/api/v0/createUser",
    kind: "write",
    inputSchema: {
      userName: z.string().min(1).describe('Local part only, e.g. "user" in "user@domain.com"'),
      domainName: z.string().min(1),
      password: z.string().min(1),
      enablePasswordReset: z.boolean().optional().describe("Defaults to true"),
      recoveryEmail: z.string().optional(),
      recoveryEmailDescription: z.string().optional(),
      recoveryPhone: z.string().optional(),
      recoveryPhoneDescription: z.string().optional(),
      enableSearchIndexing: z.boolean().optional().describe("Defaults to true"),
      sendWelcomeEmail: z.boolean().optional().describe("Defaults to true"),
    },
  },
  {
    name: "modify_user",
    title: "Modify user",
    description:
      "Changes a user's address, password or settings. Only the fields provided are changed.",
    path: "/api/v0/modifyUser",
    kind: "destructive",
    inputSchema: {
      userName: fullUserName,
      newUserName: z
        .string()
        .min(1)
        .optional()
        .describe('Full new username, e.g. "user@domain.com"'),
      newPassword: z.string().min(1).optional(),
      enableSearchIndexing: z
        .boolean()
        .optional()
        .describe("Indexes may take some time to be created after enabling."),
      enablePasswordReset: z
        .boolean()
        .optional()
        .describe("Whether this user can have their password reset."),
      requireTwoFactorAuthentication: z
        .boolean()
        .optional()
        .describe("Whether this user requires 2FA for login."),
    },
  },
  {
    name: "delete_user",
    title: "Delete user",
    description: "Permanently deletes a user.",
    path: "/api/v0/deleteUser",
    kind: "destructive",
    inputSchema: { userName: fullUserName },
  },

  // Password reset methods
  {
    name: "list_password_reset_methods",
    title: "List password reset methods",
    description:
      "Lists a user's password reset methods. The API returns them under a key named `users`.",
    path: "/api/v0/listPasswordReset",
    kind: "read",
    inputSchema: { userName: fullUserName },
  },
  {
    name: "upsert_password_reset_method",
    title: "Create or update password reset method",
    description:
      "Creates a password reset method, or updates an existing one when existingTarget is given. A reset method can take over the account, so make sure the target belongs to the user.",
    path: "/api/v0/upsertPasswordReset",
    kind: "destructive",
    inputSchema: {
      userName: fullUserName,
      existingTarget: z
        .string()
        .optional()
        .describe(
          "Target from list_password_reset_methods. If provided, updates the method matching it instead of creating a new one.",
        ),
      type: z.enum(["email", "phone"]),
      target: z.string().min(1).describe("Email address or phone number"),
      description: z.string().optional().describe("Human-readable description"),
      allowMfaReset: z
        .boolean()
        .optional()
        .describe("Whether this method can reset the user's MFA as well. Defaults to true."),
    },
  },
  {
    name: "delete_password_reset_method",
    title: "Delete password reset method",
    description: "Deletes one of a user's password reset methods.",
    path: "/api/v0/deletePasswordReset",
    kind: "destructive",
    inputSchema: {
      userName: fullUserName,
      // Optional in the API spec, which does not say what omitting it does.
      // Required here so a delete always names what it removes.
      target: z.string().min(1).describe("Target from list_password_reset_methods"),
    },
  },

  // App passwords
  {
    name: "create_app_password",
    title: "Create app password",
    description:
      "Creates an app password for a user and returns it. The result is a credential: show it to the user once and do not store or repeat it.",
    path: "/api/v0/createAppPassword",
    kind: "write",
    inputSchema: {
      userHandle: fullUserName,
      name: z.string().optional().describe("Optional friendly description"),
    },
  },
  {
    name: "delete_app_password",
    title: "Delete app password",
    description:
      "Deletes an app password. Requires the full password value; the API has no way to list them.",
    path: "/api/v0/deleteAppPassword",
    kind: "destructive",
    inputSchema: {
      userName: fullUserName,
      appPassword: z.string().min(1).describe("Full app password"),
    },
  },

  // Routing
  {
    name: "list_routing_rules",
    title: "List routing rules",
    description: "Lists all routing rules active under the account.",
    path: "/api/v0/listRoutingRules",
    kind: "read",
    inputSchema: {},
  },
  {
    name: "create_routing_rule",
    title: "Create routing rule",
    description:
      "Creates a routing rule for a domain. It must not have the same user/prefix as another rule on that domain.",
    path: "/api/v0/createRoutingRule",
    kind: "write",
    inputSchema: {
      domainName: z.string().min(1),
      prefix: z.boolean().describe("Whether matchUser is matched as a prefix of the local part"),
      matchUser: z.string().describe('Local part to match, i.e. "user" in "user@domain.org"'),
      targetAddresses: z
        .array(z.string().min(1))
        .min(1)
        .describe("Full email addresses this mail will be rerouted to"),
      catchall: z
        .boolean()
        .optional()
        .describe(
          "Whether this rule will not fire if the address maps to a user. Defaults to false.",
        ),
    },
  },
  {
    name: "delete_routing_rule",
    title: "Delete routing rule",
    description: "Deletes a routing rule.",
    path: "/api/v0/deleteRoutingRule",
    kind: "destructive",
    inputSchema: {
      routingRuleId: z.number().int().describe("Rule id from list_routing_rules"),
    },
  },

  // Domains
  {
    name: "list_domains",
    title: "List domains",
    description:
      "Lists domains accessible to the account, with their settings and a DNS summary (MX, SPF, DKIM, DMARC).",
    path: "/api/v0/listDomains",
    kind: "read",
    inputSchema: {
      includeShared: z
        .boolean()
        .optional()
        .describe("Whether to include Purelymail shared domains. Defaults to false."),
    },
  },
  {
    name: "get_ownership_code",
    title: "Get ownership code",
    description:
      "Gets the value of the DNS ownership proof record required before add_domain will succeed.",
    path: "/api/v0/getOwnershipCode",
    kind: "read",
    inputSchema: {},
  },
  {
    name: "add_domain",
    title: "Add domain",
    description: "Adds a domain, provided it passes DNS checks. See get_ownership_code.",
    path: "/api/v0/addDomain",
    kind: "write",
    inputSchema: { domainName: z.string().min(1) },
  },
  {
    name: "update_domain_settings",
    title: "Update domain settings",
    description:
      "Updates settings of an owned domain, and can trigger a DNS recheck. Only the fields provided are changed.",
    path: "/api/v0/updateDomainSettings",
    kind: "write",
    inputSchema: {
      name: z.string().min(1).describe("Domain name"),
      allowAccountReset: z
        .boolean()
        .optional()
        .describe("Whether this domain can be used to reset an account's password"),
      symbolicSubaddressing: z
        .boolean()
        .optional()
        .describe("Whether symbolic subaddressing is enabled on this domain"),
      recheckDns: z.boolean().optional().describe("Defaults to false"),
    },
  },
  {
    name: "delete_domain",
    title: "Delete domain",
    description:
      "Permanently deletes a domain AND all of its dependent settings and users. Confirm with the user first, listing what will be lost.",
    path: "/api/v0/deleteDomain",
    kind: "destructive",
    inputSchema: { name: z.string().min(1).describe("Domain name") },
  },

  // Billing
  {
    name: "check_account_credit",
    title: "Check account credit",
    description:
      "Returns the current account credit as a decimal string with up to 64 digits of precision.",
    path: "/api/v0/checkAccountCredit",
    kind: "read",
    inputSchema: {},
  },
];
