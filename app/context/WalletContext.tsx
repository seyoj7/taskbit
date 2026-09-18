'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { ethers } from 'ethers';
import { authWallet, User } from '../lib/api';

interface WalletContextType {
  account: string | null;
  user: User | null;
  connectWallet: () => Promise<void>;
  disconnectWallet: () => void;
  isLoading: boolean;
}

const WalletContext = createContext<WalletContextType>({
  account: null,
  user: null,
  connectWallet: async () => {},
  disconnectWallet: () => {},
  isLoading: false,
});

export const useWallet = () => useContext(WalletContext);

export const WalletProvider = ({ children }: { children: ReactNode }) => {
  const [account, setAccount] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const authenticate = async (address: string) => {
    try {
      const userData = await authWallet(address);
      setUser(userData);
      setAccount(address);
    } catch (err) {
      console.error("Authentication failed:", err);
      alert("Wallet connected, but backend authentication failed. Make sure the FastAPI backend is running.");
      // Still set the account so the UI updates
      setAccount(address);
    }
  };

  const connectWallet = async () => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      setIsLoading(true);
      try {
        const provider = new ethers.BrowserProvider((window as any).ethereum);
        const accounts = await provider.send("eth_requestAccounts", []);
        if (accounts.length > 0) {
          await authenticate(accounts[0]);
        }
      } catch (err) {
        console.error("User rejected request or error occurred:", err);
      } finally {
        setIsLoading(false);
      }
    } else {
      alert("Please install a Web3 wallet like MetaMask.");
    }
  };

  const disconnectWallet = () => {
    setAccount(null);
    setUser(null);
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).ethereum) {
      const checkConnection = async () => {
        try {
          const provider = new ethers.BrowserProvider((window as any).ethereum);
          const accounts = await provider.listAccounts();
          if (accounts.length > 0) {
            await authenticate(accounts[0].address);
          }
        } catch (err) {
          console.error(err);
        }
      };
      checkConnection();

      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length > 0) {
          authenticate(accounts[0]);
        } else {
          disconnectWallet();
        }
      };
      
      (window as any).ethereum.on('accountsChanged', handleAccountsChanged);

      return () => {
        if ((window as any).ethereum.removeListener) {
          (window as any).ethereum.removeListener('accountsChanged', handleAccountsChanged);
        }
      };
    }
  }, []);

  return (
    <WalletContext.Provider value={{ account, user, connectWallet, disconnectWallet, isLoading }}>
      {children}
    </WalletContext.Provider>
  );
};
