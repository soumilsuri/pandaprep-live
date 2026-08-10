import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: [
      'lh3.googleusercontent.com', 
      'upload.wikimedia.org', 
      'github.githubassets.com', 
      'www.gstatic.com',
      'avatars.githubusercontent.com',
      "assets.aceternity.com",
    ],
  },
};

export default nextConfig;
