'use client';

import React, { useState } from 'react';
import { ethers } from 'ethers';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useWallet, ARC_TESTNET_CHAIN_ID } from '../components/WalletProvider';
import {
  TASK_ESCROW_ABI,
  TASK_ESCROW_BYTECODE,
  TASK_ESCROW_ADDRESS,
  USDC_ADDRESS,
} from '../components/contracts';
import styles from './deploy.module.css';

export default function DeployEscrowPage() {
  const { account, connectWallet, switchToArcTestnet } = useWallet();
  const [usdcAddress, setUsdcAddress] = useState(USDC_ADDRESS);
  const [isDeploying, setIsDeploying] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [deployedAddress, setDeployedAddress] = useState<string | null>(null);
  const [deployTxHash, setDeployTxHash] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const handleDeploy = async () => {
    setError(null);
    setStatusMsg(null);

    if (!account) {
      await connectWallet();
      return;
    }

    if (typeof window === 'undefined' || !(window as any).ethereum) {
      setError("Please install MetaMask to deploy the contract.");
      return;
    }

    try {
      setIsDeploying(true);
      setStatusMsg("Checking network connection...");

      const provider = new ethers.BrowserProvider((window as any).ethereum);
      const network = await provider.getNetwork();

      if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
        setStatusMsg("Switching to Arc Testnet...");
        const switched = await switchToArcTestnet();
        if (!switched) {
          throw new Error("You must be on Arc Testnet (Chain ID 5042002) to deploy.");
        }
      }

      const signer = await provider.getSigner();

      setStatusMsg("Preparing TaskEscrow deployment transaction in your wallet...");
      const factory = new ethers.ContractFactory(TASK_ESCROW_ABI, TASK_ESCROW_BYTECODE, signer);

      const contract = await factory.deploy(usdcAddress.trim());
      const tx = contract.deploymentTransaction();

      if (tx) {
        setDeployTxHash(tx.hash);
        setStatusMsg(`Deploy transaction submitted (${tx.hash.slice(0, 10)}...). Waiting for Arc Testnet confirmation...`);
      }

      await contract.waitForDeployment();
      const targetAddress = await contract.getAddress();

      setDeployedAddress(targetAddress);
      setStatusMsg("Contract successfully deployed to Arc Testnet!");
    } catch (err: any) {
      console.error(err);
      setError(
        err.code === 4001 || err.message?.includes('rejected')
          ? "Deployment transaction rejected by user."
          : (err.reason || err.message || "Failed to deploy contract.")
      );
    } finally {
      setIsDeploying(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={styles.page}>
      <Navbar />

      <main className={styles.main}>
        <div className={styles.container}>
          <div className={styles.header}>
            <div className={styles.badge}>Arc Testnet Escrow</div>
            <h1 className={styles.title}>Deploy Updated TaskEscrow</h1>
            <p className={styles.subtitle}>
              Deploy the enhanced <code>TaskEscrow</code> contract with support for open task creation
              (<code>createTask(taskId, bounty)</code>) and on-chain worker assignment (<code>assignWorker(taskId, worker)</code>).
            </p>
          </div>

          <div className={styles.card}>
            <div className={styles.infoSection}>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Current Configured Contract:</span>
                <code className={styles.code}>{TASK_ESCROW_ADDRESS || 'Not set in .env'}</code>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>Target Network:</span>
                <span className={styles.networkBadge}>Arc Testnet (5042002)</span>
              </div>
              <div className={styles.infoRow}>
                <span className={styles.infoLabel}>USDC Token Address:</span>
                <input
                  type="text"
                  value={usdcAddress}
                  onChange={(e) => setUsdcAddress(e.target.value)}
                  className={styles.input}
                  placeholder="0x..."
                />
              </div>
            </div>

            {error && (
              <div className={styles.alertError}>
                <span>{error}</span>
              </div>
            )}

            {statusMsg && (
              <div className={styles.alertStatus}>
                <span className={styles.spinner} />
                <span>{statusMsg}</span>
              </div>
            )}

            {deployedAddress && (
              <div className={styles.successBox}>
                <div className={styles.successTitle}>Deployment Successful!</div>
                <p className={styles.successDesc}>
                  Your new TaskEscrow contract is active on Arc Testnet.
                </p>
                <div className={styles.addressBox}>
                  <code className={styles.deployedAddress}>{deployedAddress}</code>
                  <button
                    type="button"
                    onClick={() => copyToClipboard(deployedAddress)}
                    className={styles.copyBtn}
                  >
                    {copied ? "Copied!" : "Copy Address"}
                  </button>
                </div>

                <div className={styles.instructions}>
                  <p><strong>Next Step:</strong> Update your <code>.env</code> file with the new address:</p>
                  <pre className={styles.codeSnippet}>
{`CONTRACT_ADDRESS=${deployedAddress}`}
                  </pre>
                  <p className={styles.hint}>
                    Also update <code>NEXT_PUBLIC_CONTRACT_ADDRESS</code> or restart your dev server.
                  </p>
                </div>
              </div>
            )}

            {!deployedAddress && (
              <div className={styles.actionSection}>
                <button
                  type="button"
                  onClick={handleDeploy}
                  disabled={isDeploying}
                  className={styles.deployBtn}
                >
                  {isDeploying ? "Deploying via MetaMask..." : account ? "Deploy Contract to Arc Testnet" : "Connect Wallet & Deploy"}
                </button>
              </div>
            )}
          </div>

          <div className={styles.cliCard}>
            <h2 className={styles.cliTitle}>Alternative: Deploy via Hardhat CLI</h2>
            <p className={styles.cliDesc}>
              If you prefer using the terminal, ensure <code>PRIVATE_KEY</code> is set in your <code>.env</code> and run:
            </p>
            <pre className={styles.codeSnippet}>
npx hardhat ignition deploy ignition/modules/TaskEscrow.ts --network arcTestnet --deployment-id arc-escrow-v2
            </pre>
          </div>
        </div>
      </main>

      <Footer />
    </div>
  );
}
