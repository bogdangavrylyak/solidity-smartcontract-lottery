import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import {
  developmentChains,
  networkConfig,
  VERIFICATION_BLOCK_CONFIRMATIONS,
} from '../helper-hardhat-config';
import { ethers } from 'hardhat';
import verify from '../utils/verify';

const FUND_AMOUNT = '1000000000000000000000';

const deployLottery: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { getNamedAccounts, deployments, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();
  const chainId = network.config.chainId;
  log('chainId: ', chainId);

  let vrfCoordinatorV2Address, vrfCoordinatorV2Mock, subscriptionId;

  //   if (developmentChains.includes(network.name)) {
  if (chainId === 31337) {
    vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock');
    vrfCoordinatorV2Address = vrfCoordinatorV2Mock.address;
    const txResponse = await vrfCoordinatorV2Mock.createSubscription();
    const txReceipt = await txResponse.wait();
    subscriptionId = txReceipt.events[0].args.subId;
    log('subscriptionId: ', txReceipt.events[0].args.subId.toString());
    log('subscriptionId owner: ', txReceipt.events[0].args.owner);
    await vrfCoordinatorV2Mock.fundSubscription(subscriptionId, FUND_AMOUNT);
  } else {
    vrfCoordinatorV2Address = networkConfig[chainId as number].vrfCoordinatorV2;
    subscriptionId = networkConfig[chainId as number].subscriptionId;
  }

  const waitBlockConfirmations = developmentChains.includes(network.name)
    ? 1
    : VERIFICATION_BLOCK_CONFIRMATIONS;

  const entranceFee = networkConfig[chainId as number].lotteryEntranceFee;
  const gasLane = networkConfig[chainId as number].gasLane;
  const callbackGasLimit = networkConfig[chainId as number].callbackGasLimit;
  const keepersUpdateInterval = networkConfig[chainId as number].keepersUpdateInterval;
  const args: any[] = [
    entranceFee,
    keepersUpdateInterval,
    vrfCoordinatorV2Address,
    gasLane,
    subscriptionId,
    callbackGasLimit,
  ];
  const lottery = await deploy('Lottery', {
    from: deployer,
    args: args,
    log: true,
    waitConfirmations: waitBlockConfirmations,
  });

  if (!developmentChains.includes(network.name) && process.env.ETHERSCAN_API_KEY) {
    log('Verifying...');
    await verify(lottery.address, args);
  }

  if (chainId === 31337 && vrfCoordinatorV2Mock) {
    await vrfCoordinatorV2Mock.addConsumer(subscriptionId.toNumber(), lottery.address);
  }

  log('-------------------------------------------');
};

export default deployLottery;
deployLottery.tags = ['all', 'lottery'];

// const lotteryContract = await ethers.getContract('Lottery', deployer);
// const lotteryEntranceFee = await lotteryContract.getEntranceFee();
// const interval = (await lotteryContract.getInterval()).toNumber();

// await lotteryContract.enterLottery({ value: lotteryEntranceFee });
// await network.provider.send('evm_increaseTime', [interval + 1]);
// // await network.provider.send('evm_mine', []);
// await network.provider.request({ method: 'evm_mine', params: [] });

// await lotteryContract.performUpkeep([]);
