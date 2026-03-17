// SPDX-License-Identifier: MIT
pragma solidity ^0.8.13;

import {Script, console} from "forge-std/Script.sol";
import {KlotskiLeaderboard} from "../src/KlotskiLeaderboard.sol";

contract KlotskiLeaderboardScript is Script {
    function run() public {
        uint256 deployerPrivateKey = vm.envUint("PRIVATE_KEY");

        vm.startBroadcast(deployerPrivateKey);
        KlotskiLeaderboard leaderboard = new KlotskiLeaderboard();
        vm.stopBroadcast();

        console.log("KlotskiLeaderboard deployed at:", address(leaderboard));
    }
}
