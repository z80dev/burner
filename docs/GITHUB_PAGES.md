# GitHub Pages setup (required once)

This repository deploys via GitHub Actions (see `.github/workflows/`).

**Manual step:** open **Settings → Pages → Source** and set it to **GitHub Actions**.

There is no authenticated Pages enable API available to this agent; the site will not publish until that setting is selected.

After enabling, each push to `main` should deploy to https://z80.wtf/burner (custom domain / base path as configured).
