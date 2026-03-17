// ABI for KlotskiLeaderboard contract
// Generated from: src/KlotskiLeaderboard.sol
export const KLOTSKI_ABI = [
  {
    type: "function",
    name: "submitScore",
    inputs: [
      { name: "gridSize", type: "uint8" },
      { name: "moves", type: "uint32" },
      { name: "timeSeconds", type: "uint32" },
    ],
    outputs: [],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "getScores",
    inputs: [],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "gridSize", type: "uint8" },
          { name: "moves", type: "uint32" },
          { name: "timeSeconds", type: "uint32" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getScoresBySize",
    inputs: [{ name: "gridSize", type: "uint8" }],
    outputs: [
      {
        name: "",
        type: "tuple[]",
        components: [
          { name: "player", type: "address" },
          { name: "gridSize", type: "uint8" },
          { name: "moves", type: "uint32" },
          { name: "timeSeconds", type: "uint32" },
          { name: "timestamp", type: "uint64" },
        ],
      },
    ],
    stateMutability: "view",
  },
  {
    type: "function",
    name: "getScoresCount",
    inputs: [],
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
  },
  {
    type: "event",
    name: "ScoreSubmitted",
    inputs: [
      { name: "player", type: "address", indexed: true },
      { name: "gridSize", type: "uint8", indexed: true },
      { name: "moves", type: "uint32", indexed: false },
      { name: "timeSeconds", type: "uint32", indexed: false },
      { name: "timestamp", type: "uint64", indexed: false },
    ],
  },
  {
    type: "error",
    name: "InvalidGridSize",
    inputs: [{ name: "gridSize", type: "uint8" }],
  },
  {
    type: "error",
    name: "InvalidMoves",
    inputs: [],
  },
  {
    type: "error",
    name: "InvalidTime",
    inputs: [],
  },
];
