// Auto-generated artifact for TaskEscrow
export const TASK_ESCROW_ABI = [
  {
    "inputs": [
      {
        "internalType": "address",
        "name": "_usdc",
        "type": "address"
      }
    ],
    "stateMutability": "nonpayable",
    "type": "constructor"
  },
  {
    "inputs": [],
    "name": "AlreadyCompleted",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "AlreadyFunded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidBounty",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "InvalidWorker",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "NotFunded",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "OnlyCreator",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TaskAlreadyExists",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TaskNotFound",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "TransferFailed",
    "type": "error"
  },
  {
    "inputs": [],
    "name": "WorkerNotAssigned",
    "type": "error"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "PaymentReleased",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "bounty",
        "type": "uint256"
      }
    ],
    "name": "TaskCreated",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "TaskFunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "indexed": false,
        "internalType": "uint256",
        "name": "amount",
        "type": "uint256"
      }
    ],
    "name": "TaskRefunded",
    "type": "event"
  },
  {
    "anonymous": false,
    "inputs": [
      {
        "indexed": true,
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "indexed": true,
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "WorkerAssigned",
    "type": "event"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "worker",
        "type": "address"
      }
    ],
    "name": "assignWorker",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "bounty",
        "type": "uint256"
      }
    ],
    "name": "createTask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      },
      {
        "internalType": "uint256",
        "name": "bounty",
        "type": "uint256"
      }
    ],
    "name": "createTask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      }
    ],
    "name": "fundTask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      }
    ],
    "name": "getTask",
    "outputs": [
      {
        "components": [
          {
            "internalType": "address",
            "name": "creator",
            "type": "address"
          },
          {
            "internalType": "address",
            "name": "worker",
            "type": "address"
          },
          {
            "internalType": "uint256",
            "name": "bounty",
            "type": "uint256"
          },
          {
            "internalType": "bool",
            "name": "funded",
            "type": "bool"
          },
          {
            "internalType": "bool",
            "name": "completed",
            "type": "bool"
          }
        ],
        "internalType": "struct TaskEscrow.Task",
        "name": "",
        "type": "tuple"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "owner",
    "outputs": [
      {
        "internalType": "address",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      }
    ],
    "name": "refundTask",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "taskId",
        "type": "uint256"
      }
    ],
    "name": "releasePayment",
    "outputs": [],
    "stateMutability": "nonpayable",
    "type": "function"
  },
  {
    "inputs": [
      {
        "internalType": "uint256",
        "name": "",
        "type": "uint256"
      }
    ],
    "name": "tasks",
    "outputs": [
      {
        "internalType": "address",
        "name": "creator",
        "type": "address"
      },
      {
        "internalType": "address",
        "name": "worker",
        "type": "address"
      },
      {
        "internalType": "uint256",
        "name": "bounty",
        "type": "uint256"
      },
      {
        "internalType": "bool",
        "name": "funded",
        "type": "bool"
      },
      {
        "internalType": "bool",
        "name": "completed",
        "type": "bool"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  },
  {
    "inputs": [],
    "name": "usdc",
    "outputs": [
      {
        "internalType": "contract IERC20",
        "name": "",
        "type": "address"
      }
    ],
    "stateMutability": "view",
    "type": "function"
  }
] as const;

export const TASK_ESCROW_BYTECODE = "0x60a060405234801561000f575f5ffd5b50604051611a7d380380611a7d83398181016040528101906100319190610108565b8073ffffffffffffffffffffffffffffffffffffffff1660808173ffffffffffffffffffffffffffffffffffffffff1681525050335f5f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff16021790555050610133565b5f5ffd5b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f6100d7826100ae565b9050919050565b6100e7816100cd565b81146100f1575f5ffd5b50565b5f81519050610102816100de565b92915050565b5f6020828403121561011d5761011c6100aa565b5b5f61012a848285016100f4565b91505092915050565b60805161191d6101605f395f8181610585015281816106fa01528181610c4b0152611060015261191d5ff3fe608060405234801561000f575f5ffd5b506004361061009c575f3560e01c80638d977672116100645780638d977672146101425780638da5cb5b14610176578063d1ff21c214610194578063e4fd6b6a146101b0578063e75b2378146101cc5761009c565b80631d65e77e146100a057806328677436146100d05780633e413bee146100ec5780637464a25b1461010a57806388685cd914610126575b5f5ffd5b6100ba60048036038101906100b5919061150a565b6101e8565b6040516100c79190611603565b60405180910390f35b6100ea60048036038101906100e5919061150a565b610392565b005b6100f46106f8565b6040516101019190611677565b60405180910390f35b610124600480360381019061011f91906116ba565b61071c565b005b610140600480360381019061013b919061150a565b6109d0565b005b61015c6004803603810190610157919061150a565b610dc0565b60405161016d959493929190611725565b60405180910390f35b61017e610e49565b60405161018b9190611776565b60405180910390f35b6101ae60048036038101906101a9919061150a565b610e6d565b005b6101ca60048036038101906101c5919061178f565b611191565b005b6101e660048036038101906101e191906117df565b611206565b005b6101f0611479565b5f73ffffffffffffffffffffffffffffffffffffffff1660015f8481526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1603610287576040517fc325ae3300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60015f8381526020019081526020015f206040518060a00160405290815f82015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff168152602001600182015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16815260200160028201548152602001600382015f9054906101000a900460ff161515151581526020016003820160019054906101000a900460ff1615151515815250509050919050565b805f73ffffffffffffffffffffffffffffffffffffffff1660015f8381526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff160361042a576040517fc325ae3300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b3373ffffffffffffffffffffffffffffffffffffffff1660015f8381526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16146104c1576040517f47bc7cc800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f60015f8481526020019081526020015f209050806003015f9054906101000a900460ff1661051c576040517fd5ef09ba00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060030160019054906101000a900460ff1615610565576040517f195332a500000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60018160030160016101000a81548160ff0219169083151502179055505f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff1663a9059cbb835f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1684600201546040518363ffffffff1660e01b815260040161060492919061181d565b6020604051808303815f875af1158015610620573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610644919061186e565b90508061067d576040517f90b8ec1800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b815f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16847f098446306d18a8ba797caf5ad3be836bc7fadb0fa82d207e934992497bdeaf6184600201546040516106ea9190611899565b60405180910390a350505050565b7f000000000000000000000000000000000000000000000000000000000000000081565b815f73ffffffffffffffffffffffffffffffffffffffff1660015f8381526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16036107b4576040517fc325ae3300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b3373ffffffffffffffffffffffffffffffffffffffff1660015f8381526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff161461084b576040517f47bc7cc800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f60015f8581526020019081526020015f2090508060030160019054906101000a900460ff16156108a8576040517f195332a500000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16148061090d57503373ffffffffffffffffffffffffffffffffffffffff168373ffffffffffffffffffffffffffffffffffffffff16145b15610944576040517fc905160300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b82816001015f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055508273ffffffffffffffffffffffffffffffffffffffff16847f5a947a7963f521bdb91d091674dcedd326f71c169b636d55fbbee5704adeb97660405160405180910390a350505050565b805f73ffffffffffffffffffffffffffffffffffffffff1660015f8381526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1603610a68576040517fc325ae3300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b3373ffffffffffffffffffffffffffffffffffffffff1660015f8381526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614610aff576040517f47bc7cc800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f60015f8481526020019081526020015f209050806003015f9054906101000a900460ff16610b5a576040517fd5ef09ba00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060030160019054906101000a900460ff1615610ba3576040517f195332a500000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f73ffffffffffffffffffffffffffffffffffffffff16816001015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1603610c2b576040517f7f8ea3bc00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b60018160030160016101000a81548160ff0219169083151502179055505f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff1663a9059cbb836001015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1684600201546040518363ffffffff1660e01b8152600401610ccb92919061181d565b6020604051808303815f875af1158015610ce7573d5f5f3e3d5ffd5b505050506040513d601f19601f82011682018060405250810190610d0b919061186e565b905080610d44576040517f90b8ec1800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b816001015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16847f21d71db5be59bb9fa133895586b7404307dd33fb93b16db09dc6f1d9d7d231b08460020154604051610db29190611899565b60405180910390a350505050565b6001602052805f5260405f205f91509050805f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690806001015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1690806002015490806003015f9054906101000a900460ff16908060030160019054906101000a900460ff16905085565b5f5f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1681565b805f73ffffffffffffffffffffffffffffffffffffffff1660015f8381526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1603610f05576040517fc325ae3300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b3373ffffffffffffffffffffffffffffffffffffffff1660015f8381526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff1614610f9c576040517f47bc7cc800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f60015f8481526020019081526020015f209050806003015f9054906101000a900460ff1615610ff8576040517f5adf638700000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b8060030160019054906101000a900460ff1615611041576040517f195332a500000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6001816003015f6101000a81548160ff0219169083151502179055505f7f000000000000000000000000000000000000000000000000000000000000000073ffffffffffffffffffffffffffffffffffffffff166323b872dd333085600201546040518463ffffffff1660e01b81526004016110bf939291906118b2565b6020604051808303815f875af11580156110db573d5f5f3e3d5ffd5b505050506040513d601f19601f820116820180604052508101906110ff919061186e565b905080611138576040517f90b8ec1800000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b3373ffffffffffffffffffffffffffffffffffffffff16847f9c49807a23f4d5f56e8d93c1add31e749bd0cdf1025eefe36f906ba31c0dfc6884600201546040516111839190611899565b60405180910390a350505050565b3373ffffffffffffffffffffffffffffffffffffffff168273ffffffffffffffffffffffffffffffffffffffff16036111f6576040517fc905160300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b611201838383611215565b505050565b611211825f83611215565b5050565b5f73ffffffffffffffffffffffffffffffffffffffff1660015f8581526020019081526020015f205f015f9054906101000a900473ffffffffffffffffffffffffffffffffffffffff1673ffffffffffffffffffffffffffffffffffffffff16146112ac576040517ff2e16b0300000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b5f81036112e5576040517fce8338ed00000000000000000000000000000000000000000000000000000000815260040160405180910390fd5b6040518060a001604052803373ffffffffffffffffffffffffffffffffffffffff1681526020018373ffffffffffffffffffffffffffffffffffffffff1681526020018281526020015f151581526020015f151581525060015f8581526020019081526020015f205f820151815f015f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff1602179055506020820151816001015f6101000a81548173ffffffffffffffffffffffffffffffffffffffff021916908373ffffffffffffffffffffffffffffffffffffffff160217905550604082015181600201556060820151816003015f6101000a81548160ff02191690831515021790555060808201518160030160016101000a81548160ff0219169083151502179055509050503373ffffffffffffffffffffffffffffffffffffffff16837ff3efa663e8763e3719e2bdc58b7fdc03d43b6fcec97b7bcf371e6a4ea8704488848460405161146c92919061181d565b60405180910390a3505050565b6040518060a001604052805f73ffffffffffffffffffffffffffffffffffffffff1681526020015f73ffffffffffffffffffffffffffffffffffffffff1681526020015f81526020015f151581526020015f151581525090565b5f5ffd5b5f819050919050565b6114e9816114d7565b81146114f3575f5ffd5b50565b5f81359050611504816114e0565b92915050565b5f6020828403121561151f5761151e6114d3565b5b5f61152c848285016114f6565b91505092915050565b5f73ffffffffffffffffffffffffffffffffffffffff82169050919050565b5f61155e82611535565b9050919050565b61156e81611554565b82525050565b61157d816114d7565b82525050565b5f8115159050919050565b61159781611583565b82525050565b60a082015f8201516115b15f850182611565565b5060208201516115c46020850182611565565b5060408201516115d76040850182611574565b5060608201516115ea606085018261158e565b5060808201516115fd608085018261158e565b50505050565b5f60a0820190506116165f83018461159d565b92915050565b5f819050919050565b5f61163f61163a61163584611535565b61161c565b611535565b9050919050565b5f61165082611625565b9050919050565b5f61166182611646565b9050919050565b61167181611657565b82525050565b5f60208201905061168a5f830184611668565b92915050565b61169981611554565b81146116a3575f5ffd5b50565b5f813590506116b481611690565b92915050565b5f5f604083850312156116d0576116cf6114d3565b5b5f6116dd858286016114f6565b92505060206116ee858286016116a6565b9150509250929050565b61170181611554565b82525050565b611710816114d7565b82525050565b61171f81611583565b82525050565b5f60a0820190506117385f8301886116f8565b61174560208301876116f8565b6117526040830186611707565b61175f6060830185611716565b61176c6080830184611716565b9695505050505050565b5f6020820190506117895f8301846116f8565b92915050565b5f5f5f606084860312156117a6576117a56114d3565b5b5f6117b3868287016114f6565b93505060206117c4868287016116a6565b92505060406117d5868287016114f6565b9150509250925092565b5f5f604083850312156117f5576117f46114d3565b5b5f611802858286016114f6565b9250506020611813858286016114f6565b9150509250929050565b5f6040820190506118305f8301856116f8565b61183d6020830184611707565b9392505050565b61184d81611583565b8114611857575f5ffd5b50565b5f8151905061186881611844565b92915050565b5f60208284031215611883576118826114d3565b5b5f6118908482850161185a565b91505092915050565b5f6020820190506118ac5f830184611707565b92915050565b5f6060820190506118c55f8301866116f8565b6118d260208301856116f8565b6118df6040830184611707565b94935050505056fea26469706673582212203eb24548b553161cef4953e05fe8aa96b10470cbf841f1cfa90688020f48ad6764736f6c63430008220033";

/**
 * Centralized on-chain configuration.
 * All addresses and RPC endpoints are strictly loaded from environment variables (.env).
 * No hardcoded addresses exist here.
 */
export const TASK_ESCROW_ADDRESS = (process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || '').trim();
export const USDC_ADDRESS = (process.env.NEXT_PUBLIC_USDC_ADDRESS || '').trim();
export const ARC_TESTNET_RPC_URL = (process.env.NEXT_PUBLIC_ARC_TESTNET_RPC_URL || 'https://arc-testnet.drpc.org').trim();

// Runtime check in browser to warn developer if environment variables are missing
if (typeof window !== 'undefined') {
  if (!TASK_ESCROW_ADDRESS) {
    console.error("Taskbit Configuration Error: CONTRACT_ADDRESS is not set in .env!");
  }
  if (!USDC_ADDRESS) {
    console.error("Taskbit Configuration Error: USDC_ADDRESS is not set in .env!");
  }
}

