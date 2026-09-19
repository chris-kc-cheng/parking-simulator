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
workflow can also be run manually from the **Actions** tab.

### One-time Pages setup

GitHub does not allow the workflow's built-in `GITHUB_TOKEN` to create a Pages
site because that operation requires repository-administration access. Before
the first deployment:

1. Create a fine-grained personal access token for this repository with
   **Administration: Read and write** permission.
2. In the repository, open **Settings → Secrets and variables → Actions**.
3. Add the token as a repository secret named `PAGES_ADMIN_TOKEN`.
4. Run **Deploy simulator to GitHub Pages** from the **Actions** tab.

The token is passed only to `actions/configure-pages` to enable the site. The
remaining build and deployment steps continue to use the restricted workflow
token. After the Pages site has been created, you may instead remove the
`enablement` and `token` inputs from the workflow and delete the secret.
