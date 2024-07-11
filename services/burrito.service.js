import ethers from 'ethers';
import DefiBilling from '../abis/DefiBilling.json' assert { type: "json" };
import StakingContract from '../abis/StakingContract.json' assert { type: "json" };

export class BurritoChainService {
  static defiBillingABI = DefiBilling.abi;
  static stakingContractABI = StakingContract.abi;

  static defiBillingAddress = process.env.DEFI_BILLING_ADDRESS;
  static stakingContractAddress = process.env.STAKING_CONTRACT_ADDRESS;

  static provider = new ethers.providers.JsonRpcProvider(process.env.RPC_URL);

  // DefiBilling Contract Methods

  static addBalance(avaxAmount, usdtAmount) {
    const iface = new ethers.utils.Interface(this.defiBillingABI);
    return iface.encodeFunctionData('addBalance', [avaxAmount, usdtAmount]);
  }

  static processPayments(users, avaxAmounts, usdtAmounts) {
    const iface = new ethers.utils.Interface(this.defiBillingABI);
    return iface.encodeFunctionData('processPayments', [users, avaxAmounts, usdtAmounts]);
  }

  static withdrawFunds(avaxAmount, usdtAmount) {
    const iface = new ethers.utils.Interface(this.defiBillingABI);
    return iface.encodeFunctionData('withdrawFunds', [avaxAmount, usdtAmount]);
  }

  static withdrawAllFunds() {
    const iface = new ethers.utils.Interface(this.defiBillingABI);
    return iface.encodeFunctionData('withdrawAllFunds');
  }

  static setStakingContract(stakingContractAddress) {
    const iface = new ethers.utils.Interface(this.defiBillingABI);
    return iface.encodeFunctionData('setStakingContract', [stakingContractAddress]);
  }

  static getPaymentHistory(user) {
    const iface = new ethers.utils.Interface(this.defiBillingABI);
    return iface.encodeFunctionData('getPaymentHistory', [user]);
  }

  // StakingContract Methods

  static stake(amount, duration) {
    const iface = new ethers.utils.Interface(this.stakingContractABI);
    return iface.encodeFunctionData('stake', [amount, duration]);
  }

  static unstake() {
    const iface = new ethers.utils.Interface(this.stakingContractABI);
    return iface.encodeFunctionData('unstake');
  }

  static calculateReward(user) {
    const iface = new ethers.utils.Interface(this.stakingContractABI);
    return iface.encodeFunctionData('calculateReward', [user]);
  }

  static setMonthlyAPR(apr) {
    const iface = new ethers.utils.Interface(this.stakingContractABI);
    return iface.encodeFunctionData('setMonthlyAPR', [apr]);
  }

  static setAnnualAPR(apr) {
    const iface = new ethers.utils.Interface(this.stakingContractABI);
    return iface.encodeFunctionData('setAnnualAPR', [apr]);
  }

  static killSwitch() {
    const iface = new ethers.utils.Interface(this.stakingContractABI);
    return iface.encodeFunctionData('killSwitch');
  }

  // Read Methods

  static async getStakeInfo(user) {
    const contract = new ethers.Contract(this.stakingContractAddress, this.stakingContractABI, this.provider);
    const stake = await contract.stakes(user);
    return {
      amount: ethers.utils.formatEther(stake.amount),
      timestamp: stake.timestamp.toNumber(),
      duration: stake.duration.toNumber()
    };
  }

  static async getBalance(user) {
    const contract = new ethers.Contract(this.defiBillingAddress, this.defiBillingABI, this.provider);
    const balance = await contract.balances(user);
    return {
      avaxBalance: ethers.utils.formatEther(balance.avaxBalance),
      usdtBalance: ethers.utils.formatUnits(balance.usdtBalance, 6) // Assuming USDT has 6 decimals
    };
  }

  static async getReward(user) {
    const contract = new ethers.Contract(this.stakingContractAddress, this.stakingContractABI, this.provider);
    const reward = await contract.calculateReward(user);
    return ethers.utils.formatEther(reward);
  }

  static async getTotalStaked() {
    const contract = new ethers.Contract(this.stakingContractAddress, this.stakingContractABI, this.provider);
    const totalStaked = await contract.totalStaked();
    return ethers.utils.formatEther(totalStaked);
  }

  static async getAPRs() {
    const contract = new ethers.Contract(this.stakingContractAddress, this.stakingContractABI, this.provider);
    const monthlyAPR = await contract.monthlyAPR();
    const annualAPR = await contract.annualAPR();
    return {
      monthlyAPR: ethers.utils.formatUnits(monthlyAPR, 18),
      annualAPR: ethers.utils.formatUnits(annualAPR, 18)
    };
  }

  static async getContractBalances() {
    const defiBillingContract = new ethers.Contract(this.defiBillingAddress, this.defiBillingABI, this.provider);
    const usdtTokenAddress = await defiBillingContract.usdtToken();
    const usdtContract = new ethers.Contract(usdtTokenAddress, ['function balanceOf(address) view returns (uint256)'], this.provider);

    const avaxBalance = await this.provider.getBalance(this.defiBillingAddress);
    const usdtBalance = await usdtContract.balanceOf(this.defiBillingAddress);

    return {
      avaxBalance: ethers.utils.formatEther(avaxBalance),
      usdtBalance: ethers.utils.formatUnits(usdtBalance, 6) // Assuming USDT has 6 decimals
    };
  }
}

export default BurritoChainService;