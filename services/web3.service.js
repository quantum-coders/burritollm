import {ethers} from 'ethers';
import BurritoToken from '../abis/BurritoToken.json' assert {type: 'json'};
import StakingContractV3 from '../abis/StakingContractV3.json' assert {type: 'json'};
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
        StakingContractV3.abi,
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
            const stakedBalance = await Web3Service.burritoToken.balanceOf(Web3Service.STAKING_CONTRACT_ADDRESS);
            const formattedBalance = ethers.utils.formatUnits(stakedBalance, 18);
            return formattedBalance;
        } catch (error) {
            console.error("Error fetching staked balance:", error);
            throw error;
        }
    }

    static async getStake(userAddress) {
        try {
            const stake = await Web3Service.stakingContract.currentStakes(userAddress);
            const formattedStake = {
                amount: ethers.utils.formatUnits(stake.amount, 18),
                timestamp: new Date(stake.timestamp.toNumber() * 1000), // Convert to Date object
                duration: stake.duration.toNumber() // Convert to number
            };
            return formattedStake;
        } catch (error) {
            console.error(`Error fetching stake for ${userAddress}:`, error);
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
            const reward = await Web3Service.stakingContract.calculateReward(userAddress);
            const formattedReward = ethers.utils.formatUnits(reward, 18);
            return formattedReward;
        } catch (error) {
            console.error(`Error calculating reward for ${userAddress}:`, error);
            throw error;
        }
    }

    static async buildStakeTransaction(amount, duration, signerAddress) {

        // Convertir amount a string si no lo es ya
        const amountString = amount.toString();

        const amountToStake = ethers.utils.parseUnits(amountString, 18);

        // Allow the contract to spend user's Burrito tokens
        const allowance = await Web3Service.burritoToken.allowance(
            signerAddress,
            Web3Service.STAKING_CONTRACT_ADDRESS
        );
        const populatedTx = await Web3Service.stakingContract.populateTransaction.stake(
            amountToStake,
            duration,
            {gasLimit: 3000000} // Adjust gas limit as needed
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

    static async buildUnstakeTransaction(signerAddress) {
        return await Web3Service.stakingContract.populateTransaction.unstake(
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

    // Nueva función para obtener el historial de pagos
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

    // Nueva función para retirar fondos
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

    // Nueva función para retirar todos los fondos
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
            const stake = await Web3Service.stakingContract.currentStakes(userAddress);
            if (stake.timestamp > 0) {
                const currentTimestamp = Math.floor(Date.now() / 1000);
                const isActive = currentTimestamp < (stake.timestamp.toNumber() + stake.duration.toNumber() * 86400);

                if (isActive) {
                    const activeStake = {
                        amount: ethers.utils.formatUnits(stake.amount, 18),
                        startDate: new Date(stake.timestamp.toNumber() * 1000), // Convert to Date object
                        endDate: new Date((stake.timestamp.toNumber() + stake.duration.toNumber() * 86400) * 1000), // Calculate end date
                        rewards: await Web3Service.calculateReward(userAddress)
                    };
                    return [activeStake];
                }
            }
            return [];
        } catch (error) {
            console.error(`Error fetching active stakes for ${userAddress}:`, error);
            throw error;
        }
    }

    static async getStakingHistory(userAddress) {
        try {
            const stakeHistory = await Web3Service.stakingContract.getStakeHistory(userAddress);
            const history = await Promise.all(stakeHistory.map(async (stake) => {
                const startDate = new Date(stake.timestamp.toNumber() * 1000);
                const endDate = new Date((stake.timestamp.toNumber() + stake.duration.toNumber() * 86400) * 1000);
                const rewards = await Web3Service.calculateReward(userAddress);
                return {
                    amount: ethers.utils.formatUnits(stake.amount, 18),
                    startDate,
                    endDate,
                    rewards,
                    status: endDate <= new Date() ? 'Completed' : 'Active'
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
            amount:  parseFloat(tx.amount),
            currency: tx.currency,
            timestamp: Number(tx.timestamp)
        }));

        const parsedTransactionsFromContract = paymentHistoryFromContract.map(contractTx => ({
            amount: parseFloat(contractTx.avaxAmount !== '0.0' ? contractTx.avaxAmount : contractTx.usdtAmount),
            currency: contractTx.avaxAmount !== '0.0' ? 'AVAX' : 'USDT',
            timestamp: contractTx.timestamp * 1000,
        }));
        // Finding Transactions to Sync (Corrected)
        const txToSync = parsedTransactionsFromContract.filter(contractTx => {
            return !parsedTransactionsFromDb.some(dbTx =>
                dbTx.amount == contractTx.amount &&
                dbTx.currency == contractTx.currency &&
                dbTx.timestamp === contractTx.timestamp
            );
        });


        // Syncing Transactions, create entries for
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

        // iterate all transactions to sync and if is AVAX conver it to USDT
        let balanceToAdd = 0.0
        for (let i = 0; i < txToSync.length; i++) {
            if (txToSync[i].currency === 'AVAX') {
                const avaxPrice = await Web3Service.getAvaxPrice();
                const usdtAmount = txToSync[i].amount * avaxPrice;
                balanceToAdd += usdtAmount;
            }else{
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
        return price / 1e8
    }
}

export default Web3Service;
