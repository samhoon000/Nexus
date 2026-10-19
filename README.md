# NEXUS

A futuristic third-person 3D platforming prototype built with Three.js, Vite and TypeScript.
Five stages, exploration and movement, no combat. Desktop browser, keyboard + mouse.

## Run

```bash
npm install
npm run dev        # http://127.0.0.1:5188
```

Controls: `WASD` move · mouse look (click the view to lock the pointer) · `Space` jump, press again
in the air to double jump · `Esc` pause. Arrow keys also rotate the camera.

## Build

```bash
npm run build      # dist/
npm run preview    # http://127.0.0.1:4188
```

The build is static; deploy `dist/` to any static host. The Vite `base` comes from the `VITE_BASE`
environment variable (default `/`).

## Deploy (GitHub Pages)

`.github/workflows/deploy.yml` builds and deploys on every push to `main` (and on manual dispatch).
It sets `VITE_BASE=/<repo>/` automatically (or `/` for a `<user>.github.io` repository). In the
repository settings, under **Pages → Build and deployment**, choose **Source: GitHub Actions**.
The site is served at `https://<user>.github.io/<repo>/`.

To test a sub-path build locally:

```bash
VITE_BASE=/my-repo/ npm run build && VITE_BASE=/my-repo/ npm run preview   # then open http://127.0.0.1:4188/my-repo/
```
(In Git Bash on Windows prefix the commands with `MSYS_NO_PATHCONV=1`.)

## Verify

```bash
npm run typecheck
npm run test:desktop      # Playwright suite (needs: npx playwright install chromium)
npm run bot -- all        # scripted traversal of every stage's platform chain
npm run check:gravity     # gravity zones, teleporters, rotating platforms, hazards
npm run inspect:canvas -- --manifest artifacts/evidence.json --url http://127.0.0.1:5188 --seed 42
```

Debug tools: open `http://127.0.0.1:5188/?debug` (live tuning, diagnostics overlay, stage shortcuts).
`?stage=N` starts directly in a stage during development.

## Docs

- `docs/GAME_DESIGN.md` — design brief, stage plans, feel targets
- `docs/ARCHITECTURE.md` — modules, update order, collision model, render pipeline
- `docs/DEVELOPMENT_PLAN.md` — phases, skill routing, testing strategy
- `artifacts/final-evidence.md` — verification evidence for the current revision
