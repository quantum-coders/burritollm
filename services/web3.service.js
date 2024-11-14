import {ethers} from 'ethers';
import BurritoToken from '../abis/BurritoToken.json' assert {type: 'json'};
import StakingContractV5 from '../abis/StakingContractV5.json' assert {type: 'json'};
import DefiBillingV3 from '../abis/DefiBillingV3.json' assert {type: 'json'};
import {prisma} from "@thewebchimp/primate";

class Web3Service {
	static BURRITO_TOKEN_ADDRESS = process.env.BURRITO_TOKEN_ADDRESS;
	static STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS;
	static USDT_TOKEN_ADDRESS = process.env.USDT_TOKEN_ADDRESS;
	static DEFI_BILLING_ADDRESS = process.env.DEFI_BILLING_ADDRESS;

	static provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);

	static stakingContract = new ethers.Contract(
		Web3Service.STAKING_CONTRACT_ADDRESS,
		StakingContractV5.abi,
		Web3Service.provider
	);

	static burritoToken = new ethers.Contract(
		Web3Service.BURRITO_TOKEN_ADDRESS,
		BurritoToken.abi,
		Web3Service.provider
	);

	static defiBilling = new ethers.Contract(
		Web3Service.DEFI_BILLING_ADDRESS,
		DefiBillingV3.abi,
		Web3Service.provider
	);

	static async getStakedBalance() {
		try {
			const totalTvl = await Web3Service.stakingContract.getTotalTvl();
			return ethers.utils.formatUnits(totalTvl, 18);
		} catch (error) {
			console.error("Error fetching staked balance:", error);
			throw error;
		}
	}

