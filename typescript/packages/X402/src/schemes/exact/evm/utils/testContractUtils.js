#!/usr/bin/env node

import {createPublicClient, http} from 'viem';
import {bsc, mainnet, polygon, arbitrum, base} from 'viem/chains';
import {verifyTransferWithAuthorizationSupport} from '/Users/yuanyong/Downloads/aeon_402/typescript/packages/X402/dist/schemes/exact/evm/utils/contractUtils.js';

// Supported network configurations
const NETWORKS = {
    bsc: {
        chain: bsc,
        rpcUrl: 'https://bsc-dataseed1.binance.org/',
    },
    ethereum: {
        chain: mainnet,
        rpcUrl: 'https://eth.llamarpc.com',
    },
    polygon: {
        chain: polygon,
        rpcUrl: 'https://polygon.llamarpc.com',
    },
    arbitrum: {
        chain: arbitrum,
        rpcUrl: 'https://arb1.arbitrum.io/rpc',
    },
    base: {
        chain: base,
        rpcUrl: 'https://mainnet.base.org',
    },
};

/**
 * Create a client instance
 */
function createClient(networkName) {
    const network = NETWORKS[networkName];
    if (!network) {
        throw new Error(`Unsupported network: ${networkName}`);
    }

    return createPublicClient({
        chain: network.chain,
        transport: http(network.rpcUrl),
    });
}

/**
 * Test a single contract address
 */
async function testContract(contractAddress, networkName = 'bsc') {
    console.log(`\n🔍 Testing contract: ${contractAddress} on ${networkName.toUpperCase()}`);
    console.log('='.repeat(80));

    try {
        const client = createClient(networkName);

        console.log('📋 Running TransferWithAuthorization detection using readContract method...\n');

        const hasFunction = await verifyTransferWithAuthorizationSupport(client, contractAddress);

        console.log('\n📊 Final Result:');
        console.log(`   Contract: ${contractAddress}`);
        console.log(`   Network: ${networkName.toUpperCase()}`);
        console.log(`   Supports TransferWithAuthorization: ${hasFunction ? '✅ YES' : '❌ NO'}`);

        return {hasFunction, contractAddress, networkName};
    } catch (error) {
        console.error(`\n❌ Error testing contract ${contractAddress}:`, error.message);
        return {hasFunction: false, contractAddress, networkName, error: error.message};
    }
}

/**
 * Display usage help
 */
function showHelp() {
    console.log(`
🔧 Contract Utils Tester

Usage:
  node testContractUtils.js <contract_address> [network]

Parameters:
  contract_address           Contract address to test (required)
  network                    Network name (optional, default: bsc)

Supported Networks:
  - bsc: Binance Smart Chain
  - ethereum: Ethereum Mainnet  
  - polygon: Polygon
  - arbitrum: Arbitrum One
  - base: Base

Examples:
  # Test USDT on BSC (should return false)
  node testContractUtils.js 0x55d398326f99059ff775485246999027b3197955 bsc
  
  # Test USDC on Ethereum
  node testContractUtils.js 0xA0b86a33E6441d3f4e7A7D8C5e9Db0b2b2B9D5A8 ethereum
  
  # Test on default network (BSC)
  node testContractUtils.js 0x55d398326f99059ff775485246999027b3197955

Function being tested:
  transferWithAuthorization(address,address,uint256,uint256,uint256,bytes32,uint8,bytes32,bytes32)
  Detection method: readContract (ERC-3009 compatible)
`);
}

/**
 * main function
 */
async function main() {
    const args = process.argv.slice(2);
    if (args.length === 0 || args[0] === 'help' || args[0] === '--help' || args[0] === '-h') {
        showHelp();
        return;
    }
    
    const contractAddress = args[0];
    const networkName = args[1] || 'bsc';

    // Verify contract address format
    if (!/^0x[a-fA-F0-9]{40}$/.test(contractAddress)) {
        console.error('❌ Error: Invalid contract address format');
        console.log('Contract address should be a 42-character hex string starting with 0x');
        process.exit(1);
    }

    // Verify network name
    if (!NETWORKS[networkName]) {
        console.error(`❌ Error: Unsupported network '${networkName}'`);
        console.log('Supported networks:', Object.keys(NETWORKS).join(', '));
        process.exit(1);
    }

    await testContract(contractAddress, networkName);
}

// If you directly run this file, the main function will be executed
if (import.meta.url === `file://${process.argv[1]}`) {
    main().catch((error) => {
        console.error('❌ Unexpected error:', error);
        process.exit(1);
    });
}

export {testContract, createClient};
