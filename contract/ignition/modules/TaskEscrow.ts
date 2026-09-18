import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const USDC_ADDRESS = process.env.USDC_ADDRESS;

const TaskEscrowModule = buildModule("TaskEscrowModule", (m) => {
  // We define a parameter that defaults to the environment variable or the zero address
  const usdc = m.getParameter("usdc", USDC_ADDRESS);

  // Deploy the TaskEscrow contract with the USDC address as the constructor argument
  const taskEscrow = m.contract("TaskEscrow", [usdc]);

  return { taskEscrow };
});

export default TaskEscrowModule;
