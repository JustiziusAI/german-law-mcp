# German Law MCP

A thin, LLM-friendly remote MCP server for German federal legislation. It uses the public NeuRIS preview API as the legal source of truth, removes implementation identifiers from tool inputs, and returns compact source-linked results.

Live endpoints after deployment:

- `/mcp` Remote MCP over Streamable HTTP
- `/docs` Runtime-generated tool documentation
- `/openapi.json` Runtime API specification for the website API
- `/health` Deployment health and NeuRIS status
- `/` Marketing site
- `/login` Account area

## MCP tools

- `find_laws`: Find a law from its title, short title, or abbreviation.
- `get_law`: Get compact official law metadata and current validity.
- `search_legislation_text`: Search statutory text by keyword, optionally within one law.
- `list_norms`: List directly addressable norms in a law.
- `list_law_structure`: Return the hierarchy of parts, sections and norms.
- `get_norm`: Retrieve an official norm by human reference such as `law=FinVermV`, `norm=17`.
- `get_law_versions`: List available versions of a law.

## Source of truth and correctness

NeuRIS remains the source of truth. The Worker stores no legal corpus. It resolves human law references at request time, uses the requested `as_of` date for version choice, and preserves legal-force, validity, official title, publication and source URL metadata.

If one date resolves to more than one applicable expression, the response preserves all matching version candidates rather than presenting a silent arbitrary choice. Technical `eId` values are resolver internals and are never MCP inputs.

## Documentation

`src/tools/catalog.ts` is the single tool-contract source. MCP registrations, the public `/docs` page and `/api/spec` all use the same catalog. The test suite fails if the MCP server's list of tools differs from this catalog.

## Development

```sh
npm install
npm run dev
```

The launch configuration keeps the public MCP independent of a database. When account access is activated, create a D1 database, add its binding to `wrangler.jsonc`, then apply `migrations/0001_users.sql`.

For production, set `AUTH_SECRET` and optional `INVITE_CODE` with `wrangler secret put`. Registration stays closed unless `REGISTRATION_OPEN` is explicitly set to `true`, or a valid invite code is supplied.

## Deploy

```sh
npm run check
npm test
npm run deploy
```

To activate account login after a D1 binding exists: apply `migrations/0001_users.sql`, then set `AUTH_SECRET` and optional `INVITE_CODE` with `wrangler secret put`.

## Scope

This product provides official-source retrieval, not legal advice. NeuRIS is a preview service; the contract tests are intentionally small and the upstream adapter is isolated in `src/neuris/`.

License: MIT
