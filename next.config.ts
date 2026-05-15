import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // workspace root 명시 — 상위 디렉토리의 다른 lockfile 을 잘못 잡지 않도록.
  turbopack: {
    root: import.meta.dirname,
  },
  // 손풀이 노트 PNG(base64 dataURL)를 OCR 서버 액션 인자로 전송한다.
  // 서버 액션 기본 body 한도는 1MB — 캡처 이미지가 그보다 크므로 상향.
  experimental: {
    serverActions: {
      bodySizeLimit: "8mb",
    },
  },
  // data/demo/*.json 은 readFileSync 동적 경로(data-loader.ts)라 Vercel
  // 파일 트레이싱이 누락할 수 있음 → 서버 함수 번들에 명시 포함 (런타임 ENOENT 방지).
  outputFileTracingIncludes: {
    "/*": ["./data/demo/**"],
  },
};

export default nextConfig;
