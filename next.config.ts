import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workspace root 명시 — 상위 디렉토리의 다른 lockfile 을 잘못 잡지 않도록.
  turbopack: {
    root: import.meta.dirname,
  },
};

export default nextConfig;
