import hardhatToolboxMochaEthersPlugin from "@nomicfoundation/hardhat-toolbox-mocha-ethers";
import hardhatEthersPlugin from "@nomicfoundation/hardhat-ethers";
import * as dotenv from "dotenv";
import { configVariable, defineConfig } from "hardhat/config";

dotenv.config({ path: "../.env" });

export default defineConfig({
  plugins: [hardhatToolboxMochaEthersPlugin, hardhatEthersPlugin],
  solidity: {
    profiles: {
      default: {
        version: "0.8.34",
      },
      production: {
        version: "0.8.34",
        settings: {
          optimizer: {
            enabled: true,
            runs: 200,
          },
        },
      },
    },
  },
  networks: {
    arc: {
      type: "http",
      chainId: 5042,
      url: process.env.ARC_RPC_URL || "https://rpc.mainnet.arc.io",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
    arcTestnet: {
      type: "http",
      chainId: 5042002,
      url: process.env.ARC_TESTNET_RPC_URL || "https://arc-testnet.drpc.org",
      accounts: process.env.PRIVATE_KEY ? [process.env.PRIVATE_KEY] : [],
    },
  },
});
