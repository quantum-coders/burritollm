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



export { router };
