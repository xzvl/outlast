/** @type {import('next').NextConfig} */
const extraDevOrigins = (process.env.NEXT_ALLOWED_DEV_ORIGINS || "")
  .split(",")
  .map((origin) => origin.trim())
  .filter(Boolean);

const nextConfig = {
  reactStrictMode: true,
  allowedDevOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000",
    "http://192.168.100.39:3000",
    "192.168.100.39",
    ...extraDevOrigins,
  ],
};

export default nextConfig;
