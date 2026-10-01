import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

// The standard USDC token address on Arc testnet and mainnet
const USDC_ADDRESS_ARC = "0x3600000000000000000000000000000000000000";

export default buildModule("TaskEscrowModule", (m) => {
  // Use the native USDC address on Arc network as the default for the _usdc parameter
  const usdcAddress = m.getParameter("usdcAddress", USDC_ADDRESS_ARC);

  const taskEscrow = m.contract("TaskEscrow", [usdcAddress]);

  return { taskEscrow };
});
