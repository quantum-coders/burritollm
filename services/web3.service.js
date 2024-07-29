import {ethers} from 'ethers';
import BurritoToken from '../abis/BurritoToken.json' assert {type: 'json'};
import StakingContractV3 from '../abis/StakingContractV3.json' assert {type: 'json'};
import DefiBillingV2 from '../abis/DefiBillingV2.json' assert {type: 'json'};
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
        DefiBillingV2.abi,
        Web3Service.provider
    );

    static async getStakedBalance() {
        console.log("Fetching total staked Burrito balance...");
        try {
            const stakedBalance = await Web3Service.burritoToken.balanceOf(Web3Service.STAKING_CONTRACT_ADDRESS);
            const formattedBalance = ethers.utils.formatUnits(stakedBalance, 18);
            console.log("Total staked Burrito balance:", formattedBalance);
            return formattedBalance;
        } catch (error) {
            console.error("Error fetching staked balance:", error);
            throw error;
        }
    }

    static async getStake(userAddress) {
        console.log(`Fetching stake details for user ${userAddress}...`);
        try {
            const stake = await Web3Service.stakingContract.currentStakes(userAddress);
            const formattedStake = {
                amount: ethers.utils.formatUnits(stake.amount, 18),
                timestamp: new Date(stake.timestamp.toNumber() * 1000), // Convert to Date object
                duration: stake.duration.toNumber() // Convert to number
            };
            console.log(`Stake details for ${userAddress}:`, formattedStake);
            return formattedStake;
        } catch (error) {
            console.error(`Error fetching stake for ${userAddress}:`, error);
            throw error;
        }
    }

    static async getMonthlyAPR() {
        console.log("Fetching monthly APR...");
        try {
            const monthlyAPR = await Web3Service.stakingContract.monthlyAPR();
            const formattedAPR = ethers.utils.formatUnits(monthlyAPR, 18);
            console.log("Monthly APR:", formattedAPR);
            return formattedAPR * 100;
        } catch (error) {
            console.error("Error fetching monthly APR:", error);
            throw error;
        }
    }

    static async getAnnualAPR() {
        console.log("Fetching annual APR...");
        try {
            const annualAPR = await Web3Service.stakingContract.annualAPR();
            const formattedAPR = ethers.utils.formatUnits(annualAPR, 18);
            console.log("Annual APR:", formattedAPR);
            return formattedAPR * 100;
        } catch (error) {
            console.error("Error fetching annual APR:", error);
            throw error;
        }
    }

    static async calculateReward(userAddress) {
        console.log(`Calculating reward for user ${userAddress}...`);
        try {
            const reward = await Web3Service.stakingContract.calculateReward(userAddress);
            const formattedReward = ethers.utils.formatUnits(reward, 18);
            console.log(`Reward for ${userAddress}:`, formattedReward);
            return formattedReward;
        } catch (error) {
            console.error(`Error calculating reward for ${userAddress}:`, error);
            throw error;
        }
    }

    static async buildStakeTransaction(amount, duration, signerAddress) {
        console.log(`Starting buildStakeTransaction with amount: ${amount}, duration: ${duration}, signerAddress: ${signerAddress}`);

        // Convertir amount a string si no lo es ya
        const amountString = amount.toString();
        console.log(`Amount as string: ${amountString}`);

        const amountToStake = ethers.utils.parseUnits(amountString, 18);
        console.log(`Amount to stake in wei: ${amountToStake.toString()}`);

        // Allow the contract to spend user's Burrito tokens
        const allowance = await Web3Service.burritoToken.allowance(
            signerAddress,
            Web3Service.STAKING_CONTRACT_ADDRESS
        );
        console.log(`Current allowance: ${allowance.toString()}`);
        console.log('Populating stake transaction...');
        const populatedTx = await Web3Service.stakingContract.populateTransaction.stake(
            amountToStake,
            duration,
            {gasLimit: 3000000} // Adjust gas limit as needed
        );
        console.log('Stake transaction populated', populatedTx);

        return populatedTx;
    }

    static async buildApprovalTransaction(amount, spenderAddress, signerAddress) {
        console.log(`Starting buildApprovalTransaction with amount: ${amount}, spenderAddress: ${spenderAddress}, signerAddress: ${signerAddress}`);
        // convert to String all parameters
        const amountString = amount.toString();
        console.log(`Amount as string: ${amountString}`);
        const amountToApprove = ethers.utils.parseUnits(amountString, 18);
        console.log(`Amount to approve in wei: ${amountToApprove.toString()}`);
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
        console.log(`Building record payment transaction with AVAX: ${avaxAmount} and USDT: ${usdtAmount}`);
        try {
            const avaxValue = ethers.utils.parseEther(avaxAmount.toString());
            const usdtValue = ethers.utils.parseUnits(usdtAmount.toString(), 6);

            const populatedTx = await Web3Service.defiBilling.populateTransaction.recordPayment(
                avaxValue,
                usdtValue,
                {value: avaxValue}
            );
            console.log('Record payment transaction built', populatedTx);
            return populatedTx;
        } catch (error) {
            console.error("Error building record payment transaction:", error);
            throw error;
        }
    }

    // Nueva función para obtener el historial de pagos
    static async getPaymentHistory(userAddress) {
        console.log(`Fetching payment history for user ${userAddress}...`);
        try {
            const history = await Web3Service.defiBilling.getPaymentHistory(userAddress);
            const formattedHistory = history.map(payment => ({
                timestamp: new Date(payment.timestamp.toNumber() * 1000),
                avaxAmount: ethers.utils.formatEther(payment.avaxAmount),
                usdtAmount: ethers.utils.formatUnits(payment.usdtAmount, 6)
            }));
            console.log(`Payment history for ${userAddress}:`, formattedHistory);
            return formattedHistory;
        } catch (error) {
            console.error(`Error fetching payment history for ${userAddress}:`, error);
            throw error;
        }
    }

    // Nueva función para retirar fondos
    static async buildWithdrawFundsTransaction(avaxAmount, usdtAmount, signerAddress) {
        console.log(`Building withdraw funds transaction with AVAX: ${avaxAmount} and USDT: ${usdtAmount}`);
        try {
            const avaxValue = ethers.utils.parseEther(avaxAmount.toString());
            const usdtValue = ethers.utils.parseUnits(usdtAmount.toString(), 6);

            const populatedTx = await Web3Service.defiBilling.populateTransaction.withdrawFunds(
                avaxValue,
                usdtValue
            );
            console.log('Withdraw funds transaction built', populatedTx);
            return populatedTx;
        } catch (error) {
            console.error("Error building withdraw funds transaction:", error);
            throw error;
        }
    }

    // Nueva función para retirar todos los fondos
    static async buildWithdrawAllFundsTransaction(signerAddress) {
        console.log("Building withdraw all funds transaction");
        try {
            const populatedTx = await Web3Service.defiBilling.populateTransaction.withdrawAllFunds();
            console.log('Withdraw all funds transaction built', populatedTx);
            return populatedTx;
        } catch (error) {
            console.error("Error building withdraw all funds transaction:", error);
            throw error;
        }
    }

    static async getActiveStakes(userAddress) {
        console.log(`Fetching active stakes for user ${userAddress}...`);
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
        console.log(`Fetching staking history for user ${userAddress}...`);
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
        console.log(`Fetching payment history for user ${userAddress}...`);
        try {
            const history = await Web3Service.defiBilling.getPaymentHistory(userAddress);
            const formattedHistory = history.map(payment => ({
                timestamp: payment.timestamp.toNumber(),
                avaxAmount: ethers.utils.formatEther(payment.avaxAmount),
                usdtAmount: ethers.utils.formatUnits(payment.usdtAmount, 6),
                txHash: payment.txHash
            }));
            console.log(`Payment history for ${userAddress}:`, formattedHistory);
            return formattedHistory;
        } catch (error) {
            console.error(`Error fetching payment history for ${userAddress}:`, error);
            throw error;
        }
    }

    static async synchronizePaymentHistory(userAddress) {
        try {
            const paymentHistoryFromContract = await Web3Service.getPaymentHistoryFromContract(userAddress);

            const dbPaymentHistory = await prisma.balanceTransaction.findMany({
                where: {
                    userBalance: {
                        user: {
                            wallet: userAddress,
                        },
                    },
                },
            });

            // console log each entry from DB
            for (const tx of dbPaymentHistory) {
                console.log(`DB Entry: ${tx.timestamp} - ${tx.amount} - ${tx.currency}`);
            }

            // console log each entry from contract
            for (const tx of paymentHistoryFromContract) {
                console.log(`Contract Entry: ${tx.timestamp} - ${tx.usdtAmount} - ${tx.avaxAmount}`);
            }

            const dbPaymentEntries = dbPaymentHistory.map(tx => ({
                amount: tx.amount.toFixed(6),
                currency: tx.currency,
                timestamp: tx.timestamp.toString() // Convertimos BigInt a string para la comparación
            }));

            const missingTransactions = paymentHistoryFromContract.filter(contractTx => {
                const amount = contractTx.avaxAmount !== '0.0' ? contractTx.avaxAmount : contractTx.usdtAmount;
                const currency = contractTx.avaxAmount !== '0.0' ? 'AVAX' : 'USDT';

                return !dbPaymentEntries.some(dbTx =>
                    dbTx.amount === amount &&
                    dbTx.currency === currency &&
                    dbTx.timestamp === contractTx.timestamp.toString()
                );
            });

            for (const tx of missingTransactions) {
                const user = await prisma.user.findFirst({
                    where: {wallet: userAddress},
                    include: {userBalance: true},
                });

                if (!user || !user.userBalance) {
                    console.error(`User or UserBalance not found for wallet: ${userAddress}`);
                    continue;
                }

                let amountInUsd;
                if (tx.avaxAmount !== '0.0') {
                    const avaxPrice = await Web3Service.getAvaxPrice();
                    amountInUsd = parseFloat(tx.avaxAmount) * avaxPrice;
                    console.log(`Converted ${tx.avaxAmount} AVAX to ${amountInUsd} USD at price ${avaxPrice}`);
                } else {
                    amountInUsd = parseFloat(tx.usdtAmount);
                    console.log(`Using ${tx.usdtAmount} USDT as is`);
                }

                const currentBalance = parseFloat(user.userBalance.balance);
                const newBalance = currentBalance + amountInUsd;

                console.log(`Current Balance: ${currentBalance}`);
                console.log(`Amount to add: ${amountInUsd}`);
                console.log(`New Balance: ${newBalance}`);

                await prisma.userBalance.update({
                    where: {idUser: user.id},
                    data: {balance: newBalance.toFixed(8)},
                });

                console.log(`Updated balance for user ${userAddress} to ${newBalance.toFixed(8)}`);

                await prisma.balanceTransaction.create({
                    data: {
                        idUserBalance: user.userBalance.id,
                        amount: amountInUsd.toFixed(8),
                        currency: tx.avaxAmount !== '0.0' ? 'AVAX' : 'USDT',
                        type: 'credit',
                        description: 'Synced from blockchain',
                        created: new Date(tx.timestamp * 1000),
                        timestamp: BigInt(tx.timestamp), // Guardamos el timestamp como BigInt
                        txHash: tx.txHash || null
                    },
                });

                console.log(`Recorded transaction: ${JSON.stringify({
                    idUserBalance: user.userBalance.id,
                    amount: amountInUsd.toFixed(8),
                    currency: tx.avaxAmount !== '0.0' ? 'AVAX' : 'USDT',
                    type: 'credit',
                    description: 'Synced from blockchain',
                    created: new Date(tx.timestamp * 1000),
                    timestamp: BigInt(tx.timestamp),
                    txHash: tx.txHash || null
                })}`);
            }

            console.log(`Payment history synchronized successfully for user: ${userAddress}`);
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
