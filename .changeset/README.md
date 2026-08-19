# Changesets

This directory holds release intents for pnpm 11's built-in release management.

```sh
pnpm change
```

That writes a `.changeset/*.md` file. Commit it with the change.

Merging to `main` runs `pnpm version -r` and publishes with npm OIDC. Do not add `@changesets/cli` or `changesets/action`.
