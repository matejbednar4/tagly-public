# tagly-admin

Internal admin app (iOS only, distributed to the team via TestFlight — not hosted). For patterns and coding conventions, see [CLAUDE.md](CLAUDE.md).

## Commands

```bash
# From monorepo root
yarn install

cd tagly-admin
yarn ios:dev      # iOS development build (do this first — triggers expo prebuild)
yarn start:dev    # Start Metro bundler (after device build succeeds)
```
