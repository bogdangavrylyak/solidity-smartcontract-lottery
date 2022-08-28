import { network, ethers, deployments } from 'hardhat';
import { BigNumber } from 'ethers';
import { assert, expect } from 'chai';
import { developmentChains, networkConfig } from '../../helper-hardhat-config';
import { Lottery, VRFCoordinatorV2Mock } from '../../typechain-types';
import { SignerWithAddress } from '@nomiclabs/hardhat-ethers/signers';

!developmentChains.includes(network.name)
  ? describe.skip
  : describe('Lottery', () => {
      let lottery: Lottery;
      let lotteryContract: Lottery;
      let vrfCoordinatorV2Mock: VRFCoordinatorV2Mock;
      let lotteryEntranceFee: BigNumber;
      let interval: number;
      let deployer: SignerWithAddress;
      let player: SignerWithAddress;
      let accounts: SignerWithAddress[];
      const chainId = network.config.chainId;

      beforeEach(async () => {
        if (!developmentChains.includes(network.name)) {
          throw 'You need to be on a development chain to run tests';
        }

        accounts = await ethers.getSigners();

        [deployer] = accounts;

        player = accounts[1];

        // await deployments.fixture(['mocks', 'lottery']);
        await deployments.fixture(['all']);

        vrfCoordinatorV2Mock = await ethers.getContract('VRFCoordinatorV2Mock', deployer);
        lotteryContract = await ethers.getContract('Lottery');
        lottery = lotteryContract.connect(deployer);
        lotteryEntranceFee = await lottery.getEntranceFee();
        interval = (await lottery.getInterval()).toNumber();
      });

      describe('constructor', () => {
        it('initializes the lottery correctly', async () => {
          const lotteryState = await lottery.getLotteryState();
          // const interval = await lottery.getInterval();

          assert.equal(lotteryState.toString(), '0');
          assert.equal(interval.toString(), networkConfig[chainId as number].keepersUpdateInterval);
        });
      });

      describe('enterLottery', () => {
        it("reverts when you don't pay enough", async () => {
          await expect(lottery.enterLottery()).to.be.revertedWith('Lottery__NotEnoughETHEntered');
        });

        it('records players when they enter', async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          const playerFromContract = await lottery.getPlayer(0);

          assert.equal(playerFromContract, deployer.address);
        });

        it('emits event on enter', async () => {
          await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.emit(
            lottery,
            'LotteryEnter'
          );
        });

        it("doesn't allow entrance when raffle is calculating", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send('evm_increaseTime', [interval + 1]);
          await network.provider.send('evm_mine', []);
          // await network.provider.request({ method: 'evm_mine', params: [] });

          await lottery.performUpkeep([]);

          await expect(lottery.enterLottery({ value: lotteryEntranceFee })).to.be.revertedWith(
            'Lottery__NotOpen'
          );
        });
      });

      describe('checkUpkeep', () => {
        it("returns false if people haven't sent any ETH", async () => {
          await network.provider.send('evm_increaseTime', [interval + 1]);
          await network.provider.send('evm_mine', []);
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });
        it("returns false if lottery isn't open", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send('evm_increaseTime', [interval + 1]);
          await network.provider.send('evm_mine', []);

          await lottery.performUpkeep([]);
          const lotteryState = await lottery.getLotteryState();
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert.equal(lotteryState.toString(), '1');
          assert(upkeepNeeded.toString(), 'false');
        });

        it("returns false if enough time hasn't passed", async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });

          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep([]);
          assert(!upkeepNeeded);
        });

        it('returns true if enough time has passed, has players, eth, and is open', async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send('evm_increaseTime', [interval + 1]);
          await network.provider.request({ method: 'evm_mine', params: [] });
          const { upkeepNeeded } = await lottery.callStatic.checkUpkeep('0x');
          assert(upkeepNeeded);
        });
      });

      describe('performUpkeep', () => {
        it('can only run if checkUpkeep is true', async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send('evm_increaseTime', [interval + 1]);
          await network.provider.request({ method: 'evm_mine', params: [] });
          const tx = await lottery.performUpkeep([]);
          assert(tx);
        });

        it('reverts if checkUpkeep is false', async () => {
          await expect(lottery.performUpkeep([])).to.be.revertedWith(
            `Lottery__UpkeepNotNeeded(${await lottery.provider.getBalance(lottery.address)}, 0, 0)`
          );
        });

        it('updates the raffle state, emits an event and calls the vrf coordinator', async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send('evm_increaseTime', [interval + 1]);
          await network.provider.request({ method: 'evm_mine', params: [] });

          const txResponse = await lottery.performUpkeep([]);
          const txReceipt = await txResponse.wait(1);
          // @ts-ignore
          const requestId = txReceipt.events[1].args.requestId;
          const lotteryState = await lottery.getLotteryState();

          assert(requestId.toNumber() > 0);
          assert(lotteryState === 1);
        });
      });

      describe('fulfillRandomWords', () => {
        beforeEach(async () => {
          await lottery.enterLottery({ value: lotteryEntranceFee });
          await network.provider.send('evm_increaseTime', [interval + 1]);
          await network.provider.request({ method: 'evm_mine', params: [] });
        });

        it('can only be performed after performUpkeep', async () => {
          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(0, lottery.address)
          ).to.be.revertedWith('nonexistent request');

          await expect(
            vrfCoordinatorV2Mock.fulfillRandomWords(1, lottery.address)
          ).to.be.revertedWith('nonexistent request');
        });

        it('picks a winner, resets, and sends money', async () => {
          const additionalEntrances = 3;
          const startingAccountIndex = 2;
          for (let i = startingAccountIndex; i < startingAccountIndex + additionalEntrances; i++) {
            const accountConnectedLottery = lottery.connect(accounts[i]);
            await accountConnectedLottery.enterLottery({ value: lotteryEntranceFee });
          }
          const startingTimeStamp = await lottery.getLatestTimestamp();

          await new Promise<void>(async (resolve, reject) => {
            lottery.once('WinnerPicked', async () => {
              console.log('Found the event');
              try {
                const recentWinner = await lottery.getRecentWinner();
                const winnerEndingBalance = await accounts
                  .find((account) => account.address === recentWinner)
                  ?.getBalance();
                const lotteryState = await lottery.getLotteryState();
                const endingTimeStamp = await lottery.getLatestTimestamp();
                const numPlayers = await lottery.getNumberOfPlayers();

                console.log('recentWinner: ', recentWinner);
                for (let i = 0; i < additionalEntrances + 1; i++) {
                  console.log(`account[${i}]: ${accounts[i].address}`);
                }

                assert.equal(numPlayers.toString(), '0');
                assert.equal(lotteryState.toString(), '0');
                assert(endingTimeStamp > startingTimeStamp);
                assert.equal(recentWinner, accounts[2].address);

                assert.equal(
                  winnerEndingBalance?.toString(),
                  winnerStartingBalance
                    ?.add(lotteryEntranceFee.mul(additionalEntrances).add(lotteryEntranceFee))
                    .toString()
                );
              } catch (error) {
                reject(error);
              }
              resolve();
            });

            const tx = await lottery.performUpkeep([]);
            const txReceipt = await tx.wait(1);
            const winnerStartingBalance = await accounts
              .find((account) => account.address === accounts[2].address)
              ?.getBalance();
            await vrfCoordinatorV2Mock.fulfillRandomWords(
              // @ts-ignore
              txReceipt.events[1].args.requestId,
              lottery.address
            );
          });
        });
      });
    });
