'use client';

import React, { createContext, useContext, useState, useEffect, useRef, ReactNode } from 'react';
import { ethers } from 'ethers';
import {
  authWallet,
  requestAuthChallenge,
  verifyWalletSignature,
  getAuthToken,
  setAuthToken,
  User,
} from './api';

export const ARC_CHAIN_ID = 5042;
export const ARC_HEX_CHAIN_ID = '0x13b2';

/** @deprecated Use ARC_CHAIN_ID instead */
export const ARC_TESTNET_CHAIN_ID = ARC_CHAIN_ID;

export const ARC_NETWORK_PARAMS = {
  chainId: ARC_HEX_CHAIN_ID,
  chainName: 'Arc',
  nativeCurrency: {
    name: 'Arc',
    symbol: 'ARC',
    decimals: 18,
  },
  rpcUrls: ['https://rpc.mainnet.arc.io'],
  blockExplorerUrls: ['https://explorer.arc.io'],
};


interface WalletContextType {
  account: string | null;
  user: User | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  switchToArcNetwork: () => Promise<boolean>;
  /** @deprecated Use switchToArcNetwork instead */
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
  switchToArcNetwork: async () => false,
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
  const authInFlightRef = useRef<Map<string, Promise<void>>>(new Map());

  const verifyIsArcNetwork = async (ethereumObj?: any): Promise<boolean> => {
    const eth = ethereumObj || (typeof window !== 'undefined' ? (window as any).ethereum : null);
    if (!eth) return false;
    try {
      const hexId = await eth.request({ method: 'eth_chainId' });
      const numId = typeof hexId === 'string' && hexId.startsWith('0x') ? parseInt(hexId, 16) : Number(hexId);
      setChainId(numId);
      const isArc = numId === ARC_CHAIN_ID;
      setIsCorrectNetwork(isArc);
      return isArc;
    } catch (err) {
      console.warn("Could not query eth_chainId:", err);
      return false;
    }
  };

  const switchToArcNetwork = async (): Promise<boolean> => {
    if (typeof window === 'undefined' || !(window as any).ethereum) {
      alert("Please install a Web3 wallet like MetaMask.");
      return false;
    }

    const eth = (window as any).ethereum;

    try {
      await eth.request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: ARC_HEX_CHAIN_ID }],
      });
      return await verifyIsArcNetwork(eth);
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
            params: [ARC_NETWORK_PARAMS],
          });
          return await verifyIsArcNetwork(eth);
        } catch (addError) {
          console.error("Failed to add Arc network to wallet:", addError);
          return false;
        }
      }
      console.warn("User rejected network switch to Arc:", switchError);
      return false;
    }
  };

  /** @deprecated Use switchToArcNetwork instead */
  const switchToArcTestnet = switchToArcNetwork;

  const authenticateWithSignature = (address: string, provider: ethers.BrowserProvider): Promise<void> => {
    const addressKey = address.toLowerCase();
    const existingAuthentication = authInFlightRef.current.get(addressKey);
    if (existingAuthentication) return existingAuthentication;

    const authentication = (async () => {
      try {
        // Verify network is strictly Arc Mainnet before prompting signature
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== ARC_CHAIN_ID) {
          setIsCorrectNetwork(false);
          disconnectWallet();
          alert("Wallet is not on Arc Mainnet. Authentication cancelled.");
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
    })();

    authInFlightRef.current.set(addressKey, authentication);
    void authentication.finally(() => {
      if (authInFlightRef.current.get(addressKey) === authentication) {
        authInFlightRef.current.delete(addressKey);
      }
    });
    return authentication;
  };

  const authenticate = async (address: string, provider?: ethers.BrowserProvider) => {
    // Strictly verify network before allowing authentication
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const isArc = await verifyIsArcNetwork();
      if (!isArc) {
        disconnectWallet();
        return;
      }
    }

    const existingToken = getAuthToken();
    let reusableToken = false;
    if (existingToken) {
      try {
        const payloadPart = existingToken.split('.')[1];
        const normalizedPayload = payloadPart.replace(/-/g, '+').replace(/_/g, '/');
        const paddedPayload = normalizedPayload.padEnd(Math.ceil(normalizedPayload.length / 4) * 4, '=');
        const payload = JSON.parse(window.atob(paddedPayload));
        reusableToken =
          typeof payload.wallet === 'string' &&
          payload.wallet.toLowerCase() === address.toLowerCase() &&
          typeof payload.exp === 'number' &&
          payload.exp * 1000 > Date.now();
      } catch {
        reusableToken = false;
      }
    }

    if (reusableToken) {
      try {
        const userData = await authWallet(address);
        setUser(userData);
        setAccount(address);
        return;
      } catch (err) {
        setAuthToken(null);
      }
    } else if (existingToken) {
      setAuthToken(null);
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

        // 1. Strictly enforce Arc Mainnet network upfront
        const isArcAlready = await verifyIsArcNetwork(eth);
        if (!isArcAlready) {
          const switched = await switchToArcNetwork();
          if (!switched) {
            setIsCorrectNetwork(false);
            setIsLoading(false);
            disconnectWallet();
            alert("Taskbit operates on Arc Mainnet (Chain ID 5042). Please switch network to Arc to connect.");
            return;
          }
        }

        const provider = new ethers.BrowserProvider(eth);
        const network = await provider.getNetwork();
        if (Number(network.chainId) !== ARC_CHAIN_ID) {
          setIsCorrectNetwork(false);
          setIsLoading(false);
          disconnectWallet();
          alert("Wallet is not on Arc Mainnet (Chain ID 5042). Connection cancelled.");
          return;
        }

        setIsCorrectNetwork(true);
        setChainId(ARC_CHAIN_ID);

        // 2. Request user accounts
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) {
          // Double check network once more after account approval
          const postApprovalNetwork = await provider.getNetwork();
          if (Number(postApprovalNetwork.chainId) !== ARC_CHAIN_ID) {
            setIsCorrectNetwork(false);
            disconnectWallet();
            alert("Connection cancelled: active network must be Arc Mainnet (Chain ID 5042).");
            return;
          }
          await authenticate(accounts[0], provider);
        }
      } catch (err: any) {
        console.error("User rejected wallet connection:", err);
        disconnectWallet();
        if (err?.code === 4001 || err?.message?.toLowerCase?.().includes('user rejected')) {
          alert("Wallet connection was cancelled.");
        } else {
          alert(`Wallet connection failed: ${err?.message || 'Could not connect to your wallet.'}`);
        }
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
          const isArc = await verifyIsArcNetwork(eth);
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
        const isArc = await verifyIsArcNetwork(eth);
        if (!isArc) {
          setIsCorrectNetwork(false);
          disconnectWallet();
          alert("Wallet disconnected: Taskbit operates on Arc Mainnet (Chain ID 5042).");
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

        if (chainIdNum !== ARC_CHAIN_ID) {
          setIsCorrectNetwork(false);
          disconnectWallet();
          alert(`Network switched to chain ${chainIdNum}. Taskbit only operates on Arc Mainnet (Chain ID 5042). Your wallet has been disconnected.`);
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
        switchToArcNetwork,
        switchToArcTestnet: switchToArcNetwork,
        isCorrectNetwork,
        isLoading,
        chainId,
      }}
    >
      {children}
    </WalletContext.Provider>
  );
};
