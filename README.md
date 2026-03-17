🧩 Digital Klotski Web3 (数字华容道链上版)

一个基于 React 和 Solidity 构建的去中心化全链游戏 (On-Chain Game)。玩家的通关记录将永久刻录在以太坊 Sepolia 测试网上，由智能合约维护全球不可篡改的排行榜。

🌟 项目亮点 (Features)

🎮 纯粹的游戏体验：支持 3x3、4x4、5x5 多种难度，自适应移动端与 PC 端，支持键盘方向键与手势滑动操作。

⛓️ 智能合约存证：使用 Solidity 编写游戏逻辑与排行榜，确保玩家成绩的绝对公平与去中心化。

⚡ 分页与逆序优化：智能合约端实现了数据分页查询 (getScoresPaginated & getLatestScores)，有效防止数据量过大导致的 RPC 节点超时崩溃。

🦊 Web3 钱包集成：使用 ethers.js 无缝连接 MetaMask，实现一键签名与成绩上链。

🛠️ 技术栈 (Tech Stack)

前端 (Frontend)

React (Vite)

Tailwind CSS

Ethers.js v6

智能合约 (Smart Contract)

Solidity (^0.8.13)

Foundry (Forge, Anvil, Cast)

🔗 核心链接 (Links)

线上体验地址: [点击体验](https://digital-klotski.vercel.app/)

智能合约网络: Ethereum Sepolia Testnet

智能合约地址: 0x2dD65806fA333131E49664Fe212D53888fC24F68

Etherscan 区块链浏览器: [点击查看智能合约](https://sepolia.etherscan.io/address/0x2dD65806fA333131E49664Fe212D53888fC24F68)

📄 开源协议 (License)

本项目采用 MIT 协议开源。