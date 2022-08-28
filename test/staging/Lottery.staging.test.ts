import { network, ethers } from 'hardhat';
import { BigNumber } from 'ethers';
import { assert, expect } from 'chai';
import { developmentChains } from '../../helper-hardhat-config';
import { Lottery } from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

developmentChains.includes(network.name)
  ? describe.skip
  : describe('Lottery', () => {
      let lottery: Lottery;
      let lotteryEntranceFee: BigNumber;
      let deployer: SignerWithAddress;
      let accounts: SignerWithAddress[];

      beforeEach(async () => {
        accounts = await ethers.getSigners();

        [deployer] = accounts;

        lottery = await ethers.getContract('Lottery');
        lotteryEntranceFee = await lottery.getEntranceFee();
      });

      describe('fulfillRandomWords', () => {
        it('works with live Chainlink Keepers and Chainlink VRF, we get a random winner', async () => {
          const startingTimeStamp = await lottery.getLatestTimestamp();

          await new Promise<void>(async (resolve, reject) => {
            lottery.once('WinnerPicked', async () => {
              console.log('WinnerPicked event fired');
              try {
                const recentWinner = await lottery.getRecentWinner();
                const winnerEndingBalance = await accounts
                  .find((account) => account.address === recentWinner)
                  ?.getBalance();
                const lotteryState = await lottery.getLotteryState();
                const endingTimeStamp = await lottery.getLatestTimestamp();
                const numPlayers = await lottery.getNumberOfPlayers();

                await expect(lottery.getPlayer(0)).to.be.reverted;

                assert.equal(numPlayers.toString(), '0');
                assert.equal(lotteryState.toString(), '0');
                assert(endingTimeStamp > startingTimeStamp);
                assert.equal(recentWinner, accounts[0].address);

                assert.equal(
                  winnerEndingBalance?.toString(),
                  winnerStartingBalance?.add(lotteryEntranceFee).toString()
                );
                resolve();
              } catch (error) {
                reject(error);
              }
            });

            const tx = await lottery.enterLottery({ value: lotteryEntranceFee });

            await tx.wait(1);
            const winnerStartingBalance = await accounts
              .find((account) => account.address === accounts[0].address)
              ?.getBalance();
          });
        });
      });
    });
