import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // This app lives in a subfolder of the Majlis-Admin repo, which has its
  // own package-lock.json at the repo root -- without this, Turbopack finds
  // both lockfiles and guesses the wrong workspace root.
  turbopack: {
    root: path.join(__dirname),
  },
};

export default nextConfig;