static async getStake(userAddress) {
    try {
        const stakes = await Web3Service.stakingContract.getUserStakes(userAddress);
        console.log(`Found ${stakes.length} total stakes for ${userAddress}`);

        const currentTime = Math.floor(Date.now() / 1000);
        console.log(`Current timestamp: ${currentTime}`);

        let totalAmount = ethers.BigNumber.from(0);
        const activeStakes = stakes.filter(stake => {
            const endTime = stake.timestamp.add(stake.duration).toNumber();
            const isActive = !stake.claimed &&
                           stake.timestamp.add(stake.duration).gt(ethers.BigNumber.from(currentTime));

            console.log(`Stake details:
                - Claimed: ${stake.claimed}
                - Start: ${stake.timestamp.toNumber()}
                - Duration: ${stake.duration.toNumber()}
                - End: ${endTime}
                - Amount: ${ethers.utils.formatUnits(stake.amount, 18)}
            `);

            if (isActive) {
                totalAmount = totalAmount.add(stake.amount);
            }

            return isActive;
        });

        console.log(`Found ${activeStakes.length} active stakes`);

        if (activeStakes.length === 0) return null;

        return {
            amount: ethers.utils.formatUnits(totalAmount, 18),
            timestamp: new Date(activeStakes[0].timestamp.toNumber() * 1000),
            duration: activeStakes[0].duration.toNumber() / 86400
        };

    } catch (error) {
        console.error(`Error fetching stakes for ${userAddress}:`, error);
        throw error;
    }
}

	static async getMonthlyAPR() {
		try {
			const monthlyAPR = await Web3Service.stakingContract.monthlyAPR();
			const formattedAPR = ethers.utils.formatUnits(monthlyAPR, 18);
			return formattedAPR * 100;
		} catch (error) {
			console.error("Error fetching monthly APR:", error);
			throw error;
		}
	}

	static async getAnnualAPR() {
		try {
			const annualAPR = await Web3Service.stakingContract.annualAPR();
			const formattedAPR = ethers.utils.formatUnits(annualAPR, 18);
			return formattedAPR * 100;
		} catch (error) {
			console.error("Error fetching annual APR:", error);
			throw error;
		}
	}

	static async calculateReward(userAddress) {
		try {
			const stakes = await Web3Service.stakingContract.getUserStakes(userAddress);
			let totalReward = ethers.BigNumber.from(0);

			for (let i = 0; i < stakes.length; i++) {
				if (!stakes[i].claimed) {
					const reward = await Web3Service.stakingContract.calculateReward(userAddress, i);
					totalReward = totalReward.add(reward);
				}
			}

			return ethers.utils.formatUnits(totalReward, 18);
		} catch (error) {
			console.error(`Error calculating reward for ${userAddress}:`, error);
			throw error;
		}
	}

	static async buildStakeTransaction(amount, duration, signerAddress) {
		const amountString = amount.toString();
		const amountToStake = ethers.utils.parseUnits(amountString, 18);
		const durationInSeconds = duration * 86400; // Convert days to seconds

		// Allow the contract to spend user's Burrito tokens
		const allowance = await Web3Service.burritoToken.allowance(
			signerAddress,
			Web3Service.STAKING_CONTRACT_ADDRESS
		);

		const populatedTx = await Web3Service.stakingContract.populateTransaction.stake(
			amountToStake,
			durationInSeconds,
			{gasLimit: 3000000}
		);

		return populatedTx;
	}

	static async buildApprovalTransaction(amount, spenderAddress, signerAddress) {
		// convert to String all parameters
		const amountString = amount.toString();
		const amountToApprove = ethers.utils.parseUnits(amountString, 18);
		return await Web3Service.burritoToken.populateTransaction.approve(
			String(spenderAddress),
			String(amountToApprove),
		);
	}

	static async buildUnstakeTransaction(stakeIndex, signerAddress) {
		return await Web3Service.stakingContract.populateTransaction.unstake(
			stakeIndex,
			{gasLimit: 3000000}
		);
	}

	static async buildRecordPaymentTransaction(avaxAmount, usdtAmount, signerAddress) {
		try {
			const avaxValue = ethers.utils.parseEther(avaxAmount.toString());
			const usdtValue = ethers.utils.parseUnits(usdtAmount.toString(), 6);

			const populatedTx = await Web3Service.defiBilling.populateTransaction.recordPayment(
				avaxValue,
				usdtValue,
				{value: avaxValue}
			);
			return populatedTx;
		} catch (error) {
			console.error("Error building record payment transaction:", error);
			throw error;
		}
	}

	static async getPaymentHistory(userAddress) {
		try {
			const history = await Web3Service.defiBilling.getPaymentHistory(userAddress);
			const formattedHistory = history.map(payment => ({
				timestamp: new Date(payment.timestamp.toNumber() * 1000),
				avaxAmount: ethers.utils.formatEther(payment.avaxAmount),
				usdtAmount: ethers.utils.formatUnits(payment.usdtAmount, 6)
			}));
			return formattedHistory;
		} catch (error) {
			console.error(`Error fetching payment history for ${userAddress}:`, error);
			throw error;
		}
	}

	static async buildWithdrawFundsTransaction(avaxAmount, usdtAmount, signerAddress) {
		try {
			const avaxValue = ethers.utils.parseEther(avaxAmount.toString());
			const usdtValue = ethers.utils.parseUnits(usdtAmount.toString(), 6);

			const populatedTx = await Web3Service.defiBilling.populateTransaction.withdrawFunds(
				avaxValue,
				usdtValue
			);
			return populatedTx;
		} catch (error) {
			console.error("Error building withdraw funds transaction:", error);
			throw error;
		}
	}

	static async buildWithdrawAllFundsTransaction(signerAddress) {
		try {
			const populatedTx = await Web3Service.defiBilling.populateTransaction.withdrawAllFunds();
			return populatedTx;
		} catch (error) {
			console.error("Error building withdraw all funds transaction:", error);
			throw error;
		}
	}

	static async getActiveStakes(userAddress) {
		try {
			const stakes = await Web3Service.stakingContract.getUserStakes(userAddress);
			const currentTimestamp = Math.floor(Date.now() / 1000);

			const activeStakes = [];

			for (let i = 0; i < stakes.length; i++) {
				const stake = stakes[i];
				if (!stake.claimed &&
					stake.timestamp.add(stake.duration).gt(ethers.BigNumber.from(currentTimestamp))) {
					const reward = await Web3Service.stakingContract.calculateReward(userAddress, i);

					activeStakes.push({
						index: i,
						amount: ethers.utils.formatUnits(stake.amount, 18),
						startDate: new Date(stake.timestamp.toNumber() * 1000),
						endDate: new Date((stake.timestamp.toNumber() + stake.duration.toNumber()) * 1000),
						rewards: ethers.utils.formatUnits(reward, 18),
						rewardRate: ethers.utils.formatUnits(stake.rewardRate, 18)
					});
				}
			}

			return activeStakes;
		} catch (error) {
			console.error(`Error fetching active stakes for ${userAddress}:`, error);
			throw error;
		}
	}

	static async getStakingHistory(userAddress) {
		try {
			const stakes = await Web3Service.stakingContract.getUserStakes(userAddress);
			const currentTimestamp = Math.floor(Date.now() / 1000);

			const history = await Promise.all(stakes.map(async (stake, index) => {
				const reward = stake.claimed ? "0" :
					await Web3Service.stakingContract.calculateReward(userAddress, index);

				const endTimestamp = stake.timestamp.toNumber() + stake.duration.toNumber();
				let status;
				if (stake.claimed) {
					status = 'Completed';
				} else if (currentTimestamp >= endTimestamp) {
					status = 'Ready to Claim';
				} else {
					status = 'Active';
				}

				return {
					index,
					amount: ethers.utils.formatUnits(stake.amount, 18),
					startDate: new Date(stake.timestamp.toNumber() * 1000),
					endDate: new Date(endTimestamp * 1000),
					rewards: ethers.utils.formatUnits(reward, 18),
					status,
					rewardRate: ethers.utils.formatUnits(stake.rewardRate, 18)
				};
			}));

			return history;
		} catch (error) {
			console.error(`Error fetching staking history for ${userAddress}:`, error);
			throw error;
		}
	}

	static async getPaymentHistoryFromContract(userAddress) {
		try {
			const history = await Web3Service.defiBilling.getPaymentHistory(userAddress);
			const formattedHistory = history.map(payment => ({
				timestamp: payment.timestamp.toNumber(),
				avaxAmount: ethers.utils.formatEther(payment.avaxAmount),
				usdtAmount: ethers.utils.formatUnits(payment.usdtAmount, 6),
			}));
			return formattedHistory;
		} catch (error) {
			console.error(`Error fetching payment history for ${userAddress}:`, error);
			throw error;
		}
	}

	static async synchronizePaymentHistory(userAddress) {
		try {
			const user = await prisma.user.findFirst({
				where: {
					wallet: userAddress,
				},
			});
			const paymentHistoryFromContract = await Web3Service.getPaymentHistoryFromContract(userAddress);
			const dbPaymentHistory = await prisma.balanceTransaction.findMany({
				where: {
					idUserBalance: user.id,
					type: 'crypto',
				},
			});

			const parsedTransactionsFromDb = dbPaymentHistory.map(tx => ({
				amount: parseFloat(tx.amount),
				currency: tx.currency,
				timestamp: Number(tx.timestamp)
			}));

			const parsedTransactionsFromContract = paymentHistoryFromContract.map(contractTx => ({
				amount: parseFloat(contractTx.avaxAmount !== '0.0' ? contractTx.avaxAmount : contractTx.usdtAmount),
				currency: contractTx.avaxAmount !== '0.0' ? 'AVAX' : 'USDT',
				timestamp: contractTx.timestamp * 1000,
			}));

			// Finding Transactions to Sync
			const txToSync = parsedTransactionsFromContract.filter(contractTx => {
				return !parsedTransactionsFromDb.some(dbTx =>
					dbTx.amount == contractTx.amount &&
					dbTx.currency == contractTx.currency &&
					dbTx.timestamp === contractTx.timestamp
				);
			});

			// Syncing Transactions
			await prisma.balanceTransaction.createMany({
				data: txToSync.map(tx => ({
					amount: tx.amount,
					currency: tx.currency,
					type: 'crypto',
					timestamp: tx.timestamp,
					idUserBalance: user.id,
				})),
			});

			const userBalance = await prisma.userBalance.findFirst({
				where: {
					user: {
						wallet: userAddress,
					},
				},
			});

			// iterate all transactions to sync and if is AVAX convert it to USDT
			let balanceToAdd = 0.0
			for (let i = 0; i < txToSync.length; i++) {
				if (txToSync[i].currency === 'AVAX') {
					const avaxPrice = await Web3Service.getAvaxPrice();
					const usdtAmount = txToSync[i].amount * avaxPrice;
					balanceToAdd += usdtAmount;
				} else {
					balanceToAdd += txToSync[i].amount;
				}
			}

			const totalBalance = parseFloat(userBalance.balance) + parseFloat(balanceToAdd);
			await prisma.userBalance.update({
				where: {
					id: userBalance.id,
				},
				data: {
					balance: totalBalance,
				},
			});

		} catch (error) {
			console.error(`Failed to synchronize payment history for user: ${userAddress}`, error);
		}
	}

	static async getAvaxPrice() {
		const avaxMainnetRpc = 'https://api.avax.network/ext/bc/C/rpc';
		const provider = new ethers.providers.JsonRpcProvider(avaxMainnetRpc);
		const priceFeed = new ethers.Contract('0x0A77230d17318075983913bC2145DB16C7366156', ['function latestRoundData() view returns (uint80, int256, uint256, uint256, uint80)'], provider);
		const [roundId, price, startedAt, updatedAt, answeredInRound] = await priceFeed.latestRoundData();
		return price / 1e8;
		// Continúa el método getAvaxPrice()...
	}

	static async getStakingLimits() {
		try {
			const limits = await Web3Service.stakingContract.limits();
			return {
				maxDuration: limits.maxDuration.toNumber() / 86400, // Convert to days
				minDuration: limits.minDuration.toNumber() / 86400,
				maxStakeAmount: ethers.utils.formatUnits(limits.maxStakeAmount, 18),
				maxStakesPerUser: limits.maxStakesPerUser.toNumber()
			};
		} catch (error) {
			console.error("Error fetching staking limits:", error);
			throw error;
		}
	}

	static async getContractStats() {
		try {
			const [totalStaked, availableRewards, stakerCount, maxTotalStaked] = await Promise.all([
				Web3Service.stakingContract.getTotalTvl(),
				Web3Service.stakingContract.getAvailableRewards(),
				Web3Service.stakingContract.getStakerCount(),
				Web3Service.stakingContract.maxTotalStaked()
			]);

			return {
				totalStaked: ethers.utils.formatUnits(totalStaked, 18),
				availableRewards: ethers.utils.formatUnits(availableRewards, 18),
				stakerCount: stakerCount.toNumber(),
				maxTotalStaked: ethers.utils.formatUnits(maxTotalStaked, 18)
			};
		} catch (error) {
			console.error("Error fetching contract stats:", error);
			throw error;
		}
	}

	static async buildEmergencyWithdrawTransaction(stakeIndex) {
		try {
			return await Web3Service.stakingContract.populateTransaction.emergencyWithdraw(
				stakeIndex,
				{gasLimit: 3000000}
			);
		} catch (error) {
			console.error("Error building emergency withdraw transaction:", error);
			throw error;
		}
	}

	static async isContractPaused() {
		try {
			return await Web3Service.stakingContract.paused();
		} catch (error) {
			console.error("Error checking if contract is paused:", error);
			throw error;
		}
	}

	static async getStakers(startIndex = 0, count = 10) {
		try {
			const stakerCount = await Web3Service.stakingContract.getStakerCount();
			const endIndex = Math.min(startIndex + count, stakerCount.toNumber());
			const stakers = [];

			for (let i = startIndex; i < endIndex; i++) {
				const stakerAddress = await Web3Service.stakingContract.getStakerAtIndex(i);
				stakers.push(stakerAddress);
			}

			return stakers;
		} catch (error) {
			console.error("Error fetching stakers:", error);
			throw error;
		}
	}
}

export default Web3Service;
