// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@chainlink/contracts/src/v0.8/interfaces/VRFCoordinatorV2Interface.sol";
import "@chainlink/contracts/src/v0.8/VRFConsumerBaseV2.sol";
import "@chainlink/contracts/src/v0.8/interfaces/KeeperCompatibleInterface.sol";
import "hardhat/console.sol";

error Lottery__NotEnoughETHEntered();
error Lottery__TransferFailed();
error Lottery__NotOpen();
error Lottery__UpkeepNotNeeded(uint256 currentBalance, uint256 numPlayers, uint256 raffleState);

contract Lottery is VRFConsumerBaseV2, KeeperCompatibleInterface {
    // Type Declarations
    enum LotteryState {
        OPEN,
        CALCULATING
    }

    // State Variables
    VRFCoordinatorV2Interface private immutable iVrfCoordinator;
    bytes32 private immutable iGasLane;
    uint64 private immutable iSubscriptionId;
    uint32 private immutable iCallbackGasLimit;
    uint16 private constant REQUEST_CONFIRMATIONS = 3;
    uint32 private constant NUM_WORDS = 1;

    // Lottery Variables
    uint256 private immutable iEntranceFee;
    uint256 private immutable iInterval;
    address payable[] private sPlayers;
    address private sRecentWinner;
    uint256 private sLastTimeStamp;
    LotteryState private sLotteryState;

    // Events
    event LotteryEnter(address indexed player);
    event RequestedLotteryWinner(uint256 indexed requestId);
    event WinnerPicked(address indexed winner);

    // Functions
    constructor(
        uint256 entranceFee,
        uint256 interval,
        address vrfCoordinatorV2,
        bytes32 gasLane,
        uint64 subscriptionId,
        uint32 callbackGasLimit
    ) VRFConsumerBaseV2(vrfCoordinatorV2) {
        iEntranceFee = entranceFee;
        iInterval = interval;
        sLotteryState = LotteryState.OPEN;
        sLastTimeStamp = block.timestamp;
        iVrfCoordinator = VRFCoordinatorV2Interface(vrfCoordinatorV2);
        iGasLane = gasLane;
        iSubscriptionId = subscriptionId;
        iCallbackGasLimit = callbackGasLimit;
    }

    function enterLottery() public payable {
        if(msg.value < iEntranceFee) {
            revert Lottery__NotEnoughETHEntered();
        }
        if(sLotteryState != LotteryState.OPEN) {
            revert Lottery__NotOpen();
        }

        sPlayers.push(payable(msg.sender));

        emit LotteryEnter(msg.sender);
    }

    function checkUpkeep(
        bytes memory /* checkData */
    ) 
        public
        view
        override 
        returns (
            bool upkeepNeeded,
            bytes memory /* performData */
        ) 
    {
        bool isOpen = LotteryState.OPEN == sLotteryState;
        bool timePassed = ((block.timestamp - sLastTimeStamp) > iInterval);
        bool hasPlayers = sPlayers.length > 0;
        bool hasBalance = address(this).balance > 0;
        upkeepNeeded = (timePassed && isOpen && hasBalance && hasPlayers);
        console.log("isOpen: ", isOpen);
        console.log("timePassed: ", timePassed);
        console.log("hasPlayers: ", hasPlayers);
        console.log("hasBalance: ", hasBalance);
        console.log("upkeepNeeded: ", upkeepNeeded);
        return (upkeepNeeded, "0x0");
    }

    function performUpkeep(
        bytes calldata /* performData */
    ) external override {
        (bool upkeepNeeded, ) = checkUpkeep("");
        if(!upkeepNeeded) {
            revert Lottery__UpkeepNotNeeded(
                address(this).balance,
                sPlayers.length,
                uint256(sLotteryState)
            );
        }
        sLotteryState = LotteryState.CALCULATING;
        uint256 requestId = iVrfCoordinator.requestRandomWords(
            iGasLane, // kayHash || gasLane
            iSubscriptionId,
            REQUEST_CONFIRMATIONS,
            iCallbackGasLimit,
            NUM_WORDS
        );

        emit RequestedLotteryWinner(requestId);
    }
    
    function fulfillRandomWords(
        uint256 /*requestId*/,
        uint256[] memory randomWords
    ) internal override {
        uint256 indexOfWinner = randomWords[0] % sPlayers.length;
        address payable recentWinner = sPlayers[indexOfWinner];
        sRecentWinner = recentWinner;
        sLotteryState = LotteryState.OPEN;
        sPlayers = new address payable[](0);
        sLastTimeStamp = block.timestamp;
        (bool success, ) = recentWinner.call{ value: address(this).balance }("");

        if(!success) {
            revert Lottery__TransferFailed();
        }

        emit WinnerPicked(recentWinner);
    }

    // Getter Functions
    function getEntranceFee() public view returns(uint256) {
        return iEntranceFee;
    }

    function getPlayer(uint256 index) public view returns(address) {
        return sPlayers[index];
    }

    function getRecentWinner() public view returns(address) {
        return sRecentWinner;
    }

    function getLotteryState() public view returns(LotteryState) {
        return sLotteryState;
    }

    function getNumberOfPlayers() public view returns(uint256) {
        return sPlayers.length;
    }

    function getInterval() public view returns(uint256) {
        return iInterval;
    }

    function getLatestTimestamp() public view returns(uint256) {
        return sLastTimeStamp;
    }

    function getNumWords() public pure returns(uint256) {
        return NUM_WORDS;
    }

    function getRequestConfirmations() public pure returns(uint256) {
        return REQUEST_CONFIRMATIONS;
    }
}
