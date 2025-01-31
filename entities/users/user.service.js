import {PrimateService, prisma} from '@thewebchimp/primate';
import createError from 'http-errors';
import {ethers} from "ethers";

class UserService {
	static findById(id) {
		if (!id) throw createError.BadRequest('Invalid user id');

		try {

			return prisma.user.findUnique({
				where: {
					id: parseInt(id),
				},
			});
		} catch (e) {
			throw e;
		}
	}

	static async getUserCryptoBalances(wallet) {
		if (!wallet) throw createError.BadRequest('Invalid wallet address');

		try {
			// Direcciones de los tokens (ajusta si cambias de red)
			const burritoTokenAddress = '0xf65645a42609f6b44e2ec158a3dc2b6cfc97093f';
			const usdtAddress = '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7';

			// ABI mínimo necesario para balanceOf y decimals
			const erc20Abi = [
				'function balanceOf(address owner) view returns (uint256)',
				'function decimals() view returns (uint8)',
			];

			// Crea el provider (ajusta la URL de tu RPC y la red que uses)
			const provider = new ethers.providers.JsonRpcProvider(process.env.PROVIDER_URL);

			// Balance nativo (e.g., AVAX, ETH, etc.)
			const nativeBalanceBN = await provider.getBalance(wallet);
			const nativeBalance = ethers.utils.formatEther(nativeBalanceBN);

			// Contrato y balance de Burrito Token
			const burritoContract = new ethers.Contract(burritoTokenAddress, erc20Abi, provider);
			const burritoBalanceBN = await burritoContract.balanceOf(wallet);
			const burritoDecimals = await burritoContract.decimals();
			const burritoBalance = ethers.utils.formatUnits(burritoBalanceBN, burritoDecimals);

			// Contrato y balance de USDT
			const usdtContract = new ethers.Contract(usdtAddress, erc20Abi, provider);
			const usdtBalanceBN = await usdtContract.balanceOf(wallet);
			const usdtDecimals = await usdtContract.decimals();
			const usdtBalance = ethers.utils.formatUnits(usdtBalanceBN, usdtDecimals);

			// Retorna el objeto con los balances formateados
			console.info(`Balances for wallet ${wallet}:`);
			console.info(`Native: ${nativeBalance}`);
			console.info(`Burrito: ${burritoBalance}`);
			console.info(`USDT: ${usdtBalance}`);
			return {
				native: nativeBalance,
				burrito: burritoBalance,
				usdt: usdtBalance,
			};

		} catch (e) {
			// Manejo de errores
			throw e;
		}
	}

	static async findByWallet(wallet) {
		if (!wallet) throw createError.BadRequest('Invalid wallet address');

		try {
			return prisma.user.findFirst({
				where: {wallet},
			});
		} catch (e) {
			throw e;
		}
	}

	static async create(data) {
		try {

			data.nicename = '';
			data.password = '';

			return await PrimateService.create(data, 'user');
		} catch (e) {
			throw e;
		}
	}

	static async createChat(idUser) {
		try {

			const data = {
				idUser,
				system: '',
			};

			return await PrimateService.create(data, 'chat');

		} catch (e) {
			throw e;
		}
	}
}

export default UserService;
