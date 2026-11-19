import type { NextConfig } from "next";

const config: NextConfig = {
  // Die Typprüfung läuft über `npm run typecheck`.
  typescript: { ignoreBuildErrors: true },
};

export default config;
