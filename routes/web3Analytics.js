import Web3AnalyticsController from "../controllers/web3.analytics.controller.js";
import {auth, getRouter} from '@thewebchimp/primate';

const router = getRouter();

// General staking statistics and metrics
router.get('/staking-stats', Web3AnalyticsController.getStakingStats);


router.get('/staking-metrics', Web3AnalyticsController.getStakingMetrics);

// User-specific analytics
router.get('/user/:userAddress', Web3AnalyticsController.getStakingUserAnalytics);

router.post('/user/:userAddress/update', auth, Web3AnalyticsController.updateUserAnalytics);

router.get('/user/:userAddress/transactions', Web3AnalyticsController.getStakingTransactionHistory);

// Snapshots management
router.get('/snapshots', Web3AnalyticsController.getStakingSnapshots);

router.post('/snapshots/create', auth, Web3AnalyticsController.createManualSnapshot);

// Historical data processing
router.post('/process-historical', auth, Web3AnalyticsController.processHistoricalData);

// Analytics tracking management
router.post('/start-tracking', auth, Web3AnalyticsController.startAnalyticsTracking);

router.get('/all-stakers', Web3AnalyticsController.getAllStakers);

// Dashboard data
router.get('/dashboard', Web3AnalyticsController.getAnalyticsDashboard);

router.get('/defibilling-stats', Web3AnalyticsController.getDefiBillingStats);

router.get('/defibilling/user/:userAddress/stats', Web3AnalyticsController.getDefiBillingUserStats);

router.get('/defibilling/user/:userAddress/payments', Web3AnalyticsController.getDefiBillingPaymentHistory);


export {router};
