# purelymail-mcp

Servidor MCP para a [API do Purelymail](https://news.purelymail.com/api/index.html).
Cobre as 19 operações da API: usuários, métodos de reset de senha, senhas de app,
regras de roteamento, domínios e crédito da conta.

## Instalação

Requer Node.js 20 ou superior.

```bash
git clone https://github.com/amplia-labs/purelymail-mcp.git
cd purelymail-mcp
npm install
npm run build
```

## Configuração

| Variável               | Obrigatória | Descrição                                                  |
| ---------------------- | ----------- | ---------------------------------------------------------- |
| `PURELYMAIL_API_TOKEN` | sim         | Token da API, obtido nas configurações da conta Purelymail |
| `PURELYMAIL_READ_ONLY` | não         | `true` ou `1` expõe só os 7 tools de leitura               |

### Claude Code

```bash
claude mcp add purelymail \
  -e PURELYMAIL_API_TOKEN=seu-token \
  -- node /caminho/para/purelymail-mcp/dist/index.js
```

### Outros clientes MCP

```json
{
  "mcpServers": {
    "purelymail": {
      "command": "node",
      "args": ["/caminho/para/purelymail-mcp/dist/index.js"],
      "env": { "PURELYMAIL_API_TOKEN": "seu-token" }
    }
  }
}
```

## Tools

| Área           | Leitura                              | Escrita                                | Destrutivo                                                     |
| -------------- | ------------------------------------ | -------------------------------------- | -------------------------------------------------------------- |
| Usuários       | `list_users`, `get_user`             | `create_user`                          | `modify_user`, `delete_user`                                   |
| Reset de senha | `list_password_reset_methods`        |                                        | `upsert_password_reset_method`, `delete_password_reset_method` |
| Senhas de app  |                                      | `create_app_password`                  | `delete_app_password`                                          |
| Roteamento     | `list_routing_rules`                 | `create_routing_rule`                  | `delete_routing_rule`                                          |
| Domínios       | `list_domains`, `get_ownership_code` | `add_domain`, `update_domain_settings` | `delete_domain`                                                |
| Cobrança       | `check_account_credit`               |                                        |                                                                |

Os tools levam as anotações MCP `readOnlyHint` e `destructiveHint`, que os
clientes podem usar para pedir confirmação.

## Segurança

- O token dá acesso administrativo à conta inteira. Use `PURELYMAIL_READ_ONLY=true`
  quando só precisar consultar.
- `delete_domain` apaga o domínio **e todos os usuários** dele.
- Senhas passadas a `create_user` e `modify_user`, e as senhas devolvidas por
  `create_app_password`, passam pelo contexto do modelo e pelo histórico da
  conversa do cliente MCP. Troque depois as que forem sensíveis.

## Comportamento da API

- Erros voltam com **HTTP 200** e `{"type":"error","code":...,"message":...}`,
  algo que a spec não documenta. O cliente verifica o corpo da resposta e devolve
  esses casos como `isError`.
- `list_password_reset_methods` devolve os métodos numa chave chamada `users`.
  O nome vem da própria API.
- `delete_password_reset_method` exige `target`, embora a spec o trate como
  opcional, porque ela não diz o que acontece sem ele.
- Não há repetição automática de requisições. Depois de um timeout, confira o
  estado antes de repetir uma escrita.

## Qualidade

```bash
npm run check
```

Roda em sequência, parando na primeira falha:

| Comando                | Ferramenta                                              | O que verifica                                                                            |
| ---------------------- | ------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| `npx tsc --noEmit`     | TypeScript                                              | Tipos                                                                                     |
| `npm run lint`         | [oxlint](https://oxc.rs/docs/guide/usage/linter.html)   | Regras `correctness`, `suspicious` e `perf`, com análise de tipos; avisos também reprovam |
| `npm run format:check` | [oxfmt](https://oxc.rs/docs/guide/usage/formatter.html) | Formatação                                                                                |
| `npm run knip`         | [knip](https://knip.dev)                                | Exports, arquivos e dependências sem uso                                                  |
| `npm run cpd`          | [jscpd](https://github.com/kucherenko/jscpd)            | Código duplicado em `src` e `test`, com tolerância zero                                   |
| `npm test`             | `node:test`                                             | Build e testes                                                                            |

Para corrigir automaticamente, use `npm run lint:fix` e `npm run format`.

Os testes usam um servidor HTTP falso e não chamam a API real. As ferramentas de
desenvolvimento exigem Node.js 20.19 ou superior.
