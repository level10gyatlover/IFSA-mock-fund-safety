# IFSA SVC Mock Fund — Source Code & Technical Handover

Prepared for IFSA SVC on 21 July 2026.

## 1. Current live application

| Item | Current information |
|---|---|
| Application | IFSA SVC Mock Fund |
| Live URL | https://ifsa-mock-fund.kaushal-achintya.chatgpt.site |
| Hosting | OpenAI Sites managed production hosting |
| Sites project ID | `appgprj_6a53d687dc648191932989a686540807` |
| Site slug | `ifsa-mock-fund` |
| Current deployed version | Version 8 |
| Source commit | `37d9f251004052e3d02618f1555da86fa79ac8fa` |
| Visitor access mode | Public URL, followed by the application's own username/password login |
| Database | Managed Cloudflare D1, SQLite-compatible |
| D1 binding name | `DB` |
| Object storage | Not used (`R2` is not configured) |

This is a serverless managed deployment. There is no VPS, SSH username, fixed IP address, cPanel account, or conventional server password to transfer.

## 2. Technology stack

| Layer | Technology |
|---|---|
| Front end | React 19, Next.js 16 application structure |
| Build/runtime adapter | Vinext 0.0.50 and Vite 8 |
| Server/API | TypeScript API routes running on an edge Worker runtime |
| Database | Cloudflare D1 |
| ORM/schema | Drizzle ORM and Drizzle Kit |
| Authentication | Application-managed username/password sessions |
| Password storage | PBKDF2-SHA-256 hashes with per-user salt; plaintext passwords are not stored |
| Styling | Custom responsive CSS using IFSA SVC branding assets |

## 3. Production environment variables

The live project currently uses the following environment keys:

| Key | Type | Current visible value |
|---|---|---|
| `BOOTSTRAP_ADMIN_USERNAME` | Normal environment variable | `admin` |
| `BOOTSTRAP_ADMIN_PASSWORD` | Secret | Hidden by the hosting platform |

The secret value cannot and should not be exported in source code. On a fresh deployment, set a new strong bootstrap password before the first login. The bootstrap variables create the initial administrator only when the database has no users; changing them later does not automatically reset an existing administrator password.

## 4. What is included in the source archive

- Complete application source under `app/`
- All API routes for authentication, portfolios, trading, market search, chat, watchlists, learning progress, recommendations and corporate actions
- Database schema and every migration under `db/` and `drizzle/`
- Portfolio and corporate-action engines under `lib/`
- Complete NSE/BSE instrument master currently bundled with the application
- IFSA SVC logo and branding assets under `public/`
- Build, validation and deployment configuration
- Locked dependencies in `package-lock.json`
- Tests and utility scripts
- `.openai/hosting.json`, which identifies the existing Sites project and the `DB` binding

The archive intentionally excludes:

- `node_modules`, build outputs and temporary caches
- Git credentials and short-lived hosting repository tokens
- Session cookies or bearer tokens
- The hidden production administrator password
- The contents of the live D1 database

The schema and migrations are included, but live users, passwords, portfolios, orders, watchlists, chats, recommendations and learning progress remain in the managed production database.

## 5. Local setup

Prerequisites:

- Node.js 22.13 or newer
- npm
- A Linux environment is recommended because the included build scripts use `flock` and GNU `timeout`

From the extracted source folder:

```bash
npm ci
npm run dev
```

Validation commands:

```bash
npm run lint
npm test
```

When the database schema changes:

```bash
npm run db:generate
```

Always inspect the generated SQL migration before deployment.

## 6. Giving another person genuine development access

There are three different permissions; they should not be confused:

1. **Dashboard user access** — the administrator creates a member username and password inside the dashboard. This permits use of the simulator only.
2. **Website visitor access** — the Sites access policy controls who can open the URL. It does not grant source-code editing rights.
3. **Developer/deployment access** — permits changing source, database schema, environment variables and production versions.

The current Sites access controls expose visitor permissions, not a separate collaborator/editor role for the source project. Therefore, merely adding someone to the website allowlist or giving them an admin dashboard account will not let them edit or deploy the application.

### Recommended long-term handover

1. Create a private GitHub or GitLab repository owned by the IFSA SVC organisation, not by an individual student.
2. Upload the extracted source archive as the initial repository.
3. Invite the required developers using their own accounts; do not share one password.
4. Protect the main branch and require pull-request review.
5. Keep production secrets in the hosting platform or a password manager, never in Git.
6. Either:
   - keep the existing Sites project and deploy through an account/workspace that has permission over this project; or
   - deploy a new organisation-owned instance on a platform that supports team collaborators, then migrate the D1 data and point an IFSA-owned domain to it.

If collaborators need to work independently without involving the current owner, the second route is the cleanest governance model: an organisation-owned source repository, organisation-controlled hosting and named user permissions.

## 7. Deploying another copy

For another OpenAI Sites deployment:

1. Remove or replace the existing `project_id` in `.openai/hosting.json` only when intentionally creating a separate Site.
2. Create a new managed D1 database binding named `DB`.
3. Apply all SQL migrations in `drizzle/` in numerical order.
4. Set `BOOTSTRAP_ADMIN_USERNAME` and a new secret `BOOTSTRAP_ADMIN_PASSWORD`.
5. Build and deploy the source.
6. Sign in once to create the initial administrator and flagship portfolio.

For Cloudflare Workers/Pages or another host, the application will require platform-specific deployment configuration. Preserve a D1-compatible database or adapt `db/index.ts` and the migrations to the chosen database.

## 8. Production governance checklist

- Keep at least two named maintainers.
- Store recovery information in an IFSA-controlled password manager.
- Use separate dashboard accounts; avoid sharing the administrator login.
- Back up the D1 database before schema or corporate-action changes.
- Test migrations on a copy before applying them to production.
- Do not publish the source repository if it later contains private research, member data or secrets.
- Treat free market-price and corporate-action feeds as fallible; keep the administrator verification workflow enabled.
- Document every production deployment and database migration.

## 9. Important limitation of this handover

The source archive gives full code ownership and is enough to build a separate instance. It does not itself transfer ownership of the existing managed Sites project or copy the live D1 data. Those are separate hosting and data-migration actions.
