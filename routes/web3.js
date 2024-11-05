import { auth, getRouter } from '@thewebchimp/primate';
import Web3Controller from '../controllers/web3.controller.js';

const router = getRouter();

router.get('/staked-balance', Web3Controller.getStakedBalance);

router.get('/stake/:userAddress', Web3Controller.getStake);

router.get('/monthly-apr', Web3Controller.getMonthlyAPR);

router.get('/annual-apr', Web3Controller.getAnnualAPR);

router.get('/calculate-reward/:userAddress', Web3Controller.calculateReward);

router.post('/build-stake-transaction/:userAddress', Web3Controller.buildStakeTransaction);


router.post('/build-unstake-transaction/:userAddress', Web3Controller.buildUnstakeTransaction);


router.post('/build-approval-transaction/:userAddress', Web3Controller.buildApprovalTransaction);

// Añadir la nueva ruta para obtener los active stakes de un usuario
router.get('/active-stakes/:userAddress', Web3Controller.getActiveStakes);


// Añadir la nueva ruta para obtener el historial de staking de un usuario
router.get('/staking-history/:userAddress', Web3Controller.getStakingHistory);


// Añadir la nueva ruta para obtener los active stakes de un usuario
router.get('/active-stakes/:userAddress', Web3Controller.getActiveStakes);

// Añadir la nueva ruta para obtener el historial de staking de un usuario
router.get('/staking-history/:userAddress', Web3Controller.getStakingHistory);

// Ruta para construir la transacción de registrar pago
router.post('/build-record-payment-transaction/:userAddress', Web3Controller.buildRecordPaymentTransaction);

// Ruta para obtener el historial de pagos
router.get('/payment-history/:userAddress', Web3Controller.getPaymentHistory);

// Ruta para construir la transacción de retirar fondos
router.post('/build-withdraw-funds-transaction/:userAddress', Web3Controller.buildWithdrawFundsTransaction);

// Ruta para construir la transacción de retirar todos los fondos
router.post('/build-withdraw-all-funds-transaction/:userAddress', Web3Controller.buildWithdrawAllFundsTransaction);

router.get('/synchronize-payment-history', auth, Web3Controller.synchronizePaymentHistory);

// Nuevas rutas para StakingContractV5
router.get('/staking-limits', Web3Controller.getStakingLimits);
router.get('/contract-stats', Web3Controller.getContractStats);
router.post('/build-emergency-withdraw-transaction/:userAddress', Web3Controller.buildEmergencyWithdrawTransaction);
router.get('/contract-paused', Web3Controller.isContractPaused);
router.get('/stakers', Web3Controller.getStakers);

export { router };
