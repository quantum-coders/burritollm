import {ethers} from 'ethers';
import BurritoToken from '../abis/BurritoToken.json' assert {type: 'json'};
import StakingContractV2 from '../abis/StakingContractV2.json' assert {type: 'json'};

class Web3Service {
    static BURRITO_TOKEN_ADDRESS = process.env.BURRITO_TOKEN_ADDRESS;
    static STAKING_CONTRACT_ADDRESS = process.env.STAKING_CONTRACT_ADDRESS;
    static USDT_TOKEN_ADDRESS = process.env.USDT_TOKEN_ADDRESS;
    static DEFI_BILLING_ADDRESS = process.env.DEFI_BILLING_ADDRESS;

    static provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);

    static stakingContract = new ethers.Contract(
        Web3Service.STAKING_CONTRACT_ADDRESS,
        StakingContractV2.abi,
        Web3Service.provider
    );

    static burritoToken = new ethers.Contract(
        Web3Service.BURRITO_TOKEN_ADDRESS,
        BurritoToken.abi,
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
}

export default Web3Service;
