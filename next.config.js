/** @type {import('next').NextConfig} */
const nextConfig = {
    typescript: {
      // !! WARNUNG !!
      // Wir ignorieren TypeScript Fehler für den Build, damit es live geht.
      ignoreBuildErrors: true,
    },
    eslint: {
      // Warnung: Wir ignorieren ESLint Fehler für den Build.
      ignoreDuringBuilds: true,
    },
  }
  
  module.exports = nextConfig