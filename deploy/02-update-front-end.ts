import { HardhatRuntimeEnvironment } from 'hardhat/types';
import { DeployFunction } from 'hardhat-deploy/types';
import * as fs from 'fs';

const FRONT_END_ADDRESSES_FILE = '../nextjs-smartcontract-lottery/constants/contractAddress.json';
const FRONT_END_ABI_FILE = '../nextjs-smartcontract-lottery/constants/abi.json';

const updateFrontEnd: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, ethers, network } = hre;
  const { log } = deployments;
  if (process.env.UPDATE_FRONT_END) {
    log('updating front end...');
    const lottery = await ethers.getContract('Lottery');
    // @ts-ignore
    const chainId = network.config.chainId.toString();
    const currentAddreses = JSON.parse(fs.readFileSync(FRONT_END_ADDRESSES_FILE, 'utf-8'));

    if (chainId in currentAddreses && !currentAddreses[chainId].includes(lottery.address)) {
      currentAddreses[chainId].push(lottery.address);
    }

    currentAddreses[chainId] = [lottery.address];

    fs.writeFileSync(FRONT_END_ADDRESSES_FILE, JSON.stringify(currentAddreses));

    // @ts-ignore
    fs.writeFileSync(FRONT_END_ABI_FILE, lottery.interface.format(ethers.utils.FormatTypes.json));
    log('front end updated');
    log('-------------------------------------------');
  }
};

export default updateFrontEnd;
updateFrontEnd.tags = ['all', 'frontend'];
