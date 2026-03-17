// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

/// @title KlotskiLeaderboard - 数字华容道链上排行榜 (优化版)
/// @notice 存储玩家提交的游戏成绩，支持分页读取排行榜防止节点超时
contract KlotskiLeaderboard {
    struct ScoreEntry {
        address player;
        uint8 gridSize; // 3, 4, or 5
        uint32 moves;
        uint32 timeSeconds;
        uint64 timestamp;
    }

    ScoreEntry[] private _scores;

    event ScoreSubmitted(
        address indexed player,
        uint8 indexed gridSize,
        uint32 moves,
        uint32 timeSeconds,
        uint64 timestamp
    );

    error InvalidGridSize(uint8 gridSize);
    error InvalidMoves();
    error InvalidTime();
    error OutOfBounds();

    /// @notice 提交游戏成绩到链上
    /// @dev 生产环境中建议在此处增加 EIP-712 签名验证，防止黑客伪造超神成绩
    function submitScore(
        uint8 gridSize,
        uint32 moves,
        uint32 timeSeconds
    ) external {
        if (gridSize < 3 || gridSize > 5) revert InvalidGridSize(gridSize);
        if (moves == 0) revert InvalidMoves();
        if (timeSeconds == 0) revert InvalidTime();

        uint64 ts = uint64(block.timestamp);
        _scores.push(
            ScoreEntry({
                player: msg.sender,
                gridSize: gridSize,
                moves: moves,
                timeSeconds: timeSeconds,
                timestamp: ts
            })
        );

        emit ScoreSubmitted(msg.sender, gridSize, moves, timeSeconds, ts);
    }

    /// @notice 获取成绩总数
    function getScoresCount() external view returns (uint256) {
        return _scores.length;
    }

    /// @notice 分页获取所有成绩 (防止数据量过大导致 RPC 崩溃)
    /// @param offset 起始索引
    /// @param limit 读取数量
    function getScoresPaginated(
        uint256 offset,
        uint256 limit
    ) external view returns (ScoreEntry[] memory) {
        uint256 totalLength = _scores.length;
        if (offset >= totalLength) revert OutOfBounds();

        uint256 end = offset + limit;
        if (end > totalLength) {
            end = totalLength;
        }

        uint256 resultSize = end - offset;
        ScoreEntry[] memory result = new ScoreEntry[](resultSize);

        for (uint256 i = 0; i < resultSize; i++) {
            result[i] = _scores[offset + i];
        }

        return result;
    }

    /// @notice 配合前端: 逆序分页获取最新成绩 (适合展示最新上链记录)
    function getLatestScores(
        uint256 limit
    ) external view returns (ScoreEntry[] memory) {
        uint256 totalLength = _scores.length;
        if (totalLength == 0) return new ScoreEntry[](0);

        uint256 resultSize = totalLength < limit ? totalLength : limit;
        ScoreEntry[] memory result = new ScoreEntry[](resultSize);

        for (uint256 i = 0; i < resultSize; i++) {
            // 从后往前取
            result[i] = _scores[totalLength - 1 - i];
        }

        return result;
    }
}
