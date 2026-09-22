'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import {
  authWallet,
  requestAuthChallenge,
  verifyWalletSignature,
  getAuthToken,
  setAuthToken,
  User,
} from './api';

export const ARC_TESTNET_CHAIN_ID = 5042002;
export const ARC_TESTNET_HEX_CHAIN_ID = '0x4cef52';

export const ARC_TESTNET_PARAMS = {
  chainId: ARC_TESTNET_HEX_CHAIN_ID,
  chainName: 'Arc Testnet',
  nativeCurrency: {
    name: 'Arc',
    symbol: 'ARC',
    decimals: 18,
  },
  rpcUrls: ['https://arc-testnet.drpc.org'],
  blockExplorerUrls: ['https://explorer.testnet.arc.io'],
};

export {
  TASK_ESCROW_ADDRESS,
  USDC_ADDRESS,
  ARC_TESTNET_RPC_URL,
} from './contracts/TaskEscrowArtifact';

interface WalletContextType {
  account: string | null;
  user: User | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToArcTestnet: () => Promise<boolean>;
  isCorrectNetwork: boolean;
  isLoading: boolean;
  chainId: number | null;
}

const WalletContext = createContext<WalletContextType>({
  account: null,
  user: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  switchToArcTestnet: async () => false,
  isCorrectNetwork: false,
  isLoading: false,
  chainId: null,
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isCorrectNetwork, setIsCorrectNetwork] = useState<boolean>(false);
  const [chainId, setChainId] = useState<number | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const verifyIsArcTestnet = async (ethereumObj?: any): Promise<boolean> => {
    const eth = ethereumObj || (typeof window !== 'undefined' ? (window as any).ethereum : null);
    if (!eth) return false;
    try {
      const hexId = await eth.request({ method: 'eth_chainId' });
      const numId = typeof hexId === 'string' && hexId.startsWith('0x') ? parseInt(hexId, 16) : Number(hexId);
      setChainId(numId);
      const isArc = numId === ARC_TESTNET_CHAIN_ID;
      setIsCorrectNetwork(isArc);
      return isArc;
    } catch (err) {
      console.warn("Could not query eth_chainId:", err);
      return false;
    }
  };

  const switchToArcTestnet = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert("Please install a Web3 wallet like MetaMask.");
      return false;
    }

    const eth = (window as any).ethereum;

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_TESTNET_HEX_CHAIN_ID }],
      });
      return await verifyIsArcTestnet(eth);
    } catch (switchError: any) {
      // 4902 error code indicates the chain has not been added to MetaMask
      if (
        switchError.code === 4902 ||
        switchError?.data?.originalError?.code === 4902 ||
        switchError.message?.includes('4902') ||
        switchError.message?.includes('Unrecognized chain')
      ) {
        try {
          await eth.request({
            method: 'wallet_addEthereumChain',
            params: [ARC_TESTNET_PARAMS],
          });
          return await verifyIsArcTestnet(eth);
        } catch (addError) {
          console.error("Failed to add Arc Testnet to wallet:", addError);
          return false;
        }
      }
      console.warn("User rejected network switch to Arc Testnet:", switchError);
      return false;
    }
  };

  const authenticateWithSignature = async (address: string, provider: ethers.BrowserProvider) => {
    try {
      // Verify network is strictly Arc Testnet before prompting signature
      const network = await provider.getNetwork();
      if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
        setIsCorrectNetwork(false);
        disconnectWallet();
        alert("Wallet is not on Arc Testnet. Authentication cancelled.");
        return;
      }

      // 1. Request cryptographic challenge
      const challenge = await requestAuthChallenge(address);

      // 2. Request user to sign challenge in wallet
      const signer = await provider.getSigner();
      const signature = await signer.signMessage(challenge.message);

      // 3. Verify on backend & obtain JWT session
      const verifyRes = await verifyWalletSignature(address, signature, challenge.nonce);
      setUser(verifyRes.user);
      setAccount(address);
    } catch (err: any) {
      console.warn("Wallet signature flow declined or failed:", err);
      disconnectWallet();
      if (err.code === 4001 || err.message?.includes('rejected')) {
        alert("Sign-in cancelled: You must sign the message with your wallet to sign in to Taskbit.");
      } else {
        alert(`Sign-in failed: ${err.message || 'Could not verify wallet signature'}`);
      }
    }
  };

  const authenticate = async (address: string, provider?: ethers.BrowserProvider) => {
    // Strictly verify network before allowing authentication
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const isArc = await verifyIsArcTestnet();
      if (!isArc) {
        disconnectWallet();
        return;
      }
    }

    const existingToken = getAuthToken();
    if (existingToken) {
      try {
        const userData = await authWallet(address);
        setUser(userData);
        setAccount(address);
        return;
      } catch (err) {
        setAuthToken(null);
      }
    }

    if (provider) {
      await authenticateWithSignature(address, provider);
    } else {
      disconnectWallet();
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      setIsLoading(true);
      try {
        const eth = (window as any).ethereum;

        // 1. Strictly enforce Arc Testnet network upfront
        const isArcAlready = await verifyIsArcTestnet(eth);
        if (!isArcAlready) {
          const switched = await switchToArcTestnet();
          if (!switched) {
            setIsCorrectNetwork(false);
            setIsLoading(false);
            disconnectWallet();
            alert("Taskbit strictly operates on Arc Testnet (Chain ID 5042002). Please switch network to Arc Testnet to connect.");
            return;
          }
        }

        const provider = new ethers.BrowserProvider(eth);
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== ARC_TESTNET_CHAIN_ID) {
          setIsCorrectNetwork(false);
          setIsLoading(false);
          disconnectWallet();
          alert("Wallet is not on Arc Testnet (Chain ID 5042002). Connection cancelled.");
          return;
        }

        setIsCorrectNetwork(true);
        setChainId(ARC_TESTNET_CHAIN_ID);

        // 2. Request user accounts
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) {
          // Double check network once more after account approval
          const postApprovalNetwork = await provider.getNetwork();
          if (Number(postApprovalNetwork.chainId) !== ARC_TESTNET_CHAIN_ID) {
            setIsCorrectNetwork(false);
            disconnectWallet();
            alert("Connection cancelled: active network must be Arc Testnet (Chain ID 5042002).");
            return;
          }
          await authenticate(accounts[0], provider);
        }
      } catch (err) {
        console.error("User rejected wallet connection:", err);
        disconnectWallet();
      } finally {
        setIsLoading(false);
      }
    } else {
      alert("Please install a Web3 wallet like MetaMask to use Taskbit.");
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setUser(null);
    setAuthToken(null);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const eth = (window as any).ethereum;

      const checkConnection = async () => {
        try {
          const isArc = await verifyIsArcTestnet(eth);
          if (!isArc) {
            setIsCorrectNetwork(false);
            disconnectWallet();
            return;
          }

          setIsCorrectNetwork(true);
          const provider = new ethers.BrowserProvider(eth);
          const accounts = await provider.listAccounts();
          const existingToken = getAuthToken();
          if (accounts.length > 0 && existingToken) {
            await authenticate(accounts[0].address, provider);
          } else {
            disconnectWallet();
          }
        } catch (err) {
          console.error("Error verifying initial wallet connection:", err);
        }
      };

      checkConnection();

      const handleAccountsChanged = async (accounts: string[]) => {
        const isArc = await verifyIsArcTestnet(eth);
        if (!isArc) {
          setIsCorrectNetwork(false);
          disconnectWallet();
          alert("Wallet disconnected: Taskbit strictly operates on Arc Testnet (Chain ID 5042002).");
          return;
        }

        if (accounts.length > 0) {
          const provider = new ethers.BrowserProvider(eth);
          setAuthToken(null);
          await authenticateWithSignature(accounts[0], provider);
        } else {
          disconnectWallet();
        }
      };

      const handleChainChanged = (chainIdHex: string) => {
        const chainIdNum = typeof chainIdHex === 'string' && chainIdHex.startsWith('0x')
          ? parseInt(chainIdHex, 16)
          : Number(chainIdHex);

        setChainId(chainIdNum);

        if (chainIdNum !== ARC_TESTNET_CHAIN_ID) {
          setIsCorrectNetwork(false);
          disconnectWallet();
          alert(`Network switched to chain ${chainIdNum}. Taskbit only operates on Arc Testnet (Chain ID 5042002). Your wallet has been disconnected.`);
        } else {
          setIsCorrectNetwork(true);
          checkConnection();
        }
      };

      eth.on('accountsChanged', handleAccountsChanged);
      eth.on('chainChanged', handleChainChanged);

      return () => {
        if (eth.removeListener) {
          eth.removeListener('accountsChanged', handleAccountsChanged);
          eth.removeListener('chainChanged', handleChainChanged);
        }
      };
    }
  }, []);

  return (
    <WalletContext.Provider
      value={{
        account,
        user,
        connectWallet,
        disconnectWallet,
        switchToArcTestnet,
        isCorrectNetwork,
        isLoading,
        chainId,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
