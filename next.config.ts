import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  allowedDevOrigins: ["192.168.1.5"],
  env: {
    NEXT_PUBLIC_CONTRACT_ADDRESS: process.env.CONTRACT_ADDRESS,
    NEXT_PUBLIC_USDC_ADDRESS: process.env.USDC_ADDRESS,
    NEXT_PUBLIC_ARC_TESTNET_RPC_URL: process.env.ARC_TESTNET_RPC_URL,
  },
};

export default nextConfig;
