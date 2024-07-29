import Web3Service from "../services/web3.service.js";
import {prisma} from "@thewebchimp/primate";

class Web3Controller {
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

        console.log("PARAMS", amount, duration, signerAddress)
        try {
            const stakeTx = await Web3Service.buildStakeTransaction(amount, duration, signerAddress);
            console.log("STAKE TX", stakeTx)
            res.respond({
                data: stakeTx,
                message: "Stake transaction built successfully",
            });
        } catch (error) {
            console.log("ERROR", error)
            res.respond({
                error: error.message,
                message: "Failed to build stake transaction",
            }, 500);
        }
    }

    static async buildUnstakeTransaction(req, res) {
        const signerAddress = req.params.userAddress;

        try {
            const unstakeTx = await Web3Service.buildUnstakeTransaction(signerAddress);
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
        console.log("PARAMS super controller", amount, contract, signerAddress)
        try {
            let spenderAddress;
            if (contract === 'staking') {
                spenderAddress = Web3Service.STAKING_CONTRACT_ADDRESS;
            }
            const approveTx = await Web3Service.buildApprovalTransaction(amount, spenderAddress, signerAddress);
            console.log("APPROVE TX", approveTx)
            res.respond({
                data: approveTx,
                message: "Approval transaction built successfully",
            });
        } catch (error) {
            console.log("ERROR", error)
            res.respond({
                error: error,
                message: "Failed to build approval transaction",
            }, 500);
        }
    }

    // Añadir el nuevo método en el controlador
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

    // Añadir el nuevo método en el controlador
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

    static async buildRecordPaymentTransaction(req, res) {
        const {avaxAmount, usdtAmount} = req.body;
        const signerAddress = req.params.userAddress;

        console.log(`Building record payment transaction for user ${signerAddress} with AVAX: ${avaxAmount} and USDT: ${usdtAmount}`);
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

    // Nueva función para obtener el historial de pagos
    static async getPaymentHistory(req, res) {
        const {userAddress} = req.params;
        console.log(`Fetching payment history for user ${userAddress}...`);
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

    // Nueva función para construir la transacción de retirar fondos
    static async buildWithdrawFundsTransaction(req, res) {
        const {avaxAmount, usdtAmount} = req.body;
        const signerAddress = req.params.userAddress;

        console.log(`Building withdraw funds transaction for user ${signerAddress} with AVAX: ${avaxAmount} and USDT: ${usdtAmount}`);
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

    // Nueva función para construir la transacción de retirar todos los fondos
    static async buildWithdrawAllFundsTransaction(req, res) {
        const signerAddress = req.params.userAddress;
        console.log(`Building withdraw all funds transaction for user ${signerAddress}...`);
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
        console.log("idUser is", idUser)
        console.log(`Synchronizing payment history for user ${idUser}...`);
        const user = await prisma.user.findUnique({
            where: {
                id: idUser,
            },
        });



        console.log(`Synchronizing payment history for user ${user.wallet}...`);
        try {
            await Web3Service.synchronizePaymentHistory(user.wallet)

            res.status(200).json({
                message: 'Payment history synchronized successfully',
            });
        } catch (error) {
            res.status(500).json({
                error: error.message,
                message: 'Failed to synchronize payment history',
            });
        }
    }
}

export default Web3Controller;
