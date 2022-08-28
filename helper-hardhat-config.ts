import { ethers } from 'hardhat';

export interface NetworkConfigItem {
  name?: string;
  vrfCoordinatorV2?: string;
  lotteryEntranceFee?: string;
  gasLane?: string;
  subscriptionId?: string;
  callbackGasLimit?: string;
  keepersUpdateInterval?: string;
}

export interface NetworkConfigInfo {
  [key: string]: NetworkConfigItem;
}

export const networkConfig: NetworkConfigInfo = {
  31337: {
    name: 'hardhat',
    lotteryEntranceFee: ethers.utils.parseEther('0.01').toString(),
    gasLane: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
    callbackGasLimit: '500000',
    keepersUpdateInterval: '30',
  },
  4: {
    name: 'rinkeby',
    vrfCoordinatorV2: '0x6168499c0cFfCaCD319c818142124B7A15E857ab',
    lotteryEntranceFee: ethers.utils.parseEther('0.01').toString(),
    gasLane: '0xd89b2bf150e3b9e13446986e571fb9cab24b13cea0a43ea20a6049a85cc807cc',
    subscriptionId: '18638',
    callbackGasLimit: '500000',
    keepersUpdateInterval: '30',
  },
};

export const developmentChains = ['hardhat', 'localhost'];
export const VERIFICATION_BLOCK_CONFIRMATIONS = 6;
