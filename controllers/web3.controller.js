import Web3Service from "../services/web3.service.js";

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

}

export default Web3Controller;
