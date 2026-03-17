import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Github, ChevronDown } from 'lucide-react';
import { ethers } from 'ethers';


const CONTRACT_ADDRESS = "0x2dD65806fA333131E49664Fe212D53888fC24F68"; 
const CHAIN_ID = 11155111;
const CHAIN_NAME = "Sepolia Testnet";

const CONTRACT_ABI = [
  "function submitScore(uint8 gridSize, uint32 moves, uint32 timeSeconds) external",
  "function getLatestScores(uint256 limit) external view returns (tuple(address player, uint8 gridSize, uint32 moves, uint32 timeSeconds, uint64 timestamp)[])"
];

// ==========================================
// 颜色处理工具函数
// ==========================================
const hexToRgb = (hex) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  const r = parseInt(h.substring(0, 2), 16);
  const g = parseInt(h.substring(2, 4), 16);
  const b = parseInt(h.substring(4, 6), 16);
  return `${r}, ${g}, ${b}`;
};

const darken = (hex, amount = 0.2) => {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h.split('').map(c => c + c).join('');
  let r = parseInt(h.substring(0, 2), 16);
  let g = parseInt(h.substring(2, 4), 16);
  let b = parseInt(h.substring(4, 6), 16);
  r = Math.max(0, Math.floor(r * (1 - amount)));
  g = Math.max(0, Math.floor(g * (1 - amount)));
  b = Math.max(0, Math.floor(b * (1 - amount)));
  const toHex = (n) => n.toString(16).padStart(2, '0');
  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const App = () => {
  const [size, setSize] = useState(3); 
  const [board, setBoard] = useState([]);
  const [isSolved, setIsSolved] = useState(false);
  const [moves, setMoves] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [time, setTime] = useState(0);
  
  // ==========================================
  // Web3 状态管理
  // ==========================================
  const [walletAddress, setWalletAddress] = useState(null);
  const [provider, setProvider] = useState(null);
  const [signer, setSigner] = useState(null);
  const [contract, setContract] = useState(null);
  
  const [uploadStatus, setUploadStatus] = useState('idle');
  const [onChainLeaderboard, setOnChainLeaderboard] = useState([]);
  const [isFetchingBoard, setIsFetchingBoard] = useState(false);
  const [showConnectPrompt, setShowConnectPrompt] = useState(false);
  
  // ==========================================
  // UI 与弹窗状态
  // ==========================================
  const [themeColor, setThemeColor] = useState('#f6dd84'); 
  const [showSettings, setShowSettings] = useState(false);
  
  // 优化：从 localStorage 中读取初始对局记录，防止刷新丢失
  const [records, setRecords] = useState(() => {
    const saved = localStorage.getItem('klotski_local_records');
    if (saved) {
      try { return JSON.parse(saved); } catch (e) { return []; }
    }
    return [];
  });
  
  const [showRecords, setShowRecords] = useState(false);
  const [showLeaderboard, setShowLeaderboard] = useState(false);
  const [filterSize, setFilterSize] = useState('all'); 
  
  const latestStats = useRef({ moves: 0, time: 0, size: 3 });
  const touchStart = useRef({ x: null, y: null });

  // 优化：每当 records 改变时，同步保存到浏览器的 localStorage 中
  useEffect(() => {
    localStorage.setItem('klotski_local_records', JSON.stringify(records));
  }, [records]);

  const formatAddress = (addr) => {
    if (!addr) return "";
    return `${addr.substring(0, 6)}...${addr.substring(addr.length - 4)}`;
  };

  const getDifficultyText = (s) => {
    switch(s) {
      case 3: return "入门";
      case 4: return "简单";
      case 5: return "标准";
      default: return "未知";
    }
  };

  // ==========================================
  // Web3 核心逻辑：连接钱包
  // ==========================================
  const silentConnect = useCallback(async () => {
    if (window.ethereum) {
      try {
        const accounts = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const web3Provider = new ethers.BrowserProvider(window.ethereum);
          const web3Signer = await web3Provider.getSigner();
          const address = await web3Signer.getAddress();
          const gameContract = new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, web3Signer);
          
          setProvider(web3Provider);
          setSigner(web3Signer);
          setWalletAddress(address);
          setContract(gameContract);
        }
      } catch(e) {
        console.error("静默连接失败", e);
      }
    }
  }, []);

  const connectWallet = async () => {
    if (typeof window.ethereum !== 'undefined') {
      try {
        await window.ethereum.request({ 
          method: 'wallet_requestPermissions',
          params: [{ eth_accounts: {} }]
        });
        await window.ethereum.request({ method: 'eth_requestAccounts' });
        
        await silentConnect();
        return true; 
      } catch (error) {
        console.error("连接钱包失败:", error);
        return false;
      }
    } else {
      alert("请安装 MetaMask 钱包插件！");
      return false;
    }
  };

  const handleDisconnect = () => {
    setWalletAddress(null);
    setSigner(null);
    setContract(null);
  };

  useEffect(() => {
    silentConnect();
  }, [silentConnect]);

  // ==========================================
  // Web3 核心逻辑：上传成绩到链上
  // ==========================================
  const handleUploadToChain = async () => {
    if (!contract || !walletAddress) {
      setShowConnectPrompt(true);
      return;
    }
    
    try {
      setUploadStatus('uploading');
      
      const tx = await contract.submitScore(
        latestStats.current.size, 
        latestStats.current.moves, 
        latestStats.current.time
      );
      
      await tx.wait();
      setUploadStatus('success');
      
      setRecords(prev => {
        const newRecords = [...prev];
        if (newRecords.length > 0) {
          newRecords[0].uploaded = true; 
        }
        return newRecords;
      });
      
    } catch (error) {
      console.error("上链失败:", error);
      setUploadStatus('error');
      setTimeout(() => setUploadStatus('idle'), 3000);
    }
  };

  // ==========================================
  // Web3 核心逻辑：读取链上排行榜
  // ==========================================
  const fetchLeaderboardData = async () => {
    try {
      setIsFetchingBoard(true);
      
      let currentProvider = provider;
      if (!currentProvider && window.ethereum) {
        currentProvider = new ethers.BrowserProvider(window.ethereum);
      }
      if (!currentProvider) {
        setIsFetchingBoard(false);
        return;
      }

      const readOnlyContract = contract || new ethers.Contract(CONTRACT_ADDRESS, CONTRACT_ABI, currentProvider);
      const data = await readOnlyContract.getLatestScores(50);
      
      const parsedData = data.map((item, index) => {
        const date = new Date(Number(item.timestamp) * 1000);
        const formattedDate = `${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
        
        return {
          id: index + 1,
          address: formatAddress(item.player),
          rawAddress: item.player,
          size: Number(item.gridSize),
          moves: Number(item.moves),
          time: Number(item.timeSeconds),
          date: formattedDate
        };
      });
      
      parsedData.sort((a, b) => {
        if (a.moves !== b.moves) return a.moves - b.moves;
        return a.time - b.time;
      });
      
      const rankedData = parsedData.map((item, idx) => ({ ...item, id: idx + 1 }));
      setOnChainLeaderboard(rankedData);
    } catch (error) {
      console.error("获取榜单失败:", error);
    } finally {
      setIsFetchingBoard(false);
    }
  };

  useEffect(() => {
    if (window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts) => {
        if (accounts.length > 0) {
          silentConnect(); 
        } else {
          handleDisconnect();
        }
      });
    }
  }, [silentConnect]);

  useEffect(() => {
    if (showLeaderboard) {
      fetchLeaderboardData();
    }
  }, [showLeaderboard]);

  // ==========================================
  // 游戏核心逻辑
  // ==========================================
  const resetBoardToOrdered = useCallback((currentSize) => {
    const totalTiles = currentSize * currentSize;
    let newBoard = Array.from({ length: totalTiles - 1 }, (_, i) => i + 1);
    newBoard.push(0);
    setBoard(newBoard);
    setMoves(0);
    setTime(0);
    setIsSolved(false);
    setIsPlaying(false);
    setUploadStatus('idle');
  }, []);

  const startGame = useCallback((currentSize = size) => {
    const totalTiles = currentSize * currentSize;
    let newBoard = Array.from({ length: totalTiles - 1 }, (_, i) => i + 1);
    newBoard.push(0);

    let emptyIdx = totalTiles - 1;
    let prevIdx = -1;

    for (let i = 0; i < 1000; i++) {
      const validMoves = [];
      const row = Math.floor(emptyIdx / currentSize);
      const col = emptyIdx % currentSize;

      if (row > 0) validMoves.push(emptyIdx - currentSize);
      if (row < currentSize - 1) validMoves.push(emptyIdx + currentSize);
      if (col > 0) validMoves.push(emptyIdx - 1);
      if (col < currentSize - 1) validMoves.push(emptyIdx + 1);

      const filteredMoves = validMoves.filter((m) => m !== prevIdx);
      const movesToUse = filteredMoves.length > 0 ? filteredMoves : validMoves;
      const randomMove = movesToUse[Math.floor(Math.random() * movesToUse.length)];

      [newBoard[emptyIdx], newBoard[randomMove]] = [newBoard[randomMove], newBoard[emptyIdx]];
      prevIdx = emptyIdx;
      emptyIdx = randomMove;
    }

    setBoard(newBoard);
    setMoves(0);
    setTime(0);
    setIsSolved(false);
    setIsPlaying(true);
    setUploadStatus('idle');
  }, [size]);

  const handleStartGameClick = useCallback(() => {
    if (!walletAddress) {
      setShowConnectPrompt(true);
    } else {
      startGame(size);
    }
  }, [walletAddress, size, startGame]);

  const checkWin = useCallback((currentBoard) => {
    for (let i = 0; i < currentBoard.length - 1; i++) {
      if (currentBoard[i] !== i + 1) return false;
    }
    if (currentBoard[currentBoard.length - 1] === 0) {
      setIsSolved(true);
      setIsPlaying(false);
      return true;
    }
    return false;
  }, []);

  const moveTile = useCallback((targetIdx) => {
    if (isSolved || !isPlaying) return;

    setBoard((prevBoard) => {
      const emptyIdx = prevBoard.indexOf(0);
      const newBoard = [...prevBoard];

      const isAdjacent =
        (Math.abs(emptyIdx - targetIdx) === 1 && Math.floor(emptyIdx / size) === Math.floor(targetIdx / size)) ||
        Math.abs(emptyIdx - targetIdx) === size;

      if (isAdjacent) {
        [newBoard[emptyIdx], newBoard[targetIdx]] = [newBoard[targetIdx], newBoard[emptyIdx]];
        setMoves((m) => m + 1);
        checkWin(newBoard);
      }
      return newBoard;
    });
  }, [size, isSolved, isPlaying, checkWin]);

  const moveTileByKey = useCallback((key) => {
    if (!isPlaying || isSolved) return;
    
    setBoard((prevBoard) => {
      const emptyIdx = prevBoard.indexOf(0);
      const row = Math.floor(emptyIdx / size);
      const col = emptyIdx % size;
      let targetIdx = -1;

      if (key === "ArrowUp" && row < size - 1) targetIdx = emptyIdx + size;
      else if (key === "ArrowDown" && row > 0) targetIdx = emptyIdx - size;
      else if (key === "ArrowLeft" && col < size - 1) targetIdx = emptyIdx + 1;
      else if (key === "ArrowRight" && col > 0) targetIdx = emptyIdx - 1;

      if (targetIdx !== -1) {
        const newBoard = [...prevBoard];
        [newBoard[emptyIdx], newBoard[targetIdx]] = [newBoard[targetIdx], newBoard[emptyIdx]];
        setMoves((m) => m + 1);
        checkWin(newBoard);
        return newBoard;
      }
      return prevBoard;
    });
  }, [size, isPlaying, isSolved, checkWin]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (showSettings || showRecords || showLeaderboard || showConnectPrompt) return; 
      
      if (e.code === 'Space') {
        e.preventDefault();
        if (!isPlaying && !isSolved) {
          handleStartGameClick();
        }
        return;
      }

      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        if (!isPlaying || isSolved) return;
        e.preventDefault();
        moveTileByKey(e.key);
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [moveTileByKey, showSettings, showRecords, showLeaderboard, showConnectPrompt, isPlaying, isSolved, handleStartGameClick]);

  useEffect(() => {
    let timer;
    if (isPlaying && !isSolved && !showSettings && !showRecords && !showLeaderboard) {
      timer = setInterval(() => setTime((t) => t + 1), 1000);
    }
    return () => clearInterval(timer);
  }, [isPlaying, isSolved, showSettings, showRecords, showLeaderboard]);

  useEffect(() => {
    latestStats.current = { moves, time, size };
  }, [moves, time, size]);

  useEffect(() => {
    if (isSolved) {
      const now = new Date();
      const formattedDate = `${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')} ${now.getHours().toString().padStart(2, '0')}:${now.getMinutes().toString().padStart(2, '0')}`;

      setRecords(prev => [{
        id: Date.now(),
        moves: latestStats.current.moves,
        time: latestStats.current.time,
        size: latestStats.current.size,
        date: formattedDate,
        uploaded: false
      }, ...prev]);
      
      const timer = setTimeout(() => {
        setShowRecords(true);
      }, 500);
      return () => clearTimeout(timer);
    }
  }, [isSolved]);

  useEffect(() => {
    resetBoardToOrdered(size);
  }, [size, resetBoardToOrdered]);

  const formatTime = (seconds) => {
    const m = Math.floor(seconds / 60).toString();
    const s = (seconds % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleTouchStart = (e) => {
    touchStart.current = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  };

  const handleTouchEnd = (e) => {
    if (!touchStart.current.x || !touchStart.current.y || showSettings || showRecords || showLeaderboard || showConnectPrompt || !isPlaying) return;
    const dx = e.changedTouches[0].clientX - touchStart.current.x;
    const dy = e.changedTouches[0].clientY - touchStart.current.y;

    if (Math.abs(dx) > Math.abs(dy)) {
      if (Math.abs(dx) > 30) dx > 0 ? moveTileByKey("ArrowRight") : moveTileByKey("ArrowLeft");
    } else {
      if (Math.abs(dy) > 30) dy > 0 ? moveTileByKey("ArrowDown") : moveTileByKey("ArrowUp");
    }
    touchStart.current = { x: null, y: null };
  };

  // ==========================================
  // UI 渲染辅助
  // ==========================================
  const rgbStr = hexToRgb(themeColor);
  const themeDark = darken(themeColor, 0.25);
  const themeTileBorder = darken(themeColor, 0.12);
  const customCSS = {
    '--theme-main': themeColor,
    '--theme-dark': themeDark,
    '--theme-tile-border': themeTileBorder,
    '--theme-bg': `rgba(${rgbStr}, 0.04)`,
    '--theme-light': `rgba(${rgbStr}, 0.15)`,
    '--theme-border': `rgba(${rgbStr}, 0.4)`,
    '--theme-shadow-lg': `rgba(${rgbStr}, 0.3)`,
    '--theme-shadow-md': `rgba(${rgbStr}, 0.5)`,
  };

  const isWaitingToStart = !isPlaying && !isSolved;

  const FilterRow = () => (
    <div className="flex items-center gap-3 md:gap-4 mb-4 overflow-x-auto pb-2 scrollbar-hide">
      <div className="flex items-center gap-1 text-xs font-medium flex-shrink-0" style={{ color: 'var(--theme-dark)' }}>
        <span className="opacity-60">难度</span> 
        <div className="flex items-center gap-1 border rounded px-2 py-0.5 relative" style={{ borderColor: 'var(--theme-border)' }}>
          <select 
            value={filterSize}
            onChange={(e) => setFilterSize(e.target.value === 'all' ? 'all' : Number(e.target.value))}
            className="appearance-none bg-transparent outline-none font-bold pr-4 cursor-pointer z-10"
            style={{ color: 'var(--theme-dark)' }}
          >
            <option value="all">全部</option>
            <option value="3">3x3</option>
            <option value="4">4x4</option>
            <option value="5">5x5</option>
          </select>
          <ChevronDown size={12} className="opacity-60 absolute right-1 pointer-events-none z-0" />
        </div>
      </div>
    </div>
  );

  return (
    <div 
      className="min-h-screen text-slate-800 font-sans flex flex-col relative pb-10 transition-colors duration-300"
      style={{ ...customCSS, backgroundColor: 'var(--theme-bg)' }}
    >
      {/* 顶部悬浮钱包栏 */}
      <div 
        className="absolute top-4 right-4 md:top-6 md:right-8 bg-white/80 backdrop-blur-sm border rounded-full px-4 py-2 flex items-center gap-3 shadow-sm text-xs font-medium transition-colors duration-300"
        style={{ borderColor: 'var(--theme-border)', color: 'var(--theme-dark)' }}
      >
        {walletAddress ? (
          <>
            <span className="font-mono">{formatAddress(walletAddress)}</span>
            <span className="w-1 h-1 rounded-full" style={{ backgroundColor: 'var(--theme-main)' }}></span>
            <span>{CHAIN_NAME}</span>
            <button 
              onClick={handleDisconnect}
              className="px-3 py-1 rounded-full transition-colors font-bold hover:brightness-95"
              style={{ backgroundColor: 'var(--theme-light)', color: 'var(--theme-dark)' }}
            >
              断开
            </button>
          </>
        ) : (
          <button 
            onClick={connectWallet}
            className="px-4 py-1.5 rounded-full transition-all font-bold hover:scale-105 active:scale-95"
            style={{ backgroundColor: 'var(--theme-main)', color: '#1e293b', boxShadow: '0 2px 8px var(--theme-shadow-lg)' }}
          >
            连接钱包
          </button>
        )}
      </div>

      {/* 游戏主体卡片 */}
      <div 
        className="max-w-[800px] w-full mx-auto mt-20 md:mt-24 bg-white rounded-[2rem] p-6 md:p-10 border transition-all duration-300"
        style={{ borderColor: 'var(--theme-light)', boxShadow: '0 8px 30px var(--theme-shadow-lg)' }}
      >
        {/* Header区 */}
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-6">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-3xl md:text-4xl font-black tracking-wide transition-colors duration-300" style={{ color: 'var(--theme-dark)' }}>
                数字华容道
              </h1>
              <span 
                className="text-slate-800 text-[10px] px-2 py-0.5 rounded-full italic font-bold tracking-wider transition-colors duration-300"
                style={{ backgroundColor: 'var(--theme-main)' }}
              >
                ON-CHAIN
              </span>
            </div>
            <p className="text-xs md:text-sm tracking-[0.2em] font-bold uppercase mt-2 opacity-70 transition-colors duration-300" style={{ color: 'var(--theme-dark)' }}>
              DIGITAL KLOTSKI
            </p>
          </div>

          <div className="flex flex-col items-end gap-2">
            <div 
              className="border rounded-full px-5 py-1.5 flex items-center gap-2 transition-colors duration-300"
              style={{ backgroundColor: 'var(--theme-light)', borderColor: 'var(--theme-main)', color: 'var(--theme-dark)' }}
            >
              <span className="text-sm font-medium">步数</span>
              <span className="text-2xl font-black">{moves}</span>
            </div>
            <div className="flex gap-2">
              <div 
                className="border rounded-full px-4 py-1 text-xs font-medium bg-white transition-colors duration-300"
                style={{ borderColor: 'var(--theme-main)', color: 'var(--theme-dark)' }}
              >
                时长 · {formatTime(time)}
              </div>
              <div 
                className="border rounded-full px-4 py-1 text-xs font-medium bg-white transition-colors duration-300"
                style={{ borderColor: 'var(--theme-main)', color: 'var(--theme-dark)' }}
              >
                难度 · {getDifficultyText(size)}
              </div>
            </div>
          </div>
        </div>

        {/* 规则提示 */}
        <div 
          className="w-full border rounded-2xl p-4 md:p-5 mb-8 transition-colors duration-300"
          style={{ background: `linear-gradient(to right, var(--theme-light), white)`, borderColor: 'var(--theme-border)' }}
        >
          <h2 className="font-bold text-base md:text-lg transition-colors duration-300" style={{ color: 'var(--theme-dark)' }}>用最少步数恢复全部数字的顺序</h2>
          <p className="text-xs md:text-sm mt-1 opacity-80 font-medium transition-colors duration-300" style={{ color: 'var(--theme-dark)' }}>
            点击相邻格子或使用键盘方向键，使数字从左到右、从上到下依次排列 (最后一个格子留空)
          </p>
        </div>

        {/* 大棋盘区 */}
        <div className="flex justify-center mb-10">
          <div 
            className="w-full max-w-[500px] border rounded-[2.5rem] p-6 md:p-8 flex items-center justify-center relative transition-colors duration-300"
            style={{ backgroundColor: 'var(--theme-light)', borderColor: 'var(--theme-border)' }}
          >
            {isWaitingToStart && (
              <div className="absolute inset-0 z-10 bg-white/40 backdrop-blur-[2px] rounded-[2.5rem] flex flex-col items-center justify-center">
                <button 
                  onClick={handleStartGameClick}
                  className="px-8 py-4 text-slate-800 text-xl font-black rounded-2xl hover:scale-105 active:scale-95 transition-all duration-200"
                  style={{ backgroundColor: 'var(--theme-main)', boxShadow: '0 8px 20px var(--theme-shadow-md)' }}
                >
                  开始游戏
                </button>
                <p className="mt-4 font-bold opacity-70 tracking-widest text-sm" style={{ color: 'var(--theme-dark)' }}>按 [空格键] 快速开始</p>
              </div>
            )}

            {isSolved && (
              <div className="absolute inset-0 z-10 bg-white/80 backdrop-blur-sm rounded-[2.5rem] flex flex-col items-center justify-center animate-in fade-in zoom-in duration-300">
                <h2 className="text-4xl font-black mb-2 drop-shadow-md" style={{ color: 'var(--theme-dark)' }}>成功解锁!</h2>
                <p className="font-bold mb-6" style={{ color: 'var(--theme-dark)' }}>完美还原了 {size}x{size} 矩阵</p>
                <button 
                  onClick={() => resetBoardToOrdered(size)}
                  className="px-8 py-3 text-slate-800 font-bold rounded-xl hover:-translate-y-1 active:translate-y-0 transition-all duration-200"
                  style={{ backgroundColor: 'var(--theme-main)', boxShadow: '0 4px 14px var(--theme-shadow-md)' }}
                >
                  再来一局
                </button>
              </div>
            )}

            <div 
              className="grid gap-2 md:gap-3 w-full aspect-square touch-none select-none"
              style={{ gridTemplateColumns: `repeat(${size}, minmax(0, 1fr))` }}
              onTouchStart={handleTouchStart}
              onTouchEnd={handleTouchEnd}
            >
              {board.map((tile, index) => {
                const isEmpty = tile === 0;
                return (
                  <div
                    key={index}
                    onClick={() => moveTile(index)}
                    className={`
                      flex items-center justify-center rounded-2xl md:rounded-3xl font-black
                      transition-all duration-200 ease-in-out text-2xl md:text-4xl
                      ${isEmpty 
                        ? 'border-2 text-transparent cursor-default' 
                        : 'text-slate-800 border-b-[4px] hover:brightness-105 active:border-b-0 active:translate-y-1 cursor-pointer'
                      }
                    `}
                    style={isEmpty ? {
                      backgroundColor: 'var(--theme-light)',
                      borderColor: 'var(--theme-border)'
                    } : {
                      backgroundColor: 'var(--theme-main)',
                      borderColor: 'var(--theme-tile-border)',
                      boxShadow: '0 6px 16px var(--theme-shadow-md)',
                      fontSize: size >= 5 ? '1.5rem' : '' 
                    }}
                  >
                    {!isEmpty ? tile : ""}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* 底部功能菜单 */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 md:gap-4">
          <button 
            onClick={() => isWaitingToStart ? handleStartGameClick() : resetBoardToOrdered(size)}
            className="col-span-2 md:col-span-1 text-slate-800 rounded-2xl py-3.5 px-4 font-bold hover:brightness-105 active:scale-95 transition-all duration-200 focus:outline-none"
            style={{ backgroundColor: 'var(--theme-main)', boxShadow: '0 4px 14px var(--theme-shadow-md)' }}
          >
            {isWaitingToStart ? '开始游戏' : '重新打乱'}
          </button>
          <button 
            onClick={() => setShowRecords(true)}
            className="col-span-1 border-2 rounded-2xl py-3.5 px-4 font-bold active:scale-95 transition-all hover:bg-slate-50"
            style={showRecords ? {
              backgroundColor: 'var(--theme-main)',
              color: '#1e293b',
              borderColor: 'var(--theme-main)',
              boxShadow: '0 4px 14px var(--theme-shadow-md)'
            } : {
              backgroundColor: 'white',
              borderColor: 'var(--theme-main)',
              color: 'var(--theme-dark)'
            }}
          >
            对局记录
          </button>
          <button 
            onClick={() => setShowLeaderboard(true)}
            className="col-span-1 border-2 rounded-2xl py-3.5 px-4 font-bold active:scale-95 transition-all hover:bg-slate-50"
            style={showLeaderboard ? {
              backgroundColor: 'var(--theme-main)',
              color: '#1e293b',
              borderColor: 'var(--theme-main)',
              boxShadow: '0 4px 14px var(--theme-shadow-md)'
            } : {
              backgroundColor: 'white',
              borderColor: 'var(--theme-main)',
              color: 'var(--theme-dark)'
            }}
          >
            链上榜
          </button>
          <button 
            onClick={() => setShowSettings(true)}
            className="col-span-2 md:col-span-1 border-2 rounded-2xl py-3.5 px-4 font-bold active:scale-95 transition-all hover:bg-slate-50"
            style={showSettings ? {
              backgroundColor: 'var(--theme-main)',
              color: '#1e293b',
              borderColor: 'var(--theme-main)',
              boxShadow: '0 4px 14px var(--theme-shadow-md)'
            } : {
              backgroundColor: 'white',
              borderColor: 'var(--theme-main)',
              color: 'var(--theme-dark)'
            }}
          >
            设置
          </button>
        </div>

      </div>

      <div className="mt-8 text-center flex items-center justify-center gap-2 text-[10px] md:text-xs font-bold tracking-wider opacity-60 transition-colors duration-300" style={{ color: 'var(--theme-dark)' }}>
        <span>© 2026 NOVUS</span>
        <span>•</span>
        <span>ON-CHAIN PUZZLE</span>
        <span>•</span>
        <Github size={14} className="ml-1" />
        <span>GITHUB</span>
      </div>

      {/* ======================= 所有弹窗组件 ======================= */}
      
      {/* 提示：连接钱包弹窗 */}
      {showConnectPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
           <div 
            className="bg-white rounded-2xl w-full max-w-sm p-8 text-center border animate-in fade-in zoom-in duration-200"
            style={{ borderColor: 'var(--theme-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
          >
            <h3 className="font-bold text-xl tracking-wider mb-2" style={{ color: 'var(--theme-dark)' }}>连接钱包开始游戏</h3>
            <p className="text-sm font-medium opacity-60 mb-8" style={{ color: 'var(--theme-dark)' }}>请先连接钱包，才能开始对局</p>
            <button 
              onClick={async () => {
                const success = await connectWallet();
                if (success) {
                  setShowConnectPrompt(false);
                  // 移除自动开始的代码，让玩家连接完自己点开始
                }
              }}
              className="w-full py-3.5 text-slate-800 text-sm border font-bold rounded-xl hover:brightness-95 active:scale-95 transition-all duration-200"
              style={{ borderColor: 'var(--theme-main)', color: 'var(--theme-main)' }}
            >
              唤起钱包
            </button>
            <button 
              onClick={() => setShowConnectPrompt(false)}
              className="mt-4 text-xs font-bold opacity-50 hover:opacity-100 transition-opacity" style={{ color: 'var(--theme-dark)' }}
            >
              取消
            </button>
          </div>
        </div>
      )}

      {/* 设置弹窗 */}
      {showSettings && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div 
            className="bg-white rounded-3xl w-full max-w-lg p-8 border animate-in fade-in zoom-in duration-200"
            style={{ borderColor: 'var(--theme-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
          >
            <div className="flex justify-between items-center mb-8">
              <h3 className="font-bold text-xl tracking-wider" style={{ color: 'var(--theme-dark)' }}>设置</h3>
              <button onClick={() => setShowSettings(false)} className="text-sm font-bold opacity-70 hover:opacity-100 transition-opacity" style={{ color: 'var(--theme-dark)' }}>
                关闭
              </button>
            </div>

            <div className="mb-8">
              <h4 className="font-bold text-sm mb-3" style={{ color: 'var(--theme-dark)' }}>主题颜色</h4>
              <div className="flex items-center gap-4">
                <div 
                  className="w-12 h-12 rounded-xl border-2 flex items-center justify-center overflow-hidden focus-within:ring-4 ring-opacity-50 transition-all cursor-pointer relative"
                  style={{ borderColor: 'var(--theme-main)', backgroundColor: 'var(--theme-light)' }}
                >
                  <input
                    type="color"
                    value={themeColor}
                    onChange={(e) => setThemeColor(e.target.value)}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="w-8 h-8 rounded-lg shadow-inner" style={{ backgroundColor: 'var(--theme-main)' }}></div>
                </div>
                <span className="text-sm font-mono font-bold px-3 py-1.5 rounded-lg border border-dashed" style={{ color: 'var(--theme-dark)', borderColor: 'var(--theme-border)', backgroundColor: 'var(--theme-light)' }}>
                  {themeColor.toUpperCase()}
                </span>
              </div>
            </div>

            <div>
              <h4 className="font-bold text-sm mb-3" style={{ color: 'var(--theme-dark)' }}>难度</h4>
              <div className="flex flex-wrap gap-3">
                {[
                  { s: 3, label: '入门' },
                  { s: 4, label: '简单' },
                  { s: 5, label: '标准' }
                ].map((item) => (
                  <button
                    key={item.s}
                    onClick={() => { setSize(item.s); }}
                    className="px-5 py-2.5 rounded-xl text-sm font-bold border-2 transition-all"
                    style={size === item.s 
                      ? { backgroundColor: 'var(--theme-main)', color: '#1e293b', borderColor: 'var(--theme-main)', boxShadow: '0 4px 10px var(--theme-shadow-lg)' }
                      : { backgroundColor: 'white', color: 'var(--theme-dark)', borderColor: 'var(--theme-main)' }
                    }
                  >
                    {item.label} · {item.s}x{item.s}
                  </button>
                ))}
              </div>
              <p className="text-[11px] mt-3 font-medium opacity-60" style={{ color: 'var(--theme-dark)' }}>切换难度后需要重新点击开始游戏</p>
            </div>
          </div>
        </div>
      )}

      {/* 链上榜弹窗 */}
      {showLeaderboard && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div 
            className="bg-white rounded-3xl w-full max-w-lg p-6 md:p-8 border animate-in fade-in zoom-in duration-200"
            style={{ borderColor: 'var(--theme-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-xl tracking-wider mb-2" style={{ color: 'var(--theme-dark)' }}>链上榜</h3>
                <p className="text-[11px] font-medium opacity-60" style={{ color: 'var(--theme-dark)' }}>最少步数优先 · 时间次之 · 仅展示前 50 名</p>
              </div>
              <button onClick={() => setShowLeaderboard(false)} className="text-sm font-bold opacity-70 hover:opacity-100 transition-opacity" style={{ color: 'var(--theme-dark)' }}>
                关闭
              </button>
            </div>

            <FilterRow />

            <div className="max-h-[50vh] overflow-y-auto pr-1 space-y-3 scrollbar-hide">
              {isFetchingBoard ? (
                <p className="text-center py-8 opacity-50 font-medium" style={{ color: 'var(--theme-dark)' }}>加载链上数据中...</p>
              ) : onChainLeaderboard.filter(item => filterSize === 'all' || item.size === filterSize).length === 0 ? (
                <p className="text-center py-8 opacity-50 font-medium" style={{ color: 'var(--theme-dark)' }}>暂无数据</p>
              ) : (
                onChainLeaderboard
                  .filter(item => filterSize === 'all' || item.size === filterSize)
                  .map((item) => (
                  <div 
                    key={item.id} 
                    className="p-4 rounded-2xl border flex flex-col gap-1 transition-all"
                    style={{ backgroundColor: 'var(--theme-bg)', borderColor: 'var(--theme-border)' }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 font-black text-base md:text-lg" style={{ color: 'var(--theme-dark)' }}>
                        <span style={{ color: 'var(--theme-main)' }}>#{item.id}</span>
                        <span>{item.address}</span>
                        <span className="text-sm font-bold opacity-70" style={{ color: 'var(--theme-main)' }}>{item.size}x{item.size}</span>
                      </div>
                      <div className="font-black text-base md:text-lg" style={{ color: 'var(--theme-main)' }}>{item.moves} 步</div>
                    </div>
                    <div className="text-[11px] md:text-xs font-bold opacity-60 flex items-center gap-1 flex-wrap mt-1" style={{ color: 'var(--theme-dark)' }}>
                      <span>用时 {formatTime(item.time)}</span> · 
                      <span>{item.date}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* 对局记录与上链弹窗 */}
      {showRecords && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm px-4">
          <div 
            className="bg-white rounded-3xl w-full max-w-lg p-6 md:p-8 border animate-in fade-in zoom-in duration-200"
            style={{ borderColor: 'var(--theme-border)', boxShadow: '0 20px 40px rgba(0,0,0,0.1)' }}
          >
            <div className="flex justify-between items-start mb-6">
              <div>
                <h3 className="font-bold text-xl tracking-wider mb-2" style={{ color: 'var(--theme-dark)' }}>
                  {isSolved ? '🎉 挑战成功' : '对局记录'}
                </h3>
                {!isSolved && (
                  <p className="text-[11px] font-medium opacity-60" style={{ color: 'var(--theme-dark)' }}>仅展示当前浏览器的本地对局记录 · 按时间倒序展示</p>
                )}
              </div>
              <button onClick={() => setShowRecords(false)} className="text-sm font-bold opacity-70 hover:opacity-100 transition-opacity" style={{ color: 'var(--theme-dark)' }}>
                关闭
              </button>
            </div>

            {/* 钱包详情信息卡片 */}
            {!isSolved && walletAddress && (
              <div 
                className="p-4 rounded-2xl border mb-5 text-[11px] md:text-xs font-mono space-y-2 relative" 
                style={{ backgroundColor: 'var(--theme-light)', borderColor: 'var(--theme-border)', color: 'var(--theme-dark)' }}
              >
                <div className="flex justify-between items-center">
                  <div><span className="opacity-60 font-sans mr-2">钱包:</span><span className="font-bold text-[13px]">{walletAddress}</span></div>
                  <button 
                    onClick={handleDisconnect}
                    className="font-sans font-bold hover:underline absolute right-4 top-4"
                  >
                    断开
                  </button>
                </div>
                <div><span className="opacity-60 font-sans mr-2">网络:</span> {CHAIN_NAME} ({CHAIN_ID})</div>
                <div className="truncate"><span className="opacity-60 font-sans mr-2">合约:</span> {CONTRACT_ADDRESS}</div>
              </div>
            )}

            {!isSolved && <FilterRow />}

            <div className="max-h-[40vh] overflow-y-auto pr-1 space-y-3 scrollbar-hide">
              {records.filter(record => filterSize === 'all' || record.size === filterSize).length === 0 ? (
                <p className="text-center py-8 opacity-50 font-medium" style={{ color: 'var(--theme-dark)' }}>暂无记录</p>
              ) : (
                records
                  .filter(record => filterSize === 'all' || record.size === filterSize)
                  .map((record, idx) => (
                  <div 
                    key={record.id} 
                    className="p-4 rounded-2xl border flex flex-col gap-1 transition-all"
                    style={{ 
                      backgroundColor: idx === 0 && isSolved ? 'var(--theme-light)' : 'var(--theme-bg)',
                      borderColor: idx === 0 && isSolved ? 'var(--theme-main)' : 'var(--theme-border)'
                    }}
                  >
                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2 font-black text-base md:text-lg" style={{ color: 'var(--theme-dark)' }}>
                        <span className="text-sm opacity-80">{getDifficultyText(record.size)}</span>
                        <span>{record.size}x{record.size}</span>
                        <span style={{ color: 'var(--theme-main)' }}>{record.moves} 步</span>
                        {record.uploaded && (
                           <span className="text-[10px] px-2 py-0.5 rounded-full border bg-white" style={{ borderColor: 'var(--theme-main)', color: 'var(--theme-main)' }}>已上链</span>
                        )}
                      </div>
                      <div className="text-xs md:text-sm font-bold opacity-80" style={{ color: 'var(--theme-main)' }}>
                        {record.date}
                      </div>
                    </div>
                    <div className="text-[11px] md:text-xs font-bold opacity-60 mt-1" style={{ color: 'var(--theme-dark)' }}>
                      用时 {formatTime(record.time)}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* 上链按钮 */}
            {isSolved && (
              <div className="mt-6 flex flex-col md:flex-row gap-3">
                <button 
                  onClick={handleUploadToChain}
                  disabled={uploadStatus !== 'idle'}
                  className="flex-1 py-4 text-slate-800 text-base font-black rounded-xl hover:brightness-105 active:scale-95 transition-all duration-200 disabled:opacity-50 disabled:active:scale-100 flex items-center justify-center gap-2"
                  style={uploadStatus === 'error' 
                    ? { backgroundColor: '#fee2e2', border: '2px solid #ef4444', color: '#ef4444' } 
                    : { backgroundColor: 'white', border: '2px solid var(--theme-main)', color: 'var(--theme-main)' }}
                >
                  {uploadStatus === 'idle' && '⛓️ 上传成绩到链上'}
                  {uploadStatus === 'uploading' && '钱包确认中...'}
                  {uploadStatus === 'success' && '✅ 上链成功'}
                  {uploadStatus === 'error' && '❌ 交易失败'}
                </button>
                <button 
                  onClick={() => {
                    setShowRecords(false);
                    resetBoardToOrdered(size);
                  }}
                  className="flex-1 py-4 text-slate-800 text-base font-black rounded-xl hover:brightness-105 active:scale-95 transition-all duration-200"
                  style={{ backgroundColor: 'var(--theme-main)', boxShadow: '0 4px 14px var(--theme-shadow-md)' }}
                >
                  再来一局
                </button>
              </div>
            )}
          </div>
        </div>
      )}

    </div>
  );
};

export default App;