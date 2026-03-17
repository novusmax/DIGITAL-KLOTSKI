// 合约地址：将 .env.example 复制为 .env 并填入部署后的地址
export const CONTRACT_ADDRESS = import.meta.env.VITE_CONTRACT_ADDRESS || '';

// 期望连接的链 ID（默认 Anvil 本地网络）
export const EXPECTED_CHAIN_ID = parseInt(import.meta.env.VITE_CHAIN_ID || '31337');
