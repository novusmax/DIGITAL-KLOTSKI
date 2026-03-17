// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Test, console} from "forge-std/Test.sol";
import {KlotskiLeaderboard} from "../src/KlotskiLeaderboard.sol";

contract KlotskiLeaderboardTest is Test {
    KlotskiLeaderboard public leaderboard;
    address player1 = address(0x1);
    address player2 = address(0x2);
    address player3 = address(0x3);

    function setUp() public {
        leaderboard = new KlotskiLeaderboard();
    }

    /* ========================================================================= */
    /* 提交成绩测试                                  */
    /* ========================================================================= */

    function test_SubmitScore() public {
        vm.prank(player1);
        leaderboard.submitScore(3, 10, 25);

        assertEq(leaderboard.getScoresCount(), 1);

        // 使用新的分页接口读取第一条数据
        KlotskiLeaderboard.ScoreEntry[] memory scores = leaderboard.getScoresPaginated(0, 1);
        assertEq(scores.length, 1);
        assertEq(scores[0].player, player1);
        assertEq(scores[0].gridSize, 3);
        assertEq(scores[0].moves, 10);
        assertEq(scores[0].timeSeconds, 25);
        assertEq(scores[0].timestamp, block.timestamp);
    }

    function test_SamePlayerMultipleScores() public {
        vm.prank(player1);
        leaderboard.submitScore(3, 10, 25);
        vm.prank(player1);
        leaderboard.submitScore(3, 8, 30);

        assertEq(leaderboard.getScoresCount(), 2);

        KlotskiLeaderboard.ScoreEntry[] memory scores = leaderboard.getScoresPaginated(0, 2);
        assertEq(scores[0].moves, 10);
        assertEq(scores[1].moves, 8);
    }

    /* ========================================================================= */
    /* 分页与查询测试 (求职核心加分项)                 */
    /* ========================================================================= */

    function test_GetScoresPaginated() public {
        // 存入 3 条数据
        leaderboard.submitScore(3, 10, 25); // index 0
        leaderboard.submitScore(4, 20, 60); // index 1
        leaderboard.submitScore(5, 42, 120); // index 2

        // 测试正常分页: 从索引 1 开始取 2 条
        KlotskiLeaderboard.ScoreEntry[] memory page = leaderboard.getScoresPaginated(1, 2);
        assertEq(page.length, 2);
        assertEq(page[0].gridSize, 4);
        assertEq(page[1].gridSize, 5);

        // 测试边界情况: 请求长度超过剩余数据量 (应该截断而不是报错)
        KlotskiLeaderboard.ScoreEntry[] memory overflowPage = leaderboard.getScoresPaginated(2, 5);
        assertEq(overflowPage.length, 1, "Should truncate limit to remaining elements");
        assertEq(overflowPage[0].gridSize, 5);
    }

    function test_RevertOutOfBounds() public {
        leaderboard.submitScore(3, 10, 25);

        // 数组长度为 1，请求 offset 为 1 会触发越界报错
        vm.expectRevert(KlotskiLeaderboard.OutOfBounds.selector);
        leaderboard.getScoresPaginated(1, 10);
    }

    function test_GetLatestScores() public {
        leaderboard.submitScore(3, 10, 25); // 老记录
        leaderboard.submitScore(4, 20, 60); // 中记录
        leaderboard.submitScore(5, 42, 120); // 最新记录

        // 取最新的 2 条记录
        KlotskiLeaderboard.ScoreEntry[] memory latest = leaderboard.getLatestScores(2);
        assertEq(latest.length, 2);

        // 验证逆序排列 (最新的在最前面)
        assertEq(latest[0].gridSize, 5);
        assertEq(latest[1].gridSize, 4);

        // 取超出总长度的记录数量 (应该只返回 3 条)
        KlotskiLeaderboard.ScoreEntry[] memory allLatest = leaderboard.getLatestScores(100);
        assertEq(allLatest.length, 3);
    }

    function test_GetLatestScoresEmpty() public view {
        KlotskiLeaderboard.ScoreEntry[] memory latest = leaderboard.getLatestScores(10);
        assertEq(latest.length, 0);
    }

    /* ========================================================================= */
    /* 异常条件与 Revert 测试                        */
    /* ========================================================================= */

    function test_RevertInvalidGridSizeTooSmall() public {
        vm.expectRevert(abi.encodeWithSelector(KlotskiLeaderboard.InvalidGridSize.selector, 2));
        leaderboard.submitScore(2, 10, 25);
    }

    function test_RevertInvalidGridSizeTooLarge() public {
        vm.expectRevert(abi.encodeWithSelector(KlotskiLeaderboard.InvalidGridSize.selector, 6));
        leaderboard.submitScore(6, 10, 25);
    }

    function test_RevertInvalidMoves() public {
        vm.expectRevert(KlotskiLeaderboard.InvalidMoves.selector);
        leaderboard.submitScore(3, 0, 25);
    }

    function test_RevertInvalidTime() public {
        vm.expectRevert(KlotskiLeaderboard.InvalidTime.selector);
        leaderboard.submitScore(3, 10, 0);
    }

    /* ========================================================================= */
    /* 事件监听与模糊测试                            */
    /* ========================================================================= */

    function test_EmitScoreSubmitted() public {
        vm.prank(player1);
        vm.expectEmit(true, true, false, true);
        emit KlotskiLeaderboard.ScoreSubmitted(player1, 3, 10, 25, uint64(block.timestamp));
        leaderboard.submitScore(3, 10, 25);
    }

    function testFuzz_SubmitValidScore(uint8 gridSize, uint32 moves, uint32 timeSeconds) public {
        vm.assume(gridSize >= 3 && gridSize <= 5);
        vm.assume(moves > 0);
        vm.assume(timeSeconds > 0);

        vm.prank(player1);
        leaderboard.submitScore(gridSize, moves, timeSeconds);
        assertEq(leaderboard.getScoresCount(), 1);
    }
}
