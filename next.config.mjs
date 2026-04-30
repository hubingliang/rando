import withPWAInit from "@ducanh2912/next-pwa"

/** @type {import('next').NextConfig} */
const nextConfig = {}

const withPWA = withPWAInit({
  dest: "public",
  disable: process.env.NODE_ENV === "development",
  register: true,
  skipWaiting: true,
  /** SPA shell: offline navigations fall back to home */
  fallbacks: {
    document: "/",
  },
  workboxOptions: {
    disableDevLogs: true,
  },
})

export default withPWA(nextConfig)
