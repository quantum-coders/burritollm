import {ethers} from 'ethers';
import StakingContractV5 from '../abis/StakingContractV5.json' assert {type: 'json'};
import DefiBillingV3 from '../abis/DefiBillingV3.json' assert {type: 'json'};
import {Prisma, PrismaClient} from '@prisma/client';

const prisma = new PrismaClient();

class Web3AnalyticsExtended {
	static STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS;
	static DEFI_BILLING_ADDRESS = process.env.DEFI_BILLING_ADDRESS;

	static provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);

	static stakingContract = new ethers.Contract(
		Web3AnalyticsExtended.STAKING_CONTRACT_ADDRESS,
		StakingContractV5.abi,
		Web3AnalyticsExtended.provider
	);

	static defiBilling = new ethers.Contract(
		Web3AnalyticsExtended.DEFI_BILLING_ADDRESS,
		DefiBillingV3.abi,
		Web3AnalyticsExtended.provider
	);

	static async initialize(stakingAddress, billingAddress, rpcUrl) {
		this.provider = new ethers.providers.JsonRpcProvider(rpcUrl);
		this.stakingContract = new ethers.Contract(
			stakingAddress,
			StakingContractV5.abi,
			this.provider
		);
		this.defiBilling = new ethers.Contract(
			billingAddress,
			DefiBillingV3.abi,
			this.provider
		);
	}

	// --- Funciones relacionadas con Eventos (Mejoradas) ---

	static async getDefiBillingStats() {
		try {
			const [avaxBalance, usdtBalance] = await Promise.all([
				this.provider.getBalance(this.DEFI_BILLING_ADDRESS),
				this.defiBilling.usdtToken()
					.then(usdtAddress => new ethers.Contract(usdtAddress, ['function balanceOf(address) view returns (uint256)'], this.provider))
					.then(usdtContract => usdtContract.balanceOf(this.DEFI_BILLING_ADDRESS))
			]);

			return {
				avaxBalance: ethers.utils.formatEther(avaxBalance),
				usdtBalance: ethers.utils.formatUnits(usdtBalance, 6), // USDT suele tener 6 decimales
				minDepositUsd: ethers.utils.formatUnits(await this.defiBilling.minDepositUsd(), 6)
			};
		} catch (error) {
			console.error("Error fetching DefiBilling stats from contract:", error);
			throw error;
		}
	}

	static async getPaymentHistory(userAddress) {
		try {
			const paymentHistory = await this.defiBilling.getPaymentHistory(userAddress);
			return paymentHistory.map(payment => ({
				timestamp: new Date(payment.timestamp.toNumber() * 1000),
				avaxAmount: ethers.utils.formatEther(payment.avaxAmount),
				usdtAmount: ethers.utils.formatUnits(payment.usdtAmount, 6)
			}));
		} catch (error) {
			console.error("Error fetching payment history from contract:", error);
			throw error;
		}
	}

	static async getDefiBillingUserStats(userAddress) {
		try {
			const paymentHistory = await this.getPaymentHistory(userAddress);

			let totalUsdtPaid = 0;
			let totalAvaxPaid = 0;

			paymentHistory.forEach(payment => {
				totalUsdtPaid += parseFloat(payment.usdtAmount);
				totalAvaxPaid += parseFloat(payment.avaxAmount);
			});

			return {
				totalUsdtPaid,
				totalAvaxPaid,
				numberOfPayments: paymentHistory.length,
				lastPaymentDate: paymentHistory.length > 0 ? paymentHistory[paymentHistory.length - 1].timestamp : null
			};
		} catch (error) {
			console.error("Error fetching DefiBilling user stats:", error);
			throw error;
		}
	}

	static async getAllStakers(limit = 10, offset = 0) {
		try {
			// Obtener el total de stakers (sin límite)
			const total = await this.stakingContract.getStakerCount();

			// Obtener los stakers con límite y offset
			const stakers = [];
			for (let i = offset; i < offset + limit && i < total; i++) {
				const stakerAddress = await this.stakingContract.getStakerAtIndex(i);
				const userStakes = await this.stakingContract.getUserStakes(stakerAddress);
				let currentlyStaked = ethers.BigNumber.from(0);

				for (const stake of userStakes) {
					if (!stake.claimed) {
						currentlyStaked = currentlyStaked.add(stake.amount);
					}
				}

				stakers.push({
					walletAddress: stakerAddress,
					currentlyStaked: ethers.utils.formatUnits(currentlyStaked, 18)
				});
			}

			return {stakers, total: total.toNumber()}; // Devuelve los stakers y el total
		} catch (error) {
			console.error("Error fetching all stakers:", error);
			throw error;
		}
	}

	static async processStakingEvent(event) {
		try {
			const {user, amount, duration, rewardRate} = event.args;
			const block = await event.getBlock();

			console.log('[processStakingEvent] Event data:', {
				user,
				amount,
				duration,
				rewardRate,
				blockNumber: block.number
			}); // Log del evento

			const transactionData = {
				walletAddress: user,
				transactionHash: event.transactionHash,
				type: 'stake',
				amount: amount.toString(),
				duration: Number(duration),
				apr: rewardRate.toString(),
				timestamp: new Date(block.timestamp * 1000),
				blockNumber: block.number
			};

			console.log('[processStakingEvent] Transaction data to be created:', transactionData); // Log de los datos a guardar

			const transaction = await prisma.stakingTransaction.create({
				data: transactionData
			});
			console.log('[processStakingEvent] Transaction created:', transaction); // Log de la transacción creada

			await this.updateStakingUserAnalytics(user);
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				// Errores conocidos de Prisma
				if (error.code === 'P2002') {
					console.error('[processStakingEvent] Unique constraint violation:', error.meta.target);
				} else {
					console.error('[processStakingEvent] Prisma error:', error.message);
				}
			} else {
				console.error("Error processing staking event:", error);
			}
			throw error;
		}
	}

	static async processUnstakeEvent(event) {
		try {
			const {user, amount, reward} = event.args;
			const block = await event.getBlock();

			console.log('[processUnstakeEvent] Event data:', {user, amount, reward, blockNumber: block.number});

			const transactionData = {
				walletAddress: user,
				transactionHash: event.transactionHash,
				type: 'unstake',
				amount: amount.toString(),
				rewardAmount: reward.toString(),
				timestamp: new Date(block.timestamp * 1000),
				blockNumber: block.number
			};

			console.log('[processUnstakeEvent] Transaction data to be created:', transactionData);

			const transaction = await prisma.stakingTransaction.create({
				data: transactionData
			});

			console.log('[processUnstakeEvent] Transaction created:', transaction);

			await this.updateStakingUserAnalytics(user);
		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				// Errores conocidos de Prisma
				if (error.code === 'P2002') {
					console.error('[processUnstakeEvent] Unique constraint violation:', error.meta.target);
				} else {
					console.error('[processUnstakeEvent] Prisma error:', error.message);
				}
			} else {
				console.error("Error processing unstake event:", error);
			}
			throw error;
		}
	}

	// --- Funciones que leen del contrato y la BD (MODIFICADAS) ---

	static async updateStakingUserAnalytics(walletAddress) {
		try {
			// 1. Leer datos del contrato (estado actual)
			const userStakes = await this.stakingContract.getUserStakes(walletAddress);
			let currentlyStaked = ethers.BigNumber.from(0);
			let activeStakes = 0;
			for (const stake of userStakes) {
				if (!stake.claimed) {
					currentlyStaked = currentlyStaked.add(stake.amount);
					activeStakes++;
				}
			}

			// 2. Obtener datos históricos de la base de datos
			const transactions = await prisma.stakingTransaction.findMany({
				where: {walletAddress}
			});

			const stakes = transactions.filter(tx => tx.type === 'stake');
			const unstakes = transactions.filter(tx => tx.type === 'unstake');

			// 3. Calcular métricas
			let totalStaked = stakes.reduce((sum, tx) => sum.add(tx.amount), ethers.BigNumber.from(0));
			let totalRewardsEarned = unstakes.reduce((sum, tx) => sum.add(tx.rewardAmount || 0), ethers.BigNumber.from(0));
			let firstStake = null;
			let lastStake = null;

			if (stakes.length > 0) {
				firstStake = stakes[0].timestamp;
				lastStake = stakes[stakes.length - 1].timestamp;
			}

			// Ajustar totalStaked por si ha habido retiros parciales o totales que se reflejan en userStakes
			for (const stake of stakes) {
				const stakeAmount = ethers.BigNumber.from(stake.amount.toString());
				const stakeTimestamp = ethers.BigNumber.from(stake.timestamp.getTime() / 1000);

				const isStakeActive = userStakes.some(
					(userStake) =>
						userStake.amount.eq(stakeAmount) &&
						userStake.timestamp.eq(stakeTimestamp) &&
						!userStake.claimed
				);

				if (!isStakeActive) {
					totalStaked = totalStaked.sub(stakeAmount);
				}
			}

			// Calcular duración promedio de stakes
			const stakeDurations = stakes.map(stake => stake.duration || 0);
			const averageStakeDuration = stakeDurations.length > 0
				? Math.floor(stakeDurations.reduce((a, b) => a + b) / stakeDurations.length)
				: 0;

			console.log('[updateStakingUserAnalytics] Datos para upsert:', {
				walletAddress,
				totalStakes: stakes.length,
				activeStakes,
				totalStaked: totalStaked.toString(),
				currentlyStaked: ethers.utils.formatUnits(currentlyStaked, 18),
				totalRewardsEarned: totalRewardsEarned.toString(),
				averageStakeDuration,
				firstStake,
				lastStake,
			});

			// 4. Actualizar o crear la entrada en la base de datos
			const result = await prisma.stakingUserAnalytics.upsert({
				where: {walletAddress},
				create: {
					walletAddress,
					totalStakes: stakes.length,
					activeStakes,
					totalStaked: totalStaked.toString(),
					currentlyStaked: ethers.utils.formatUnits(currentlyStaked, 18),
					totalRewardsEarned: totalRewardsEarned.toString(),
					averageStakeDuration,
					firstStake,
					lastStake
				},
				update: {
					totalStakes: stakes.length,
					activeStakes,
					totalStaked: totalStaked.toString(),
					currentlyStaked: ethers.utils.formatUnits(currentlyStaked, 18),
					totalRewardsEarned: totalRewardsEarned.toString(),
					averageStakeDuration,
					lastStake
				},
			});

			console.log('[updateStakingUserAnalytics] Resultado de upsert:', result);

		} catch (error) {
			if (error instanceof Prisma.PrismaClientKnownRequestError) {
				if (error.code === 'P2002') {
					console.error('[updateStakingUserAnalytics] Unique constraint violation:', error.meta.target);
				} else {
					console.error('[updateStakingUserAnalytics] Prisma error:', error.message);
				}
			} else {
				console.error("Error updating staking analytics:", error);
			}
			throw error;
		}
	}

	static async createStakingSnapshot() {
		try {
			// Leer directamente del contrato
			const [totalStaked, stakerCount, monthlyAPR, annualAPR, availableRewards] =
				await Promise.all([
					this.stakingContract.getTotalTvl(),
					this.stakingContract.getStakerCount(),
					this.stakingContract.monthlyAPR(),
					this.stakingContract.annualAPR(),
					this.stakingContract.getAvailableRewards()
				]);

			// Obtener el último snapshot para evitar duplicados muy cercanos en el tiempo
			const lastSnapshot = await prisma.stakingSnapshot.findFirst({
				orderBy: {timestamp: 'desc'}
			});

			const now = new Date();
			if (lastSnapshot) {
				const timeDiff = now.getTime() - lastSnapshot.timestamp.getTime();
				const minInterval = 60000; // 1 minuto en milisegundos

				if (timeDiff < minInterval) {
					console.log("[createStakingSnapshot] Skipping snapshot creation: too soon since last snapshot.");
					return;
				}
			}

			await prisma.stakingSnapshot.create({
				data: {
					totalStaked: ethers.utils.formatUnits(totalStaked, 18),
					totalStakers: stakerCount.toNumber(),
					monthlyAPR: ethers.utils.formatUnits(monthlyAPR, 18),
					annualAPR: ethers.utils.formatUnits(annualAPR, 18),
					tvl: ethers.utils.formatUnits(totalStaked, 18),
					availableRewards: ethers.utils.formatUnits(availableRewards, 18),
					timestamp: now
				}
			});
		} catch (error) {
			console.error("Error creating staking snapshot:", error);
			throw error;
		}
	}

	static async getStakingStats() {
		try {
			// Leer datos actuales del contrato
			const [totalStaked, stakerCount, monthlyAPR, annualAPR, availableRewards] = await Promise.all([
				this.stakingContract.getTotalTvl(),
				this.stakingContract.getStakerCount(),
				this.stakingContract.monthlyAPR(),
				this.stakingContract.annualAPR(),
				this.stakingContract.getAvailableRewards()
			]);

			return {
				totalStaked: ethers.utils.formatUnits(totalStaked, 18),
				totalStakers: stakerCount.toNumber(),
				monthlyAPR: ethers.utils.formatUnits(monthlyAPR, 18),
				annualAPR: ethers.utils.formatUnits(annualAPR, 18),
				tvl: ethers.utils.formatUnits(totalStaked, 18), // TVL es lo mismo que totalStaked en este caso
				availableRewards: ethers.utils.formatUnits(availableRewards, 18)
			};
		} catch (error) {
			console.error("Error fetching staking stats from contract:", error);
			throw error;
		}
	}


	static async getTopStakers(limit = 10) {
		try {
			// Obtener todos los stakers (optimizar esto si hay muchos stakers)
			const stakerCount = await this.stakingContract.getStakerCount();
			const stakers = [];
			for (let i = 0; i < stakerCount; i++) {
				const stakerAddress = await this.stakingContract.getStakerAtIndex(i);
				stakers.push(stakerAddress);
			}

			// Obtener el currentlyStaked de cada staker directamente del contrato
			const stakerBalances = await Promise.all(
				stakers.map(async (stakerAddress) => {
					const userStakes = await this.stakingContract.getUserStakes(stakerAddress);
					let currentlyStaked = ethers.BigNumber.from(0);
					for (const stake of userStakes) {
						if (!stake.claimed) {
							currentlyStaked = currentlyStaked.add(stake.amount);
						}
					}
					return {walletAddress: stakerAddress, currentlyStaked};
				})
			);

			// Ordenar por currentlyStaked en orden descendente usando comparaciones de BigNumber
			const topStakers = stakerBalances
				.sort((a, b) => {
					if (b.currentlyStaked.gt(a.currentlyStaked)) {
						return 1;
					} else if (b.currentlyStaked.lt(a.currentlyStaked)) {
						return -1;
					} else {
						return 0;
					}
				})
				.slice(0, limit)
				.map(staker => ({
					walletAddress: staker.walletAddress,
					currentlyStaked: ethers.utils.formatUnits(staker.currentlyStaked, 18)
				}));

			return topStakers;
		} catch (error) {
			console.error("Error fetching top stakers:", error);
			throw error;
		}
	}


	static async getStakingMetrics(startDate, endDate) {
		try {
			const snapshots = await prisma.stakingSnapshot.findMany({
				where: {
					timestamp: {
						gte: startDate,
						lte: endDate
					}
				},
				orderBy: {timestamp: 'asc'}
			});

			// Mapear los datos de los snapshots a un formato más amigable
			return {
				tvlHistory: snapshots.map(s => ({
					timestamp: s.timestamp,
					tvl: s.tvl
				})),
				aprHistory: snapshots.map(s => ({
					timestamp: s.timestamp,
					monthlyAPR: s.monthlyAPR,
					annualAPR: s.annualAPR
				}))
			};
		} catch (error) {
			console.error("Error fetching staking metrics:", error);
			throw error;
		}
	}

	// --- Funciones de Utilidad (mejoradas) ---

	static async startEventListeners() {
		try {
			const handleStakedEvent = async (...args) => {
				const event = args[args.length - 1];
				await this.processStakingEvent(event);
				await this.createStakingSnapshot();
			};

			const handleUnstakedEvent = async (...args) => {
				const event = args[args.length - 1];
				await this.processUnstakeEvent(event);
				await this.createStakingSnapshot();
			};

			// Registrar listeners
			this.stakingContract.on("Staked", handleStakedEvent);
			this.stakingContract.on("Unstaked", handleUnstakedEvent);

			// Guardar referencias a los listeners para poder removerlos más tarde
			this.stakedEventListener = handleStakedEvent;
			this.unstakedEventListener = handleUnstakedEvent;

			// Programar snapshots periódicos (cada hora)
			this.snapshotInterval = setInterval(async () => {
				await this.createStakingSnapshot();
			}, 3600000);

			console.log("Event listeners started");
		} catch (error) {
			console.error("Error starting event listeners:", error);
			throw error;
		}
	}

	static async stopEventListeners() {
		try {
			// Remover listeners de eventos
			if (this.stakedEventListener) {
				this.stakingContract.off("Staked", this.stakedEventListener);
				this.stakedEventListener = null;
			}
			if (this.unstakedEventListener) {
				this.stakingContract.off("Unstaked", this.unstakedEventListener);
				this.unstakedEventListener = null;
			}

			// Limpiar intervalo de snapshots
			if (this.snapshotInterval) {
				clearInterval(this.snapshotInterval);
				this.snapshotInterval = null;
			}

			console.log("Event listeners stopped");
		} catch (error) {
			console.error("Error stopping event listeners:", error);
			throw error;
		}
	}

	static async processHistoricalData(fromBlock, toBlock) {
		const MAX_BLOCK_RANGE = 2048; // Limite de bloques por consulta
		try {
			for (let currentBlock = fromBlock; currentBlock <= toBlock; currentBlock += MAX_BLOCK_RANGE) {
				const endBlock = Math.min(currentBlock + MAX_BLOCK_RANGE - 1, toBlock);

				const stakedFilter = this.stakingContract.filters.Staked();
				const unstakedFilter = this.stakingContract.filters.Unstaked();

				const [stakedEvents, unstakedEvents] = await Promise.all([
					this.stakingContract.queryFilter(stakedFilter, currentBlock, endBlock),
					this.stakingContract.queryFilter(unstakedFilter, currentBlock, endBlock)
				]);

				for (const event of stakedEvents) {
					await this.processStakingEvent(event);
				}

				for (const event of unstakedEvents) {
					await this.processUnstakeEvent(event);
				}
			}

			await this.createStakingSnapshot();
		} catch (error) {
			console.error("Error processing historical data:", error);
			throw error;
		}
	}

	static async createUserSnapshot(user) {
		try {
			const existingSnapshot = await prisma.combinedUserMetrics.findUnique({
				where: {walletAddress: user.wallet}
			});

			if (!existingSnapshot) {
				const stakingData = await prisma.stakingUserAnalytics.findUnique({
					where: {walletAddress: user.wallet}
				});

				const web3Data = await prisma.web3UserAnalytics.findUnique({
					where: {walletAddress: user.wallet}
				});

				let totalValueLocked = 0;
				if (stakingData) {
					totalValueLocked += parseFloat(stakingData.currentlyStaked);
				}
				if (web3Data) {
					totalValueLocked += parseFloat(web3Data.avaxVolume);
					totalValueLocked += parseFloat(web3Data.usdtVolume);
				}

				await prisma.combinedUserMetrics.create({
					data: {
						walletAddress: user.wallet,
						totalValueLocked: totalValueLocked.toFixed(8),
						stakingBalance: stakingData?.currentlyStaked || '0',
						totalRewards: stakingData?.totalRewardsEarned || '0',
						totalTransactions: (stakingData?.totalStakes || 0) + (web3Data?.totalPayments || 0),
						lastActivity: stakingData?.lastStake || web3Data?.lastPayment || new Date(),
						// ... otros campos según tu modelo CombinedUserMetrics
					}
				});
				console.log(`[createUserSnapshot] Snapshot created for user: ${user.wallet}`);
			}
		} catch (error) {
			console.error("Error creating user snapshot:", error);
			throw error;
		}
	}
}

export default Web3AnalyticsExtended;
