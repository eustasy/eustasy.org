# eustasy.org

Static site for [eustasy](https://github.com/eustasy) — products, open-source
index, activity feed. Built with [Astro](https://astro.build/) on
[Bun](https://bun.sh/), deployed to Cloudflare Workers as static assets.

The activity feed, repo grid, and stats are sourced from the GitHub API by
scheduled GitHub Actions workflows that snapshot data into `src/data/*.json`.

## Local development

Requires Bun ≥ 1.2.

```sh
bun install
bun run dev          # http://localhost:4321
bun run build        # → dist/
bun run preview      # serve dist/ locally
```

## Project layout

```
src/
  layouts/SiteLayout.astro     # shared head, header, footer, theme toggle
  pages/
    index.astro                # homepage (hero, products, repos, activity, community)
    open-source.astro          # searchable repo index
  styles/                      # flexoki, reset, typography, button, badge, card, site
  data/
    repos.json                 # all repos — refreshed daily
    commits.json               # commit + release feed — refreshed every 2h
    discussions.json           # issue + discussion feed — refreshed every 2h
public/                        # favicon, robots.txt, brand marks
wrangler.toml                  # Cloudflare Workers config — serves dist/
scripts/
  lib/{github,events}.mjs      # shared API helpers
  fetch-{repos,commits,discussions}.mjs
.github/workflows/
  refresh-repos.yml            # daily 06:00 UTC
  refresh-commits.yml          # every 2h on the hour
  refresh-discussions.yml      # every 2h, 30min offset
  lockfile-check.yml           # bun.lock matches package.json
  dependabot-lockfile.yml      # regenerates bun.lock on Dependabot PRs
_legacy/                       # the old PHP site, kept for reference
```

## Updating data

Three independent fetch scripts pull from the GitHub API and write JSON. Each
runs on its own cron (see workflows above) and only commits when the JSON
actually changes. They never overwrite with empty results — if the API call
fails or returns nothing, the existing snapshot stays.

### Run a fetch locally

Needs a GitHub token with default `public_repo` read scope. Without a token
the scripts log a warning and no-op.

```sh
GITHUB_TOKEN=ghp_… bun run fetch:repos
GITHUB_TOKEN=ghp_… bun run fetch:commits
GITHUB_TOKEN=ghp_… bun run fetch:discussions
GITHUB_TOKEN=ghp_… bun run fetch:all
```

### Trigger a refresh in CI

Each refresh workflow has a `workflow_dispatch` trigger:

```sh
gh workflow run refresh-repos.yml
gh workflow run refresh-commits.yml
gh workflow run refresh-discussions.yml
```

The default `GITHUB_TOKEN` is sufficient — no extra secrets needed.

### What each script writes

| Script                  | Output                       | Cadence       | Source                       |
|-------------------------|------------------------------|---------------|------------------------------|
| `fetch-repos.mjs`       | `src/data/repos.json`        | daily 06:00 UTC | GraphQL `organization.repositories` over `eustasy` and `eustasy-archive` |
| `fetch-commits.mjs`     | `src/data/commits.json`      | every 2h, on the hour | REST `/orgs/*/events` — PushEvent + ReleaseEvent |
| `fetch-discussions.mjs` | `src/data/discussions.json`  | every 2h, 30min past | REST `/orgs/*/events` — IssuesEvent + PullRequestEvent + IssueCommentEvent |

Repos are classified by description prefix (`EOL:`, `DEPRECATED:`, `ALPHA:`)
and GitHub's `isArchived` flag. Languages map from `primaryLanguage` to a
small slug taxonomy (`css`, `js`, `php`, `python`, `bash`, `html`, `jq`,
`meta`). Repos whose name starts with `.` are treated as meta unless they're
`.ui`.

## Deployment

The site is a static-assets-only Cloudflare Worker. `wrangler.toml` points
the Worker at `./dist`; there's no Worker script.

Cloudflare's Git integration builds and deploys on every push to `cf-pages`,
including the data-refresh commits — that's how the snapshots reach the live
site. Build settings live in the Cloudflare dashboard, not in this repo.

To deploy by hand (needs Cloudflare credentials, e.g. `bunx wrangler login`):

```sh
bun run build
bunx wrangler deploy
```

## Adding a product, page, or section

- Static content (a new page): add `src/pages/whatever.astro` using
  `SiteLayout`.
- Featured repos on the homepage: edit the `FEATURED_NAMES` list in
  `src/pages/index.astro`. Names must match `name` in `repos.json`.
- Repos in the footer: edit `FOOTER_REPOS` in `src/layouts/SiteLayout.astro`.
  Versions and status badges come from `repos.json`.
- New repo classification rule: edit `classifyStatus` / `classifyLang` in
  `scripts/lib/github.mjs`.
- New activity event type: extend `fromX` cases in `scripts/fetch-commits.mjs`
  or `scripts/fetch-discussions.mjs`.

## Theming

Flexoki tokens live in `src/styles/flexoki.css`. The accent colour and
density are global CSS custom properties (`--site-accent`,
`--site-accent-bg`, `--site-density`) defined in `src/styles/site.css`. The
open-source page overrides the accent to orange via a `body[data-screen-label]`
selector — easy to mirror for other pages.

Theme toggle persists choice in `localStorage` under `eustasy-theme`. The
inline script in `SiteLayout.astro` runs before paint to avoid a flash.

## Licence

MIT — see `LICENSE.md`.
