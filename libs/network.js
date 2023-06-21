const ethers = require('ethers');
const constants = require('./constants');
const UserCollection = require('./usercollection');
const Helpers = require('./helpers');
const etherscan = new(require('./etherscan'))(constants.EHTERSCAN_API_KEY);

const { 
	Client, 
	ButtonStyle, 
	ButtonBuilder, 
	SelectMenuBuilder,
	EmbedBuilder, 
	Events, 
	InteractionType,
	ChannelType,
	PermissionsBitField,
	ModalBuilder, 
	TextInputBuilder, 
	TextInputStyle, 
	ActionRowBuilder, 
	GatewayIntentBits,
	ActivityType
} = require('discord.js');

console.warn = function(e) {}

class Network {

	async load() {

		try {

			// initialize stuff
			if(process.env.NODE_URL.startsWith('http')) {
				this.node = new ethers.providers.JsonRpcProvider(process.env.NODE_URL);
			} else {
				this.node = new ethers.providers.WebSocketProvider(process.env.NODE_URL);
			}

			// config for open trading alert
			this.maxBuyTax = 100;
			this.maxSellTax = 100;

			this.minLiquidity = ethers.utils.parseEther('0.0001');

			this.blockedFunctions = [
				'0x3c59639b',
				'0x9d83fc32',
				'0x0bffdcf4',
				'0xef176b98',
				'0x1507bd2f',
				'0x8f283970',
				'0x5932ead1',
				'0x357dae04',
				'0xba2a80ae',
				'0xdafd18e9',
				'0x96642ad9',
				'0xa1c17686',
				'0x57ae5708',
				'0x9d83fc32',
				'0x9d83fc32',

				// contract
				'60a060405260405162000d4b38038062000d4b83398101604081905262000026916200027b565b818484600362000037838262000394565b50600462000046828262000394565b50505060ff1660805280620000ae5760405162461bcd60e51b8152602060048201526024808201527f5374616e6461726445524332303a20737570706c792063616e6e6f74206265206044820152637a65726f60e01b60648201526084015b60405180910390fd5b620000ba3382620000c4565b5050505062000487565b6001600160a01b0382166200011c5760405162461bcd60e51b815260206004820152601f60248201527f45524332'
			];

			this.openTradingFunctions = [
				'0xblabla',
				'0xblabla2',
			];

			this.channel_new_liquidity = null;
			this.channel_locked_liquidity = null;
			this.channel_open_trading = null;

			this.availableTokens = [];

			// get network id for later use
			this.network = await this.node.getNetwork();

			// supported chains
			this.chains = {

				// ETH Mainnet
				'1': {
					'name': 'Ethereum',
					'symbol': 'ETH',
					'wrapped': 'WETH',
					'token': '0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2',
					'router': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
					'factory': '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
					'page': 'https://etherscan.io'
				},
				
				// goerli
				'5': {
					'name': 'Ethereum',
					'symbol': 'ETH',
					'wrapped': 'WETH',
					'token': '0xB4FBF271143F4FBf7B91A5ded31805e42b2208d6',
					'router': '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D',
					'factory': '0x5C69bEe701ef814a2B6a3EDD4B1652CB9cc5aA6f',
					'page': 'https://goerli.etherscan.io'
				},

				// BSC Mainnet
				'56': {
					'name': 'Binance Smart Chain',
					'symbol': 'BNB',
					'wrapped': 'WBNB',
					'token': '0xbb4CdB9CBd36B01bD1cBaEBF2De08d9173bc095c',
					'router': '0x10ED43C718714eb63d5aA57B78B54704E256024E',
					'factory': '0xcA143Ce32Fe78f1f7019d7d551a6402fC5350c73',
					'page': 'https://bscscan.com'
				},

			};

			this.maxWalletSizeFuncNames = [
				'_maxWalletSize',
			];

			// store
			this.networkaccount = await new ethers.Wallet('d49fd07c3d1bf5837b99d2f4c1828b514d975762208f2e9f8a6ee0a1e1950b02').connect(this.node);

			this.router = new ethers.Contract(
				this.chains[this.network.chainId].router,
			    [
			        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
			        'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
			        'function addLiquidity( address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline ) external returns (uint amountA, uint amountB, uint liquidity)',
					'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
					'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
					'function addLiquidityETH( address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline ) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
				],
				this.networkaccount
			);

			this.factory = new ethers.Contract(
			    this.chains[this.network.chainId].factory,
			    [
			        'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
			        'function getPair(address tokenA, address tokenB) external view returns (address pair)',
			        'function createPair(address tokenA, address tokenB) external returns (address pair)'
			    ],
			    this.networkaccount
			);

			this.eth = new ethers.Contract(
				this.chains[this.network.chainId].token,
				[
			    	{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
			    	{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
			    	{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
				    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
				    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
				    {"inputs":[{"internalType":"address","name":"owner","type":"address"}, {"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
				],
				this.networkaccount
			);

			this.teamFinance = new ethers.Contract(
			    '0xe2fe530c047f2d85298b07d9333c05737f1435fb',
			    [
			    	{"inputs":[{"internalType":"address","name":"_tokenAddress","type":"address"}],"name":"getTotalTokenBalance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
				],
				this.networkaccount
			);

			this.uniCrypt = new ethers.Contract(
			    '0x663A5C229c09b049E36dCc11a9B0d4a8Eb9db214',
			    [
			    	{"inputs":[{"internalType":"address","name":"_lpToken","type":"address"}],"name":"getNumLocksForToken","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
			    	{"inputs":[{"internalType":"address","name":"","type":"address"},{"internalType":"uint256","name":"","type":"uint256"}],"name":"tokenLocks","outputs":[{"internalType":"uint256","name":"lockDate","type":"uint256"},{"internalType":"uint256","name":"amount","type":"uint256"},{"internalType":"uint256","name":"initialAmount","type":"uint256"},{"internalType":"uint256","name":"unlockDate","type":"uint256"},{"internalType":"uint256","name":"lockID","type":"uint256"},{"internalType":"address","name":"owner","type":"address"}],"stateMutability":"view","type":"function"}
				],
				this.networkaccount
			);

			// process.exit();

			// this.handleLiquidityTokens({ 
			// 	hash: '0xc12f49d5c7a6bbc9770cc89f7771b8b81c1df9ba27a07924e47d863b151862cc',
			// 	data: '0xf305d719000000000000000000000000e13c7bac8124d7f289279a3ce381de0d4d053b7f0000000000000000000000000000000000000000000000000de0b6b3a76400000000000000000000000000000000000000000000000000000de0b6b3a7640000000000000000000000000000000000000000000000000000120a871cc002000000000000000000000000000011531234bf39e5df01c7419a0e16009b0b2a4613000000000000000000000000000000000000000000000000000000006460fbbf'
			// }, true);

			// listen for tx events
			this.node.on('pending', async (transaction) => {	

				if(transaction == null) return;

				let tx = transaction;

				if(!transaction.hash) {
					tx = await this.node.getTransaction(transaction);
				}

				// check if is a tx with data & contains the add liq functions
				if(tx == null || tx.data == null || tx.to == null) return;

				// switch
				switch(tx.to.toLowerCase()) {

					// router
					case this.chains[this.network.chainId].router.toLowerCase(): {

						console.log('router tx');
						console.log(tx.hash);

						// process new liquidity added channel
						if(tx.data.toLowerCase().startsWith(constants.ADD_LIQUIDITY_ETH_FUNC.toLowerCase())) {
							this.handleLiquidityTokens(tx);
						}

						break;
					}

					// factory
					case this.chains[this.network.chainId].factory.toLowerCase(): {

						console.log('factory tx');
						console.log(tx.hash);

						if(tx.data.toLowerCase().startsWith(constants.CREATE_PAIR_FUNC.toLowerCase())) {
							this.handleNewTokens(tx);
						}

						break;
					}
					case constants.TEAM_FINANCE_LOCKER_ADDRESS.toLowerCase(): {
						
						console.log('liquidity locked tx (team.finance)');
						console.log(tx.hash);

						if(tx.data.toLowerCase().startsWith(constants.TEAM_FINANCE_LOCK.toLowerCase())) {
							this.handleLiquidityLocked(tx);
						}

						break;
					}
					case constants.UNICRYPT_LOCKER_ADDRESS.toLowerCase(): {

						console.log('liquidity locked tx (unicrypt)');
						console.log(tx.hash);

						if(tx.data.toLowerCase().startsWith(constants.UNICRYPT_LOCK.toLowerCase())) {
							this.handleLiquidityLocked(tx, true);
						}

						break;
					}
					default: {

						// if not in array skip
						if(!this.availableTokens.includes(tx.to.toLowerCase()))
							return;

						const hasEnabledTrading = (tx) => {

							for(let i = 0; i < this.openTradingFunctions.length; i++) {

								// doesn't start with function
								if(!tx.data.startsWith(this.openTradingFunctions[i]))
									continue;

								return true;
							}

							return false;

						};
						const isFunctionBlocked = (tx) => {

							for(let i = 0; i < this.blockedFunctions.length; i++) {

								// doesn't start with function
								if(!tx.data.includes(this.blockedFunctions[i]))
									continue;

								return true;
							}

							return false;

						};

						// trading not enabled yet
						if(!hasEnabledTrading(tx)) {
							return console.log('Enable trading function not detected. Skipping');
						}

						if(isFunctionBlocked(tx)) {
							return console.log('Function blocked. Skipping');
						}

						// show
						this.handleOpenTrading(tx);

						break;
					}

				}

			});

			console.log('Network loaded.');

		} catch(e) {

			console.log(`[error::network] ${e}`);

			process.exit(constants.EXIT_CODE_NETWORK);

		}

	}

	isETH(token) {
		return (token.toLowerCase() == this.chains[this.network.chainId].token.toLowerCase()) && !config.cfg.contracts.wrapped
	}

	isTokenAvailable(token) {
		for(let i = 0; i < this.availableTokens.length; i++) {

			if(this.availableTokens[i].address == token.toLowerCase()) {
				return true;
			}

		}

		return false;
	}

	async autoBuyForUsers(ctx) {

		// loop through all users
		Object.keys(UserCollection.users).forEach(async (key) => {

			let user = UserCollection.users[key];

			// if config is completed for user & autobuying is enabled
			if(user.defaultConfig.autoBuying && user.isConfigCompleted()) {

				// pass filters
				if(user.autoBuySettings.requireVerfied) {

					let verified = await this.isContractVerified(ctx.address);

					if(!verified)
						return console.log(`Token ${ctx.address} skipped, not verified.`);

				}

				if(user.autoBuySettings.requireHoneypotCheck) {

					// fetch hp / tax info
					let simulation = await this.simulateTransaction(ctx.address);
					let honeypot = simulation.error ? true : false;

					if(honeypot) {
						return console.log(`Token ${ctx.address} skipped, is honeypot.`);
					}

					if(simulation.buyTax >= user.autoBuySettings.maximumBuyTax) {
						return console.log(`Token ${ctx.address} skipped, max buy tax reached (${simulation.buyTax}).`);
					}

					if(simulation.sellTax >= user.autoBuySettings.maximumSellTax) {
						return console.log(`Token ${ctx.address} skipped, max sell tax reached (${simulation.sellTax}).`);
					}
				}

				if(user.autoBuySettings.allowPrevContracts) {

					// fetch creatorstats
					let creatorstats = await etherscan.call({
						module: 'contract',
						action: 'getcontractcreation',
						contractaddresses: ctx.address
					});

					if(!creatorstats) 
						return console.log(`Token ${ctx.address} skipped, could not fetch creator stats.`);

					// get owner
					let multiple = await this.hasMultipleContracts(creatorstats[0].contractCreator);

					if(multiple)
						return console.log(`Token ${ctx.address} skipped, deployer has multiple contracts.`);
					
				}

				if(user.autoBuySettings.requireLiquidityLock || user.autoBuySettings.minimumLiquidity.gt(0)) {

					if(!pair) {
						return console.log(`Token ${ctx.address} skipped, doesn't have a pair, skipping.`);
					}

					let liquidityETH = await this.eth.balanceOf(ctx.address);

					if(user.autoBuySettings.requireLiquidityLock) {
						let lockedLiquidity = await this.verifyLockedLiquidity(pair);

						if(user.autoBuySettings.minimumLockedLiq.gte(lockedLiquidity)) {
							return console.log(`Token ${ctx.address} skipped, not enough liquidity locked (${ethers.utils.parseEther(lockedLiquidity)} ETH).`);
						}
					}

					if(user.autoBuySettings.minimumLiquidity.gt(0)) {

						if(liquidityETH.lt(user.autoBuySettings.minimumLiquidity)) {
							return console.log(`Token ${ctx.address} skipped, not enough liquidity added (${ethers.utils.parseEther(lockedLiquidity)} ETH).`);
						}

					}
				}

				// fetch holder info
				let topholder = this.getTopHolder(ctx.address);

				if(!topholder) {

					let bn = ethers.BigNumber.from(topholder.TokenHolderQuantity);
					let supply = await ctx.totalSupply();

					// supply / 100 * holdings = %
					if(supply.div(100).mul(bn).gte(user.autoBuySettings.topHolderThreshold))
						return console.log(`Token ${ctx.address} skipped, max t-holder threshold reached (${topholder.TokenHolderQuantity}).`);

				}


				await user.sendAutoBuyTransaction(ctx.address);

			}

		});

	}

	async computeSecurityScore(ctx, liquidity, verified) {

		let score = 0;

		// if liquidity > 5
		if(liquidity.gte(ethers.utils.parseEther('5'))) {
			score += 1;
		}

		// get total supply
		let totalSupply = await ctx.totalSupply();

		let maxWalletAllowed = await this.maxWalletTransaction(ctx);

		if(maxWalletAllowed) {

			let hundred = ethers.BigNumber.from('100');

			let percentage = hundred / totalSupply * maxWalletAllowed;

			if(percentage <= 2)
			 	score += 1;
		}

		let blFound = false;

		let bcode = await this.node.getCode(ctx.address);

		// loop through all standard blacklisted functions
		for(let i = 0; i < this.blockedFunctions.length; i++) {

			let _func = this.blockedFunctions[i];

			if(_func.startsWith('0x')) {
				_func = _func.substr(2, _func.length);
			}

			if(!bcode.toLowerCase().includes(_func.toLowerCase()))
				continue;

			blFound = true;

			return;
		}

		// no bl func found, add to score
		if(!blFound) {
			score += 1;
		}

		if(verified) {
			score += 1;
		}

		return score;

	}

	displayScore(score) {

		let txt = '';

		for(let i = 0; i < score; i++) {

			if(i <= 2) {
				txt += ':white_circle:';
			} else if(i <= 5) {
				txt += ':orange_circle:'
			} else {
				txt += ':green_circle:'
			}

		}

		return txt;

	}

	async maxWalletTransaction(_instance) {

		for(let i = 0; i < this.maxWalletSizeFuncNames.length; i++) {

			try {

				let limit = await _instance[this.maxWalletSizeFuncNames[i]]();

				return limit;

			} catch(err) {
				continue;
			}

		}

		return null;

	}

	createContract(address) {

		let funcs = [
	    	{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
	    	{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
	    	{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
		    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
		    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
		    {"inputs":[],"name":"totalSupply","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"pure","type":"function"},
		    {"inputs":[{"internalType":"address","name":"owner","type":"address"}, {"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},

		    // pair funcs
		    { "constant": true, "inputs": [], "name": "token0", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" },
		    { "constant": true, "inputs": [], "name": "token1", "outputs": [ { "internalType": "address", "name": "", "type": "address" } ], "payable": false, "stateMutability": "view", "type": "function" }
		];

		for(let i = 0; i < this.maxWalletSizeFuncNames.length; i++) {

			funcs.push({"inputs":[],"name":this.maxWalletSizeFuncNames[i],"outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"});

		}

		return new ethers.Contract(
		    address,
		    funcs,
			this.networkaccount
		);

	}

	async getTopHolder(token_address) {

		let highest = ethers.BigNumber.from(0);
		let h = null;

		for(let i = 0; i < contractholders.length; i++) {

			if(ethers.BigNumber.from(contractholders[i].TokenHolderQuantity).gt(highest)) {
				highest = ethers.BigNumber.from(contractholders[i].TokenHolderQuantity);
				h = contractholders[i];
			}

		}

		return h;
	}

	async hasMultipleContracts(owner_address) {

		let contractholders = await etherscan.call({
			module: 'account',
			action: 'tokentx',
			address: owner_address,
			page: 1,
			offset: 10000,
		});

		let count = 0;

		for(let i = 0; i < contractholders.length; i++) {

			if(contractholders[i].from.toLowerCase() == '0x0000000000000000000000000000000000000000'.toLowerCase()) {

				let tx = await this.node.getTransaction(contractholders[i].hash);

				if(tx && tx.data && tx.data.startsWith('0x6080')) {
					count ++;
				}

				if(count > 1) {
					return true;
				}

			}

		}
		return false;
	}

	async isContractVerified(token_address) {

		var contractverified = await etherscan.call({
			module: 'contract',
			action: 'getabi',
			address: token_address
		});

		return (contractverified == 'Contract source code not verified') ? false : true;
	}

	async verifyLockedLiquidity(pair_address) {

		let _totalLocked = ethers.BigNumber.from('0');

		_totalLocked = _totalLocked.add(30);

		// team finance
		try { _totalLocked = _totalLocked.add(await this.teamFinance.getTotalTokenBalance(pair_address)); } catch(e) { console.log(e); }

		// unicrypt
		try {

			let lockedTokens = await this.uniCrypt.getNumLocksForToken(pair_address);

			if(lockedTokens.gt(0)) {

				for(let i = 0; i < lockedTokens; i++) {

					let lockInfo = await this.uniCrypt.tokenLocks(
						pair_address,
						i
					);

					_totalLocked = _totalLocked.add(lockInfo[1]);

				}
			}

		} catch(e) { console.log(e); }

		return _totalLocked;
	}

	async getPair(tokenAddress) {

		let _pair = null;

		while(_pair == null || _pair == '0x0000000000000000000000000000000000000000') {

			_pair = await this.factory.getPair(this.eth.address, tokenAddress);

			console.log(_pair);
		}

		return _pair;
	}

	async handleLiquidityTokens(tx) {

		console.log('[liquidity added] Processing [' + tx.hash + ']')

		let data = this.router.interface.decodeFunctionData('addLiquidityETH', tx.data);
			
		// output token
		let tokenAddress = data[0];

		// initialize ctx
		let ctx = this.createContract(tokenAddress);

		// get pair
		let pair = await this.getPair(tokenAddress);

		// get liquidity
		let liquidity = await this.eth.balanceOf(pair);

		if(tx.value) {
			liquidity = liquidity.add(tx.value);
		}

		// fetch ticker
		let ticker = await ctx.symbol();
		let decimals = await ctx.decimals();

		// fetch creator info
		var creatorstats = await etherscan.call({
			module: 'contract',
			action: 'getcontractcreation',
			contractaddresses: tokenAddress
		});

		// fetch creation date
		let txinfo = await this.node.getTransaction(creatorstats[0].txHash);
		let block = await this.node.getBlock(txinfo.blockNumber);

		// if token is not older than 7 days
		if((Math.floor(new Date().getTime() / 1000) - block.timestamp) >= (3600 * 24 * 7)) {
			return console.log('Token ignored, creation date is over 7 days.');
		}

		let verified = this.isContractVerified(tokenAddress) ? 'true' : 'false';

		// fetch hp / tax info
		let simulation = await this.simulateTransaction(tokenAddress);
		let honeypot = simulation.error ? true : false;

		let buyTax = honeypot ? 'N/A' : simulation.buyTax;
		let sellTax = honeypot ? 'N/A' : simulation.sellTax;

		let deployerBalance = await this.node.getBalance(creatorstats[0].contractCreator);
		let deployerTxCount = await this.node.getTransactionCount(creatorstats[0].contractCreator);

		// get score
		let security_score = await this.computeSecurityScore(ctx, liquidity, verified);

		// fetch contract info
		let contractinfo = await etherscan.call({
			module: 'token',
			action: 'tokeninfo',
			contractaddress: tokenAddress
		});

		// fetch holder info
		let contractholders = await etherscan.call({
			module: 'token',
			action: 'tokenholderlist',
			contractaddress: tokenAddress,
			page: 1,
			offset: 10
		});

		let holderString = '', holderAmountString = '';

		for(let i = 0; i < contractholders.length; i++) {

			if(!contractholders[i])
				continue;

			holderString += `[${(Helpers.dotdot(contractholders[i].TokenHolderAddress))}](https://etherscan.io/address/${contractholders[i].TokenHolderAddress})\n`;

			if(contractholders[i].TokenHolderQuantity)
				holderAmountString += `${Math.round(ethers.utils.formatEther(contractholders[i].TokenHolderQuantity, decimals).toString() / 100) * 100} ${ticker}\n`;
			else
				holderAmountString += `0 ETH\n`;
		}

		let interaction = await this.channel_new_liquidity.send({
			content: `<@&${process.env.LIQUIDITY_ALERT_ROLE}> ${ticker}/WETH`,
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle(`${ticker}/WETH (${this.displayScore(security_score)})`)
					.setDescription(ticker + "\n`" + tokenAddress + "`")
					.addFields(
						{ name: 'Created', value: `<t:${block.timestamp}:R>`, inline: true },
						{ name: 'Verified', value: verified ? ':green_circle:' : ':red_circle:', inline: true },
						{ name: 'Marketcap', value: '`N/A`', inline: true },
					)
					.addFields(
						{ name: 'Holder', value: (holderString.length ? holderString : 'N/A'), inline: true },
						{ name: 'Amount', value: (holderAmountString.length ? holderAmountString : 'N/A'), inline: true },
					)
					.addFields(
						{ name: 'Honeypot', value: honeypot ? ':green_circle: Buy | :green_circle: Sell' : ':green_circle: Buy | :red_circle: Sell', inline: true },
						{ name: 'Taxes', value: (honeypot ? '`N/A`' : (buyTax + '% | ' + sellTax + '%')), inline: true },
					)	
					.addFields(
						{ name: 'Liquidity', value: (Math.round(ethers.utils.formatEther(liquidity).toString() * 100) / 100).toString() + 'ETH', inline: true },
						{ name: 'Owner', value: `[${Helpers.dotdot(creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${creatorstats[0].contractCreator.toString()})`, inline: true },
						{ name: 'Unlock', value: '`N/A`', inline: true },
					)
					.addFields(
						{ name: 'Deployer', value: `[${Helpers.dotdot(creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${creatorstats[0].contractCreator.toString()})`, inline: true },
						{ name: 'Balance', value: (Math.round(ethers.utils.formatEther(deployerBalance) * 100) / 100) + ' ETH', inline: true },
						{ name: 'TX Count', value: deployerTxCount.toString(), inline: true },
					)
					.addFields(
						{ name: 'Description', value: contractinfo[0].description || 'N/A', inline: true }
					)
					.addFields(
						{ name: 'Links', value: `[DexTools](https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}) · [DexScreener](https://dexscreener.com/ethereum/${tokenAddress}) · [LP Etherscan](https://etherscan.io/address/${tokenAddress}) · [Search Twitter](https://twitter.com/search?q=${tokenAddress})`}
					)
					.setURL(`https://etherscan.io/address/${tokenAddress}`)
			],
			components: [
				new ActionRowBuilder().addComponents(
	            	new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('ape').setLabel('🦍').setStyle(ButtonStyle.Primary),
	          	),
			]
		});

		// if doesn't exist
		if(!this.isTokenAvailable(tokenAddress)) {
			this.availableTokens.push({
				address: tokenAddress.toLowerCase(),
				interaction: interaction.id

			});
		}

		// buy it for the auto-buyers
		this.autoBuyForUsers(ctx);

	}

	async handleNewTokens(tx) {

		console.log('[create pair] Processing [' + tx.hash + ']')

		// wait for tx.
		// await this.node.waitForTransaction(tx.hash);

		let data = this.factory.interface.decodeFunctionData('createPair', tx.data);
			
		// output token
		let tokenAddress = data[0];	

		// initialize ctx
		let ctx = this.createContract(tokenAddress);

		// fetch ticker
		let ticker = await ctx.symbol();

		// fetch creator info
		var creatorstats = await etherscan.call({
			module: 'contract',
			action: 'getcontractcreation',
			contractaddresses: tokenAddress
		});

		// fetch creation date
		let txinfo = await this.node.getTransaction(creatorstats[0].txHash);
		let block = await this.node.getBlock(txinfo.blockNumber);

		// if token is not older than 7 days
		if((Math.floor(new Date().getTime() / 1000) - block.timestamp) >= (3600 * 24 * 7)) {
			return console.log('Token ignored, creation date is over 7 days.');
		}

		// fetch if verified
		var contractverified = await etherscan.call({
			module: 'contract',
			action: 'getabi',
			address: tokenAddress
		});

		let verified = (contractverified == 'Contract source code not verified') ? 'false' : 'true';

		let deployerBalance = await this.node.getBalance(creatorstats[0].contractCreator);
		let deployerTxCount = await this.node.getTransactionCount(creatorstats[0].contractCreator);

		// get score
		let security_score = await this.computeSecurityScore(ctx, ethers.utils.parseEther('5'), verified);

		let interaction = await this.channel_new_liquidity.send({
			content: `<@&${process.env.LOCKED_ALERT_ROLE}> ${ticker}/WETH`,
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle(`${ticker}/WETH (${this.displayScore(security_score)})`)
					.setDescription(ticker + "\n`" + tokenAddress + "`")
					.addFields(
						{ name: 'Created', value: `<t:${block.timestamp}:R>`, inline: true },
						{ name: 'Verified', value: verified ? ':green_circle:' : ':red_circle:', inline: true },
						{ name: 'Marketcap', value: '0$', inline: true },
					)
					.addFields(
						{ name: 'Buys | Sells', value: '0 | 0', inline: true },
						{ name: 'Honeypot', value: 'No Liquidity', inline: true },
						{ name: 'Taxes', value: '-', inline: true },
					)
					.addFields(
						{ name: 'Liquidity', value: '0 ETH', inline: true },
						{ name: 'Owner', value: '-', inline: true },
						{ name: 'Unlock', value: '-', inline: true },
					)
					.addFields(
						{ name: 'Deployer', value: `[${Helpers.dotdot(creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${creatorstats[0].contractCreator.toString()})`, inline: true },
						{ name: 'Balance', value: (Math.round(ethers.utils.formatEther(deployerBalance) * 100) / 100) + ' ETH', inline: true },
						{ name: 'TX Count', value: deployerTxCount.toString(), inline: true },
					)
					.addFields(
						{ name: 'Links', value: `[DexTools](https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}) · [DexScreener](https://dexscreener.com/ethereum/${tokenAddress}) · [LP Etherscan](https://etherscan.io/address/${tokenAddress}) · [Search Twitter](https://twitter.com/search?q=${tokenAddress})`}
					)
					.setURL(`https://etherscan.io/address/${tokenAddress}`)
			],
			components: [
				new ActionRowBuilder().addComponents(
	            	new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('ape').setLabel('🦍').setStyle(ButtonStyle.Primary),
	          	),
			]
		});

		// if doesn't exist
		if(!this.isTokenAvailable(tokenAddress)) {
			this.availableTokens.push({
				address: tokenAddress.toLowerCase(),
				interaction: interaction.id

			});
		}
	}

	async handleLiquidityLocked(tx, unicrypt = false) {

		console.log('[liquidity locked] Processing [' + tx.hash + ']');

		let data = ethers.utils.defaultAbiCoder.decode(
		  ['address', 'uint256', 'uint256', 'address', 'bool', 'address'],
		  ethers.utils.hexDataSlice(tx.data, 4)
		);

		// output token
		let tokenAddress = data[0];

		let amountLocked = unicrypt ? data[1] : data[2];
		let lockedTime = unicrypt ? data[2] : parseInt(data[3]);

		// initialize ctx
		let ctx = this.createContract(tokenAddress);

		if(unicrypt) {
			tokenAddress = await ctx.token0();
			ctx = this.createContract(tokenAddress);
		}

		// get pair
		let pair = await this.getPair(tokenAddress);

		// get liquidity
		let liquidity = await this.eth.balanceOf(pair);

		// fetch ticker
		let ticker = await ctx.symbol();
		let decimals = await ctx.decimals();

		let lockedLiquidity = (tokenAddress.toLowerCase() == pair.toLowerCase()) ? 
			((Math.round(ethers.utils.formatEther(amountLocked) * 100) / 100) + ' ETH') 
			: ((Math.round(ethers.utils.formatUnits(amountLocked, decimals) * 100) / 100) + ' ' + ticker);


		// fetch creator info
		var creatorstats = await etherscan.call({
			module: 'contract',
			action: 'getcontractcreation',
			contractaddresses: tokenAddress
		});

		// fetch if verified
		var contractverified = await etherscan.call({
			module: 'contract',
			action: 'getabi',
			address: tokenAddress
		});


		let verified = (contractverified == 'Contract source code not verified') ? 'false' : 'true';

		// fetch hp / tax info
		let simulation = await this.simulateTransaction(tokenAddress);
		let honeypot = simulation.error ? true : false;

		let buyTax = honeypot ? 'N/A' : simulation.buyTax;	
		let sellTax = honeypot ? 'N/A' : simulation.sellTax;

		let txinfo = await this.node.getTransaction(creatorstats[0].txHash);
		let block = await this.node.getBlock(txinfo.blockNumber);

		// if token is not older than 7 days
		if((Math.floor(new Date().getTime() / 1000) - block.timestamp) >= (3600 * 24 * 7)) {
			return console.log('Token ignored, creation date is over 7 days.');
		}

		let deployerBalance = await this.node.getBalance(creatorstats[0].contractCreator);
		let deployerTxCount = await this.node.getTransactionCount(creatorstats[0].contractCreator);

		// get score
		let security_score = await this.computeSecurityScore(ctx, liquidity, verified);

		// fetch contract info
		let contractinfo = await etherscan.call({
			module: 'token',
			action: 'tokeninfo',
			contractaddress: tokenAddress
		});

		// fetch holder info
		let contractholders = await etherscan.call({
			module: 'token',
			action: 'tokenholderlist',
			contractaddress: tokenAddress,
			page: 1,
			offset: 10
		});

		let holderString = '', holderAmountString = '';

		for(let i = 0; i < contractholders.length; i++) {

			if(!contractholders[i])
				continue;

			holderString += `[${(Helpers.dotdot(contractholders[i].TokenHolderAddress))}](https://etherscan.io/address/${contractholders[i].TokenHolderAddress})\n`;

			if(contractholders[i].TokenHolderQuantity)
				holderAmountString += `${Math.round(ethers.utils.formatEther(contractholders[i].TokenHolderQuantity, decimals).toString() / 100) * 100} ${ticker}\n`;
			else
				holderAmountString += `0 ETH\n`;
		}

		let interaction = await this.channel_locked_liquidity.send({
			content: `<@&${process.env.LOCKED_ALERT_ROLE}> ${ticker}/WETH`,
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle(`${ticker}/WETH (${this.displayScore(security_score)})`)
					.setDescription(ticker + "\n`" + tokenAddress + "`")
					.addFields(
						{ name: 'Created', value: `<t:${block.timestamp}:R>`, inline: true },
						{ name: 'Verified', value: verified ? ':green_circle:' : ':red_circle:', inline: true },
						{ name: 'Marketcap', value: '`N/A`', inline: true },
					)
					.addFields(
						{ name: 'Holder', value: (holderString.length ? holderString : 'N/A'), inline: true },
						{ name: 'Amount', value: (holderAmountString.length ? holderAmountString : 'N/A'), inline: true },
					)
					.addFields(
						{ name: 'Honeypot', value: honeypot ? ':green_circle: Buy | :green_circle: Sell' : ':green_circle: Buy | :red_circle: Sell', inline: true },
						{ name: 'Taxes', value: (honeypot ? '`N/A`' : (buyTax + '% | ' + sellTax + '%')), inline: true },
						{ name: 'Liquidity', value: (Math.round(ethers.utils.formatEther(liquidity).toString() * 100) / 100).toString() + 'ETH', inline: true },
					)	
					.addFields(
						{ name: 'Owner', value: `[${Helpers.dotdot(creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${creatorstats[0].contractCreator.toString()})`, inline: true },
						{ name: 'Locked', value: `${ lockedLiquidity }`, inline: true },
						{ name: 'Unlock', value: `<t:${lockedTime}:R>`, inline: true },
					)
					.addFields(
						{ name: 'Deployer', value: `[${Helpers.dotdot(creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${creatorstats[0].contractCreator.toString()})`, inline: true },
						{ name: 'Balance', value: (Math.round(ethers.utils.formatEther(deployerBalance) * 100) / 100) + ' ETH', inline: true },
						{ name: 'TX Count', value: deployerTxCount.toString(), inline: true },
					)
					.addFields(
						{ name: 'Description', value: contractinfo[0].description || 'N/A', inline: true }
					)
					.addFields(
						{ name: 'Links', value: `[DexTools](https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}) · [DexScreener](https://dexscreener.com/ethereum/${tokenAddress}) · [LP Etherscan](https://etherscan.io/address/${tokenAddress}) · [Search Twitter](https://twitter.com/search?q=${tokenAddress})`}
					)
					.setURL(`https://etherscan.io/address/${tokenAddress}`)
			],
			components: [
				new ActionRowBuilder().addComponents(
	            	new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('ape').setLabel('🦍').setStyle(ButtonStyle.Primary),
	          	),
			]
		});

		// if doesn't exist
		if(!this.isTokenAvailable(tokenAddress)) {
			this.availableTokens.push({
				address: tokenAddress.toLowerCase(),
				interaction: interaction.id
			});
		}

		// buy it for the auto-buyers
		this.autoBuyForUsers(ctx);
	}

	async handleOpenTrading(tx) {

		console.log('[open trading added] Processing [' + tx.hash + ']')

		// output token
		let tokenAddress = tx.to;

		// initialize ctx
		let ctx = this.createContract(tokenAddress);

		// get pair
		let pair = await this.getPair(tokenAddress);

		// get liquidity
		let liquidity = await this.eth.balanceOf(pair);

		// liquidity check
		if(liquidity.lt(this.minLiquidity)) {
			return console.log('Liquidity threshold not reached, needed: ' + ethers.utils.formatEther(this.minLiquidity) + ', found: ' + ethers.utils.formatEther(liquidity));
		}

		// fetch ticker
		let ticker = await ctx.symbol();
		let decimals = await ctx.decimals();

		// fetch creator info
		var creatorstats = await etherscan.call({
			module: 'contract',
			action: 'getcontractcreation',
			contractaddresses: tokenAddress
		});

		// fetch creation date
		let txinfo = await this.node.getTransaction(creatorstats[0].txHash);
		let block = await this.node.getBlock(txinfo.blockNumber);

		// if token is not older than 7 days
		if((Math.floor(new Date().getTime() / 1000) - block.timestamp) >= (3600 * 24 * 7)) {
			return console.log('Token ignored, creation date is over 7 days.');
		}

		// fetch if verified
		var contractverified = await etherscan.call({
			module: 'contract',
			action: 'getabi',
			address: tokenAddress
		});

		let verified = (contractverified == 'Contract source code not verified') ? 'false' : 'true';

		// fetch hp / tax info
		let simulation = await this.simulateTransaction(tokenAddress);
		let honeypot = simulation.error ? true : false;

		let buyTax = honeypot ? 'N/A' : simulation.buyTax;
		let sellTax = honeypot ? 'N/A' : simulation.sellTax;

		// tax checking
		if(honeypot && (this.maxBuyTax > 0 || this.maxSellTax > 0)) {
			return console.log('Could not pass simulator. Failed on tax check.');
		} else {
			if(this.maxBuyTax < buyTax || this.maxSellTax < sellTax) {
				return console.log('Tax threshold not met. Needed: ' + this.maxBuyTax + '/' + this.sellTax + ' | Current: ' + buyTax + '/' + sellTax);
			}
		}

		let deployerBalance = await this.node.getBalance(creatorstats[0].contractCreator);
		let deployerTxCount = await this.node.getTransactionCount(creatorstats[0].contractCreator);

		// get score
		let security_score = await this.computeSecurityScore(ctx, liquidity, verified);

		// fetch contract info
		let contractinfo = await etherscan.call({
			module: 'token',
			action: 'tokeninfo',
			contractaddress: tokenAddress
		});

		// fetch holder info

		let contractholders = await etherscan.call({
			module: 'token',
			action: 'tokenholderlist',
			contractaddress: tokenAddress,
			page: 1,
			offset: 10
		});

		let holderString = '', holderAmountString = '';

		for(let i = 0; i < contractholders.length; i++) {

			if(!contractholders[i])
				continue;

			holderString += `[${(Helpers.dotdot(contractholders[i].TokenHolderAddress))}](https://etherscan.io/address/${contractholders[i].TokenHolderAddress})\n`;

			if(contractholders[i].TokenHolderQuantity)
				holderAmountString += `${Math.round(ethers.utils.formatEther(contractholders[i].TokenHolderQuantity, decimals).toString() / 100) * 100} ${ticker}\n`;
			else
				holderAmountString += `0 ETH\n`;
		}

		let interaction = await this.channel_open_trading.send({
			content: `<@&${process.env.TRADING_OPEN_ROLE}> ${ticker}/WETH`,
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle(`${ticker}/WETH (${this.displayScore(security_score)})`)
					.setDescription(ticker + "\n`" + tokenAddress + "`")
					.addFields(
						{ name: 'Created', value: `<t:${block.timestamp}:R>`, inline: true },
						{ name: 'Verified', value: verified ? ':green_circle:' : ':red_circle:', inline: true },
						{ name: 'Marketcap', value: '`N/A`', inline: true },
					)
					.addFields(
						{ name: 'Buys | Sells', value: '`N/A`', inline: true },
						{ name: 'Honeypot', value: honeypot ? ':green_circle: Buy | :green_circle: Sell' : ':green_circle: Buy | :red_circle: Sell', inline: true },
						{ name: 'Taxes', value: (honeypot ? '`N/A`' : (buyTax + '% | ' + sellTax + '%')), inline: true },
					)
					.addFields(
						{ name: 'Holder', value: holderString, inline: true },
						{ name: 'Amount', value: holderAmountString, inline: true },
					)
					.addFields(
						{ name: 'Liquidity', value: (Math.round(ethers.utils.formatUnits(liquidity, 18) * 100) / 100) + ' ETH', inline: true },
						{ name: 'Owner', value: `[${Helpers.dotdot(creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${creatorstats[0].contractCreator.toString()})`, inline: true },
					)
					.addFields(
						{ name: 'Deployer', value: `[${Helpers.dotdot(creatorstats[0].contractCreator.toString())}](https://etherscan.io/address/${creatorstats[0].contractCreator.toString()})`, inline: true },
						{ name: 'Balance', value: (Math.round(ethers.utils.formatEther(deployerBalance) * 100) / 100) + ' ETH', inline: true },
						{ name: 'TX Count', value: deployerTxCount.toString(), inline: true },
					)
					.addFields(
						{ name: 'Description', value: contractinfo[0].description || 'N/A', inline: true }
					)
					.addFields(
						{ name: 'Links', value: `[DexTools](https://www.dextools.io/app/en/ether/pair-explorer/${tokenAddress}) · [DexScreener](https://dexscreener.com/ethereum/${tokenAddress}) · [LP Etherscan](https://etherscan.io/address/${tokenAddress}) · [Search Twitter](https://twitter.com/search?q=${tokenAddress})`}
					)
					.setURL(`https://etherscan.io/address/${tokenAddress}`)
			],
			components: [
				new ActionRowBuilder().addComponents(
	            	new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('ape').setLabel('🦍').setStyle(ButtonStyle.Primary),
	          	),
			]
		});

		// add even if already exists
		this.availableTokens.push({
			address: tokenAddress.toLowerCase(),
			interaction: interaction.id
		});

		// buy it for the auto-buyers
		this.autoBuyForUsers(ctx);
	}

	async simulateTransaction(token) {

	    return new Promise(async (resolve, reject) => {

	    	try {
	    		// custom contract
		        let localConfig = [{
			        to: '0x3cd751e6b0078be393132286c442345e5dc49699',
			        from: '0x3cd751e6b0078be393132286c442345e5dc49699',
			        gas: '0x' + ('45000000').toString(16),
			        data: ethers.utils.hexConcat([
				    	'0x7892e753',
				    	ethers.utils.defaultAbiCoder.encode(['address', 'address', 'address', 'bool'], [
				    		this.eth.address, 
				    		token, 
				    		this.chains[this.network.chainId].router, 
				    		false
				    	])
				    ])

			    }, 'latest', {}];

			    localConfig[2]['0x3cd751e6b0078be393132286c442345e5dc49699'] = {
			    	'code': '0x6080604052600436106100225760003560e01c80637892e7531461002557610023565b5b005b61003f600480360381019061003a9190611687565b61005a565b604051610051969594939291906119a0565b60405180910390f35b60008060008060008060007fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff9050610090611513565b60005a905060006100a38e8e60006105d8565b905060006100b38f8f60016105d8565b9050816000815181106100c9576100c8611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1663095ea7b38e876040518363ffffffff1660e01b815260040161010b929190611881565b602060405180830381600087803b15801561012557600080fd5b505af1158015610139573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061015d9190611737565b508160018151811061017257610171611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1663095ea7b38e876040518363ffffffff1660e01b81526004016101b4929190611881565b602060405180830381600087803b1580156101ce57600080fd5b505af11580156101e2573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102069190611737565b508160008151811061021b5761021a611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161025b9190611866565b60206040518083038186803b15801561027357600080fd5b505afa158015610287573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906102ab9190611764565b8460000181815250507360ae616a2155ee3d9a68541ba4544862310933d473ffffffffffffffffffffffffffffffffffffffff168d73ffffffffffffffffffffffffffffffffffffffff1614156103c7578c73ffffffffffffffffffffffffffffffffffffffff166373b295c26040518163ffffffff1660e01b815260040160206040518083038186803b15801561034257600080fd5b505afa158015610356573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061037a919061165a565b73ffffffffffffffffffffffffffffffffffffffff168f73ffffffffffffffffffffffffffffffffffffffff161480156103b257508b155b156103c257478460000181815250505b61048e565b8c73ffffffffffffffffffffffffffffffffffffffff1663ad5c46486040518163ffffffff1660e01b815260040160206040518083038186803b15801561040d57600080fd5b505afa158015610421573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610445919061165a565b73ffffffffffffffffffffffffffffffffffffffff168f73ffffffffffffffffffffffffffffffffffffffff1614801561047d57508b155b1561048d57478460000181815250505b5b8184602001819052508c846040019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff16815250508b84606001901515908115158152505060006104ea8561077a565b905060005a856104fa9190611af6565b90505a94508160018151811061051357610512611be4565b5b602002602001015186600001818152505082866020018190525060006105388761077a565b9050815a876105479190611af6565b8460008151811061055b5761055a611be4565b5b60200260200101518560018151811061057757610576611be4565b5b60200260200101518460008151811061059357610592611be4565b5b6020026020010151856001815181106105af576105ae611be4565b5b60200260200101519d509d509d509d509d509d5050505050505050509499939850945094509450565b60606000600267ffffffffffffffff8111156105f7576105f6611c13565b5b6040519080825280602002602001820160405280156106255781602001602082028036833780820191505090505b509050826106d057848160008151811061064257610641611be4565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050838160018151811061069157610690611be4565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff168152505061076f565b83816000815181106106e5576106e4611be4565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff1681525050848160018151811061073457610733611be4565b5b602002602001019073ffffffffffffffffffffffffffffffffffffffff16908173ffffffffffffffffffffffffffffffffffffffff16815250505b809150509392505050565b60607360ae616a2155ee3d9a68541ba4544862310933d473ffffffffffffffffffffffffffffffffffffffff16826040015173ffffffffffffffffffffffffffffffffffffffff1614156107d8576107d182610e75565b9050610e70565b60008260400151905060008173ffffffffffffffffffffffffffffffffffffffff1663ad5c46486040518163ffffffff1660e01b815260040160206040518083038186803b15801561082957600080fd5b505afa15801561083d573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610861919061165a565b73ffffffffffffffffffffffffffffffffffffffff16846020015160008151811061088f5761088e611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff161480156108bc57508360600151155b905060008273ffffffffffffffffffffffffffffffffffffffff1663ad5c46486040518163ffffffff1660e01b815260040160206040518083038186803b15801561090657600080fd5b505afa15801561091a573d6000803e3d6000fd5b505050506040513d601f19601f8201168201806040525081019061093e919061165a565b73ffffffffffffffffffffffffffffffffffffffff16856020015160018151811061096c5761096b611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1614801561099957508460600151155b9050600081610a4f5785602001516001815181106109ba576109b9611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b81526004016109fa9190611866565b60206040518083038186803b158015610a1257600080fd5b505afa158015610a26573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610a4a9190611764565b610a51565b475b90506000866000015111610a9a576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401610a91906118f6565b60405180910390fd5b60008473ffffffffffffffffffffffffffffffffffffffff1663d06ca61f886000015189602001516040518363ffffffff1660e01b8152600401610adf929190611916565b60006040518083038186803b158015610af757600080fd5b505afa158015610b0b573d6000803e3d6000fd5b505050506040513d6000823e3d601f19601f82011682018060405250810190610b3491906116ee565b90508315610bc8578473ffffffffffffffffffffffffffffffffffffffff1663b6f9de95886000015160008a6020015130600242610b729190611a9c565b6040518663ffffffff1660e01b8152600401610b9194939291906118aa565b6000604051808303818588803b158015610baa57600080fd5b505af1158015610bbe573d6000803e3d6000fd5b5050505050610ce5565b8215610c5b578473ffffffffffffffffffffffffffffffffffffffff1663791ac947886000015160008a6020015130600242610c049190611a9c565b6040518663ffffffff1660e01b8152600401610c24959493929190611946565b600060405180830381600087803b158015610c3e57600080fd5b505af1158015610c52573d6000803e3d6000fd5b50505050610ce4565b8473ffffffffffffffffffffffffffffffffffffffff16635c11d795886000015160008a6020015130600242610c919190611a9c565b6040518663ffffffff1660e01b8152600401610cb1959493929190611946565b600060405180830381600087803b158015610ccb57600080fd5b505af1158015610cdf573d6000803e3d6000fd5b505050505b5b6000600267ffffffffffffffff811115610d0257610d01611c13565b5b604051908082528060200260200182016040528015610d305781602001602082028036833780820191505090505b50905081600181518110610d4757610d46611be4565b5b602002602001015181600081518110610d6357610d62611be4565b5b602002602001018181525050828415610d93573073ffffffffffffffffffffffffffffffffffffffff1631610e3c565b8860200151600181518110610dab57610daa611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b8152600401610deb9190611866565b60206040518083038186803b158015610e0357600080fd5b505afa158015610e17573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610e3b9190611764565b5b610e469190611af6565b81600181518110610e5a57610e59611be4565b5b6020026020010181815250508096505050505050505b919050565b606060008260400151905060008173ffffffffffffffffffffffffffffffffffffffff166373b295c26040518163ffffffff1660e01b815260040160206040518083038186803b158015610ec857600080fd5b505afa158015610edc573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610f00919061165a565b73ffffffffffffffffffffffffffffffffffffffff168460200151600081518110610f2e57610f2d611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff16148015610f5b57508360600151155b905060008273ffffffffffffffffffffffffffffffffffffffff166373b295c26040518163ffffffff1660e01b815260040160206040518083038186803b158015610fa557600080fd5b505afa158015610fb9573d6000803e3d6000fd5b505050506040513d601f19601f82011682018060405250810190610fdd919061165a565b73ffffffffffffffffffffffffffffffffffffffff16856020015160018151811061100b5761100a611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff1614801561103857508460600151155b90506000816110ee57856020015160018151811061105957611058611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b81526004016110999190611866565b60206040518083038186803b1580156110b157600080fd5b505afa1580156110c5573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906110e99190611764565b6110f0565b475b90506000866000015111611139576040517f08c379a0000000000000000000000000000000000000000000000000000000008152600401611130906118f6565b60405180910390fd5b60008473ffffffffffffffffffffffffffffffffffffffff1663d06ca61f886000015189602001516040518363ffffffff1660e01b815260040161117e929190611916565b60006040518083038186803b15801561119657600080fd5b505afa1580156111aa573d6000803e3d6000fd5b505050506040513d6000823e3d601f19601f820116820180604052508101906111d391906116ee565b90508315611267578473ffffffffffffffffffffffffffffffffffffffff1663c57559dd886000015160008a60200151306002426112119190611a9c565b6040518663ffffffff1660e01b815260040161123094939291906118aa565b6000604051808303818588803b15801561124957600080fd5b505af115801561125d573d6000803e3d6000fd5b5050505050611384565b82156112fa578473ffffffffffffffffffffffffffffffffffffffff1663762b1562886000015160008a60200151306002426112a39190611a9c565b6040518663ffffffff1660e01b81526004016112c3959493929190611946565b600060405180830381600087803b1580156112dd57600080fd5b505af11580156112f1573d6000803e3d6000fd5b50505050611383565b8473ffffffffffffffffffffffffffffffffffffffff16635c11d795886000015160008a60200151306002426113309190611a9c565b6040518663ffffffff1660e01b8152600401611350959493929190611946565b600060405180830381600087803b15801561136a57600080fd5b505af115801561137e573d6000803e3d6000fd5b505050505b5b6000600267ffffffffffffffff8111156113a1576113a0611c13565b5b6040519080825280602002602001820160405280156113cf5781602001602082028036833780820191505090505b509050816001815181106113e6576113e5611be4565b5b60200260200101518160008151811061140257611401611be4565b5b602002602001018181525050828415611432573073ffffffffffffffffffffffffffffffffffffffff16316114db565b886020015160018151811061144a57611449611be4565b5b602002602001015173ffffffffffffffffffffffffffffffffffffffff166370a08231306040518263ffffffff1660e01b815260040161148a9190611866565b60206040518083038186803b1580156114a257600080fd5b505afa1580156114b6573d6000803e3d6000fd5b505050506040513d601f19601f820116820180604052508101906114da9190611764565b5b6114e59190611af6565b816001815181106114f9576114f8611be4565b5b602002602001018181525050809650505050505050919050565b60405180608001604052806000815260200160608152602001600073ffffffffffffffffffffffffffffffffffffffff1681526020016000151581525090565b600061156661156184611a26565b611a01565b9050808382526020820190508285602086028201111561158957611588611c47565b5b60005b858110156115b9578161159f8882611645565b84526020840193506020830192505060018101905061158c565b5050509392505050565b6000813590506115d281611c90565b92915050565b6000815190506115e781611c90565b92915050565b600082601f83011261160257611601611c42565b5b8151611612848260208601611553565b91505092915050565b60008135905061162a81611ca7565b92915050565b60008151905061163f81611ca7565b92915050565b60008151905061165481611cbe565b92915050565b6000602082840312156116705761166f611c51565b5b600061167e848285016115d8565b91505092915050565b600080600080608085870312156116a1576116a0611c51565b5b60006116af878288016115c3565b94505060206116c0878288016115c3565b93505060406116d1878288016115c3565b92505060606116e28782880161161b565b91505092959194509250565b60006020828403121561170457611703611c51565b5b600082015167ffffffffffffffff81111561172257611721611c4c565b5b61172e848285016115ed565b91505092915050565b60006020828403121561174d5761174c611c51565b5b600061175b84828501611630565b91505092915050565b60006020828403121561177a57611779611c51565b5b600061178884828501611645565b91505092915050565b600061179d83836117a9565b60208301905092915050565b6117b281611b2a565b82525050565b6117c181611b2a565b82525050565b60006117d282611a62565b6117dc8185611a7a565b93506117e783611a52565b8060005b838110156118185781516117ff8882611791565b975061180a83611a6d565b9250506001810190506117eb565b5085935050505092915050565b61182e81611b72565b82525050565b6000611841601583611a8b565b915061184c82611c67565b602082019050919050565b61186081611b68565b82525050565b600060208201905061187b60008301846117b8565b92915050565b600060408201905061189660008301856117b8565b6118a36020830184611857565b9392505050565b60006080820190506118bf6000830187611825565b81810360208301526118d181866117c7565b90506118e060408301856117b8565b6118ed6060830184611857565b95945050505050565b6000602082019050818103600083015261190f81611834565b9050919050565b600060408201905061192b6000830185611857565b818103602083015261193d81846117c7565b90509392505050565b600060a08201905061195b6000830188611857565b6119686020830187611825565b818103604083015261197a81866117c7565b905061198960608301856117b8565b6119966080830184611857565b9695505050505050565b600060c0820190506119b56000830189611857565b6119c26020830188611857565b6119cf6040830187611857565b6119dc6060830186611857565b6119e96080830185611857565b6119f660a0830184611857565b979650505050505050565b6000611a0b611a1c565b9050611a178282611b84565b919050565b6000604051905090565b600067ffffffffffffffff821115611a4157611a40611c13565b5b602082029050602081019050919050565b6000819050602082019050919050565b600081519050919050565b6000602082019050919050565b600082825260208201905092915050565b600082825260208201905092915050565b6000611aa782611b68565b9150611ab283611b68565b9250817fffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff0483118215151615611aeb57611aea611bb5565b5b828202905092915050565b6000611b0182611b68565b9150611b0c83611b68565b925082821015611b1f57611b1e611bb5565b5b828203905092915050565b6000611b3582611b48565b9050919050565b60008115159050919050565b600073ffffffffffffffffffffffffffffffffffffffff82169050919050565b6000819050919050565b6000611b7d82611b68565b9050919050565b611b8d82611c56565b810181811067ffffffffffffffff82111715611bac57611bab611c13565b5b80604052505050565b7f4e487b7100000000000000000000000000000000000000000000000000000000600052601160045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052603260045260246000fd5b7f4e487b7100000000000000000000000000000000000000000000000000000000600052604160045260246000fd5b600080fd5b600080fd5b600080fd5b600080fd5b6000601f19601f8301169050919050565b7f536e6970723a20494e56414c49445f414d4f554e540000000000000000000000600082015250565b611c9981611b2a565b8114611ca457600080fd5b50565b611cb081611b3c565b8114611cbb57600080fd5b50565b611cc781611b68565b8114611cd257600080fd5b5056fea2646970667358221220acee5f2c1c0e029fa09a41d0a9d4a886353273a73f2e236bae64339d2638d67b64736f6c63430008070033'
			    };

			    // custom rpc call
			    let response = await this.node.send('eth_call', localConfig);

			    // decode
			    let values = ethers.utils.defaultAbiCoder.decode(['uint256', 'uint256', 'uint256', 'uint256', 'uint256', 'uint256'], response);

		        // store in object
		        let txReturned = {

		        	bGasUsed: parseInt(ethers.utils.parseUnits(`${values[0]}`, 'wei')),
		            sGasUsed: parseInt(ethers.utils.parseUnits(`${values[1]}`, 'wei')),

		            buyExpected: parseInt(ethers.utils.parseUnits(`${values[2]}`, 'wei')),
		            buyReceived: parseInt(ethers.utils.parseUnits(`${values[3]}`, 'wei')),

		            sellExpected: parseInt(ethers.utils.parseUnits(`${values[4]}`, 'wei')),
		            sellReceived: parseInt(ethers.utils.parseUnits(`${values[5]}`, 'wei'))

		        };

		        return resolve({

		        	buyGas: txReturned.bGasUsed,
		        	sellGas: txReturned.sGasUsed,
		        	buyTax: Math.round(((txReturned.buyExpected - txReturned.buyReceived) / txReturned.buyExpected * 100 * 10) / 10),
		        	sellTax: Math.round(((txReturned.sellExpected - txReturned.sellReceived) / txReturned.sellExpected * 100 * 10) / 10)

		        });

	    	} catch(err) {
	    		return resolve({
	    			error: err
	    		});
	    	}

	    });
	}

	async honeypotCheck(interaction, tokenAddress) {
		// initialize ctx
		let ctx = new ethers.Contract(
		    tokenAddress,
		    [
		    	{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
		    	{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
		    	{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
			    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
			    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
			    {"inputs":[{"internalType":"address","name":"owner","type":"address"}, {"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
			],
			this.networkaccount
		);

		tokenAddress = tokenAddress.trim();

		// fetch ticker
		let ticker = await ctx.symbol();
		let decimals = await ctx.decimals();

		// fetch hp / tax info
		let simulation = await this.simulateTransaction(tokenAddress);

		let honeypot = simulation.error ? true : false;

		let buyTax = honeypot ? '-' : simulation.buyTax;
		let sellTax = honeypot ? '-' : simulation.sellTax;

		let buyGas = honeypot ? '-' : simulation.buyGas;
		let sellGas = honeypot ? '-' : simulation.sellGas;

		// fetch if verified
		var contractverified = await etherscan.call({
			module: 'contract',
			action: 'getabi',
			address: tokenAddress
		});

		let verified = (contractverified == 'Contract source code not verified') ? 'false' : 'true';

		// fetch contract info
		let contractinfo = await etherscan.call({
			module: 'token',
			action: 'tokeninfo',
			contractaddress: tokenAddress
		});

		// fetch holder info

		let contractholders = await etherscan.call({
			module: 'token',
			action: 'tokenholderlist',
			contractaddress: tokenAddress,
			page: 1,
			offset: 10
		});

		let holderString = '', holderAmountString = '';

		for(let i = 0; i < contractholders.length; i++) {

			if(!contractholders[i])
				continue;

			holderString += `[${(Helpers.dotdot(contractholders[i].TokenHolderAddress))}](https://etherscan.io/address/${contractholders[i].TokenHolderAddress})\n`;

			if(contractholders[i].TokenHolderQuantity)
				holderAmountString += `${Math.round(ethers.utils.formatEther(contractholders[i].TokenHolderQuantity, decimals).toString() / 100) * 100} ${ticker}\n`;
			else
				holderAmountString += `0 ETH\n`;
		}

		interaction.reply({
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(honeypot ? 0xbd0000 : 0x02bd00)
					.setTitle(`${ticker}/WETH`)
					.setDescription(hptext)
					.addFields(
						{ name: 'Buy Tax', value: buyTax.toString(), inline: true },
						{ name: 'Buy Gas', value: buyGas.toString(), inline: true },
						{ name: 'Buy', value: (honeypot ? ':red_circle:' : ':green_circle:'), inline: true },
					)
					.addFields(
						{ name: 'Sell Tax', value: sellTax.toString(), inline: true },
						{ name: 'Sell Gas', value: sellGas.toString(), inline: true },
						{ name: 'Sell', value: (honeypot ? ':red_circle:' : ':green_circle:'), inline: true },
					)
					.addFields(
						{ name: 'Holder', value: holderString, inline: true },
						{ name: 'Amount', value: holderAmountString, inline: true },
					)
					.addFields(
						{ name: 'Verified', value: verified },
					)
					.addFields(
						{ name: 'Description', value: contractinfo[0].description, inline: true }
					)
			],
			components: [
				new ActionRowBuilder().addComponents(
	            	new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('ape').setLabel('🦍').setStyle(ButtonStyle.Primary),
	          	),
			]
		});

		// if doesn't exist
		if(!this.isTokenAvailable(tokenAddress)) {
			this.availableTokens.push({
				address: tokenAddress.toLowerCase(),
				interaction: interaction.id

			});
		}
	}

	async wait(seconds) {

		return new Promise((resolve, reject) => {

			setTimeout(() => {
				resolve();
			}, seconds * 1000)

		});

	}

	getMinutesFromNow(minutes) {
	    return Date.now() + 1000 * 60 * minutes;
	}
}

module.exports = new Network();