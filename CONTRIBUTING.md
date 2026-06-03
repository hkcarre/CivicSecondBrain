# Contributing

## Commits and Releases

This repo follows [Conventional Commits](https://www.conventionalcommits.org/). Every PR title
must conform — it becomes the squash-merge commit message on `main` and drives automated releases.

### Allowed types

| Type       | When to use                              | Version bump (pre-1.0)     |
|------------|------------------------------------------|----------------------------|
| `feat`     | New feature or capability                | MINOR (0.x → 0.x+1)       |
| `fix`      | Bug fix                                  | PATCH (0.x.y → 0.x.y+1)   |
| `docs`     | Documentation only                       | none                       |
| `refactor` | Code restructure, no behavior change     | none                       |
| `test`     | Add or fix tests                         | none                       |
| `chore`    | Maintenance, dependencies                | none                       |
| `perf`     | Performance improvement                  | PATCH                      |
| `ci`       | CI/CD changes                            | none                       |
| `style`    | Formatting, whitespace                   | none                       |
| `build`    | Build system changes                     | none                       |

Append `!` after the type for breaking changes: `feat!: drop support for Node 18`

### Good PR title examples ✅

```
feat: add streaming chat interface for council Q&A
fix(api): handle empty wiki index on first boot
chore: upgrade Anthropic SDK to latest
feat!: rename wiki operations from INGEST/QUERY to ingest/query
docs: add deployment guide for AWS Amplify
```

### Bad PR title examples ❌

```
fixed stuff              # no type prefix
Feature/new-dashboard    # branch name, not a commit message
WIP: auth changes        # not a Conventional Commits type
update code              # vague, no type
```

### How releases work

After a PR merges to `main`, release-please opens a Release PR within ~1 minute. Once all required
status checks pass on that PR, GitHub automatically squash-merges it — cutting the release,
tagging the version, and publishing the changelog. No manual merge step needed.
