// Temporary route for 3.17 — proves app-paths-manifest.json now syncs from
// the real `next build` output instead of a hardcoded list in deploy.yml.
// Delete after verifying this route returns 200 on prod without having
// touched deploy.yml's manifest step.
export default function TestManifestFixPage() {
  return <div>3.17 manifest sync test — if you can see this, it worked.</div>;
}
