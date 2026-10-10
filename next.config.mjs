/** Katerbot — Next.js config */
/** @type {import('next').NextConfig} */
const nextConfig = {
  // mssql/tedious are Node-only; keep them out of the bundler.
  serverExternalPackages: ["mssql", "tedious"],
  eslint: { ignoreDuringBuilds: true },
};
export default nextConfig;
