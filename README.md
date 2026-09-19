# Parking Simulator

An interactive, browser-based driving simulator for practicing reverse, front-in,
and parallel parking from a multi-view cockpit.

## Run the simulator

**[Launch Parking Simulator](https://chris-kc-cheng.github.io/parking-simulator/)**

Use the arrow keys or the on-screen controls to steer and move. You can also
select `P`, `R`, `N`, or `D` from the dashboard, switch lessons, hide or restore
the backup and bird's-eye cameras, and tune the view settings.

## Local development

```bash
npm run dev
```

Then open <http://localhost:4173>.

## Deployment

Every push to `main` publishes the latest static build to GitHub Pages. The
workflow can also be run manually from the **Actions** tab. On its first run,
the workflow enables GitHub Pages for the repository automatically, so no
separate Pages source configuration is required.
