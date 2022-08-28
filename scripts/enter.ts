import { ethers } from 'hardhat';

async function main() {
  const lottery = await ethers.getContract('Lottery');
  const entranceFee = await lottery.getEntranceFee();
  await lottery.enterRaffle({ value: entranceFee + 1 });
  console.log('Entered!');
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
