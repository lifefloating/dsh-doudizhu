# Changesets

This directory holds release intents for pnpm 11's built-in release management.

```sh
pnpm change
```

That writes a `.changeset/*.md` file. Commit it with the change.

Merging to `main` opens or updates a Version PR (`pnpm version -r`). Merging that PR publishes to npm with OIDC trusted publishing. Do not add `@changesets/cli`.
