import {prisma} from "@thewebchimp/primate";
import Web3AnalyticsExtended from "../services/web3.analytics.js";

class Web3AnalyticsController {
	static async getDefiBillingStats(req, res) {
		try {
			const stats = await Web3AnalyticsExtended.getDefiBillingStats();
			console.log('[getDefiBillingStats] Response data:', stats);
			res.respond({
				data: stats,
				message: "DefiBilling stats fetched successfully"
			});
		} catch (error) {
			console.error('[getDefiBillingStats] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch DefiBilling stats"
			});
		}
	}

	static async getDefiBillingUserStats(req, res) {
		const {userAddress} = req.params;
		console.log('[getDefiBillingUserStats] Fetching for address:', userAddress);
		try {
			const userStats = await Web3AnalyticsExtended.getDefiBillingUserStats(userAddress);
			console.log('[getDefiBillingUserStats] Response data:', userStats);
			res.respond({
				data: userStats,
				message: "DefiBilling user stats fetched successfully"
			});
		} catch (error) {
			console.error('[getDefiBillingUserStats] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch DefiBilling user stats"
			});
		}
	}

	static async getDefiBillingPaymentHistory(req, res) {
		const {userAddress} = req.params;
		console.log('[getDefiBillingPaymentHistory] Fetching for address:', userAddress);
		try {
			const paymentHistory = await Web3AnalyticsExtended.getPaymentHistory(userAddress);
			console.log('[getDefiBillingPaymentHistory] Response data:', paymentHistory);
			res.respond({
				data: paymentHistory,
				message: "DefiBilling payment history fetched successfully"
			});
		} catch (error) {
			console.error('[getDefiBillingPaymentHistory] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch DefiBilling payment history"
			});
		}
	}

	static async getStakingStats(req, res) {
		try {
			const stats = await Web3AnalyticsExtended.getStakingStats();
			console.log('[getStakingStats] Response data:', stats);
			res.respond({
				data: stats,
				message: "Staking stats fetched successfully"
			});
		} catch (error) {
			console.error('[getStakingStats] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch staking stats"
			});
		}
	}

	static async getAllStakers(req, res) {
		const {page = 1, limit = 10} = req.query;
		const offset = (page - 1) * limit;

		try {
			const {stakers, total} = await Web3AnalyticsExtended.getAllStakers(limit, offset);
			const totalPages = Math.ceil(total / limit);

			console.log('[getAllStakers] Response data:', {stakers, total, totalPages});

			res.respond({
				data: {
					stakers,
					totalPages
				},
				message: "All stakers fetched successfully with pagination"
			});
		} catch (error) {
			console.error('[getAllStakers] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch all stakers"
			}, 500);
		}
	}

	static async getStakingMetrics(req, res) {
		const {startDate, endDate} = req.query;
		console.log('[getStakingMetrics] Date range:', {startDate, endDate});
		try {
			const metrics = await Web3AnalyticsExtended.getStakingMetrics(
				new Date(startDate),
				new Date(endDate)
			);
			console.log('[getStakingMetrics] Response data:', metrics);
			res.respond({
				data: metrics,
				message: "Staking metrics fetched successfully"
			});
		} catch (error) {
			console.error('[getStakingMetrics] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch staking metrics"
			});
		}
	}

	static async startAnalyticsTracking(req, res) {
		console.log('[startAnalyticsTracking] Starting event listeners');
		try {
			await Web3AnalyticsExtended.startEventListeners();
			console.log('[startAnalyticsTracking] Event listeners started successfully');
			res.respond({
				message: "Analytics tracking started successfully"
			});
		} catch (error) {
			console.error('[startAnalyticsTracking] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to start analytics tracking"
			});
		}
	}

	static async processHistoricalData(req, res) {
		const {fromBlock, toBlock} = req.body;
		console.log('[processHistoricalData] Processing blocks:', {fromBlock, toBlock});
		try {
			await Web3AnalyticsExtended.processHistoricalData(
				Number(fromBlock),
				Number(toBlock)
			);
			console.log('[processHistoricalData] Historical data processed successfully');
			res.respond({
				message: "Historical data processed successfully"
			});
		} catch (error) {
			console.error('[processHistoricalData] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to process historical data"
			});
		}
	}

	static async getStakingUserAnalytics(req, res) {
		const {userAddress} = req.params;
		console.log('[getStakingUserAnalytics] Fetching for address:', userAddress);
		try {
			let userAnalytics = await prisma.stakingUserAnalytics.findUnique({
				where: {walletAddress: userAddress}
			});

			if (!userAnalytics) {
				console.log('[getStakingUserAnalytics] No analytics found for user, updating...');
				await Web3AnalyticsExtended.updateStakingUserAnalytics(userAddress);
				userAnalytics = await prisma.stakingUserAnalytics.findUnique({
					where: {walletAddress: userAddress}
				});

				if (!userAnalytics) {
					console.log('[getStakingUserAnalytics] Still no analytics found for user');
					return res.respond({
						message: "No analytics found for this user, even after update attempt."
					}, 404);
				}
			}

			console.log('[getStakingUserAnalytics] Response data:', userAnalytics);
			res.respond({
				data: userAnalytics,
				message: "User analytics fetched successfully"
			});
		} catch (error) {
			console.error('[getStakingUserAnalytics] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch user analytics"
			});
		}
	}

	static async getStakingSnapshots(req, res) {
		const {limit = 24, offset = 0} = req.query;
		console.log('[getStakingSnapshots] Query params:', {limit, offset});
		try {
			const snapshots = await prisma.stakingSnapshot.findMany({
				take: Number(limit),
				skip: Number(offset),
				orderBy: {
					timestamp: 'desc'
				}
			});
			console.log('[getStakingSnapshots] Found snapshots count:', snapshots.length);
			console.log('[getStakingSnapshots] First snapshot:', snapshots[0]);

			res.respond({
				data: snapshots,
				message: "Staking snapshots fetched successfully"
			});
		} catch (error) {
			console.error('[getStakingSnapshots] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch staking snapshots"
			});
		}
	}

	static async createManualSnapshot(req, res) {
		console.log('[createManualSnapshot] Creating new snapshot');
		try {
			await Web3AnalyticsExtended.createStakingSnapshot();
			console.log('[createManualSnapshot] Snapshot created successfully');
			res.respond({
				message: "Manual snapshot created successfully"
			});
		} catch (error) {
			console.error('[createManualSnapshot] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to create manual snapshot"
			});
		}
	}

	static async updateUserAnalytics(req, res) {
		const {userAddress} = req.params;
		console.log('[updateUserAnalytics] Updating analytics for:', userAddress);
		try {
			await Web3AnalyticsExtended.updateStakingUserAnalytics(userAddress);
			console.log('[updateUserAnalytics] Analytics updated successfully');
			res.respond({
				message: "User analytics updated successfully"
			});
		} catch (error) {
			console.error('[updateUserAnalytics] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to update user analytics"
			});
		}
	}

	static async getAnalyticsDashboard(req, res) {
		console.log('[getAnalyticsDashboard] Fetching dashboard data');
		try {
			const [
				currentStats,
				topStakers,
				recentSnapshots
			] = await Promise.all([
				Web3AnalyticsExtended.getStakingStats(),
				Web3AnalyticsExtended.getTopStakers(5),
				prisma.stakingSnapshot.findMany({
					take: 24,
					orderBy: {
						timestamp: 'desc'
					}
				})
			]);

			console.log('[getAnalyticsDashboard] Current stats:', currentStats);
			console.log('[getAnalyticsDashboard] Top stakers count:', topStakers.length);
			console.log('[getAnalyticsDashboard] Recent snapshots count:', recentSnapshots.length);

			res.respond({
				data: {
					currentStats,
					topStakers,
					recentSnapshots
				},
				message: "Analytics dashboard data fetched successfully"
			});
		} catch (error) {
			console.error('[getAnalyticsDashboard] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch analytics dashboard data"
			});
		}
	}

	static async getStakingTransactionHistory(req, res) {
		const {userAddress} = req.params;
		const {limit = 10, offset = 0, type} = req.query;
		console.log('[getStakingTransactionHistory] Query params:', {userAddress, limit, offset, type});

		try {
			const whereClause = {
				walletAddress: userAddress,
				...(type && {type})
			};

			const transactions = await prisma.stakingTransaction.findMany({
				where: whereClause,
				take: Number(limit),
				skip: Number(offset),
				orderBy: {
					timestamp: 'desc'
				}
			});

			const total = await prisma.stakingTransaction.count({
				where: whereClause
			});

			console.log('[getStakingTransactionHistory] Transactions found:', transactions.length);
			console.log('[getStakingTransactionHistory] Total count:', total);
			console.log('[getStakingTransactionHistory] First transaction:', transactions[0]);

			res.respond({
				data: {
					transactions,
					total,
					hasMore: total > Number(offset) + transactions.length
				},
				message: "Transaction history fetched successfully"
			});
		} catch (error) {
			console.error('[getStakingTransactionHistory] Error:', error);
			res.respond({
				error: error.message,
				message: "Failed to fetch transaction history"
			});
		}
	}
}

export default Web3AnalyticsController;
