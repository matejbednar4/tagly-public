# Backend

Express API server. For architecture, patterns, and coding conventions, see [CLAUDE.md](CLAUDE.md).

## Commands

```bash
yarn dev                    # Development with hot reload
yarn build                  # Build for production
yarn prisma:generate        # Generate Prisma client
yarn prisma:migrate:deploy  # Run migrations
yarn db:types               # Regenerate Kysely types
yarn seed:dev               # Seed verticals, advertisers, subaccounts, notifications
yarn seed:dev:all           # Full seed (includes customers and admin)
```
