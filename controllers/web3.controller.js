import Web3Service from "../services/web3.service.js";
import {prisma} from "@thewebchimp/primate";

class Web3Controller {
    // Mantener los métodos existentes que no requieren cambios
    static async getStakedBalance(req, res) {
        try {
            const balance = await Web3Service.getStakedBalance();
            res.respond({
                data: balance,
                message: "Staked balance fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch staked balance",
            }, 500);
        }
    }

    static async getStake(req, res) {
        const {userAddress} = req.params;
        try {
            const stake = await Web3Service.getStake(userAddress);
            res.respond({
                data: stake,
                message: "Stake details fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch stake details",
            }, 500);
        }
    }

    static async getMonthlyAPR(req, res) {
        try {
            const apr = await Web3Service.getMonthlyAPR();
            res.respond({
                data: apr,
                message: "Monthly APR fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch monthly APR",
            }, 500);
        }
    }

    static async getAnnualAPR(req, res) {
        try {
            const apr = await Web3Service.getAnnualAPR();
            res.respond({
                data: apr,
                message: "Annual APR fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch annual APR",
            }, 500);
        }
    }

    static async calculateReward(req, res) {
        const {userAddress} = req.params;
        try {
            const reward = await Web3Service.calculateReward(userAddress);
            res.respond({
                data: reward,
                message: "Reward calculated successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to calculate reward",
            }, 500);
        }
    }

    static async buildStakeTransaction(req, res) {
        const {amount, duration} = req.body;
        const signerAddress = req.params.userAddress;

        try {
            const stakeTx = await Web3Service.buildStakeTransaction(amount, duration, signerAddress);
            res.respond({
                data: stakeTx,
                message: "Stake transaction built successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to build stake transaction",
            }, 500);
        }
    }

    // Actualizar para incluir stakeIndex
    static async buildUnstakeTransaction(req, res) {
        const signerAddress = req.params.userAddress;
        const {stakeIndex} = req.body;

        try {
            const unstakeTx = await Web3Service.buildUnstakeTransaction(stakeIndex, signerAddress);
            res.respond({
                data: unstakeTx,
                message: "Unstake transaction built successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to build unstake transaction",
            }, 500);
        }
    }

    static async buildApprovalTransaction(req, res) {
        const {amount, contract} = req.body;
        const signerAddress = req.params.userAddress;
        try {
            let spenderAddress;
            if (contract === 'staking') {
                spenderAddress = Web3Service.STAKING_CONTRACT_ADDRESS;
            }
            const approveTx = await Web3Service.buildApprovalTransaction(amount, spenderAddress, signerAddress);
            res.respond({
                data: approveTx,
                message: "Approval transaction built successfully",
            });
        } catch (error) {
            res.respond({
                error: error,
                message: "Failed to build approval transaction",
            }, 500);
        }
    }

    static async getActiveStakes(req, res) {
        const {userAddress} = req.params;
        try {
            const activeStakes = await Web3Service.getActiveStakes(userAddress);
            res.respond({
                data: activeStakes,
                message: "Active stakes fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch active stakes",
            }, 500);
        }
    }

    static async getStakingHistory(req, res) {
        const {userAddress} = req.params;
        try {
            const stakingHistory = await Web3Service.getStakingHistory(userAddress);
            res.respond({
                data: stakingHistory,
                message: "Staking history fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch staking history",
            }, 500);
        }
    }

    // Mantener los métodos de DeFi y pagos sin cambios
    static async buildRecordPaymentTransaction(req, res) {
        const {avaxAmount, usdtAmount} = req.body;
        const signerAddress = req.params.userAddress;

        try {
            const recordPaymentTx = await Web3Service.buildRecordPaymentTransaction(avaxAmount, usdtAmount, signerAddress);
            res.respond({
                data: recordPaymentTx,
                message: "Record payment transaction built successfully",
            });
        } catch (error) {
            console.error("Error building record payment transaction:", error);
            res.respond({
                error: error.message,
                message: "Failed to build record payment transaction",
            }, 500);
        }
    }

    static async getPaymentHistory(req, res) {
        const {userAddress} = req.params;
        try {
            const paymentHistory = await Web3Service.getPaymentHistory(userAddress);
            res.respond({
                data: paymentHistory,
                message: "Payment history fetched successfully",
            });
        } catch (error) {
            console.error(`Error fetching payment history for user ${userAddress}:`, error);
            res.respond({
                error: error.message,
                message: "Failed to fetch payment history",
            }, 500);
        }
    }

    static async buildWithdrawFundsTransaction(req, res) {
        const {avaxAmount, usdtAmount} = req.body;
        const signerAddress = req.params.userAddress;

        try {
            const withdrawFundsTx = await Web3Service.buildWithdrawFundsTransaction(avaxAmount, usdtAmount, signerAddress);
            res.respond({
                data: withdrawFundsTx,
                message: "Withdraw funds transaction built successfully",
            });
        } catch (error) {
            console.error("Error building withdraw funds transaction:", error);
            res.respond({
                error: error.message,
                message: "Failed to build withdraw funds transaction",
            }, 500);
        }
    }

    static async buildWithdrawAllFundsTransaction(req, res) {
        const signerAddress = req.params.userAddress;
        try {
            const withdrawAllFundsTx = await Web3Service.buildWithdrawAllFundsTransaction(signerAddress);
            res.respond({
                data: withdrawAllFundsTx,
                message: "Withdraw all funds transaction built successfully",
            });
        } catch (error) {
            console.error("Error building withdraw all funds transaction:", error);
            res.respond({
                error: error.message,
                message: "Failed to build withdraw all funds transaction",
            }, 500);
        }
    }

    static async synchronizePaymentHistory(req, res) {
        const idUser = req.user.payload.id;
        const user = await prisma.user.findUnique({
            where: {
                id: idUser,
            },
        });

        try {
            await Web3Service.synchronizePaymentHistory(user.wallet)
            res.respond({
                message: 'Payment history synchronized successfully',
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: 'Failed to synchronize payment history',
            }, 500);
        }
    }

    // Nuevos métodos para las funcionalidades adicionales del V5
    static async getStakingLimits(req, res) {
        try {
            const limits = await Web3Service.getStakingLimits();
            res.respond({
                data: limits,
                message: "Staking limits fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch staking limits",
            }, 500);
        }
    }

    static async getContractStats(req, res) {
        try {
            const stats = await Web3Service.getContractStats();
            res.respond({
                data: stats,
                message: "Contract stats fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch contract stats",
            }, 500);
        }
    }

    static async buildEmergencyWithdrawTransaction(req, res) {
        const {stakeIndex} = req.body;
        try {
            const emergencyWithdrawTx = await Web3Service.buildEmergencyWithdrawTransaction(stakeIndex);
            res.respond({
                data: emergencyWithdrawTx,
                message: "Emergency withdraw transaction built successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to build emergency withdraw transaction",
            }, 500);
        }
    }

    static async isContractPaused(req, res) {
        try {
            const isPaused = await Web3Service.isContractPaused();
            res.respond({
                data: isPaused,
                message: "Contract pause status fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch contract pause status",
            }, 500);
        }
    }

    static async getStakers(req, res) {
        const {startIndex = 0, count = 10} = req.query;
        try {
            const stakers = await Web3Service.getStakers(Number(startIndex), Number(count));
            res.respond({
                data: stakers,
                message: "Stakers list fetched successfully",
            });
        } catch (error) {
            res.respond({
                error: error.message,
                message: "Failed to fetch stakers list",
            }, 500);
        }
    }
}

export default Web3Controller;
