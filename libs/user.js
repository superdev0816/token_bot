const Network = require('./network.js');
const Helpers = require('./helpers.js');
const Contract = require('./contract.js');
const ethers = require('ethers');

const { 
	ButtonStyle, 
	ButtonBuilder, 
	EmbedBuilder, 
	ActionRowBuilder, 
	SelectMenuBuilder,
	hyperlink,
} = require('discord.js');

class User {

	constructor(name) {

		this.name = name;

		this.config = {};

		this.defaultConfig = {
			inputAmount: null,
			sellPercentage: '10',
			slippage: '10',
			autoBuying: false,
			gasLimit: '300000',
			maxPriorityFee: ethers.utils.parseUnits('1', 'gwei')
		};

		this.autoBuySettings = {

			requireVerfied: false,
			requireHoneypotCheck: false,
			requireLiquidityLock: false,
			allowPrevContracts: false,

			minimumLockedLiq: ethers.utils.parseEther('0.0'),

			topHolderThreshold: '100',

			minimumLiquidity: ethers.utils.parseEther('0.0'),

			maximumBuyTax: '0',
			maximumSellTax: '0'
		}

		// network related
		this.account = null;

		this.contract = {
			ctx: null,
			manager: null,
			symbol: null,
			decimals: null,
			degenMode: false
		};

		this.tokenList = [];

		this.autoBoughtTokens = [];

		// private
		this.savedToken = null;
	}

	addTokenToBoughtList(token) {

		for(let i = 0; i < this.autoBoughtTokens.length; i++) {

			if(this.autoBoughtTokens[i].address == token.address) {

				this.autoBoughtTokens[i] = token;
				return;

			}

		}

		this.autoBoughtTokens.push(token);
	}

	addTokenToList(token) {

		for(let i = 0; i < this.tokenList.length; i++) {

			if(this.tokenList[i].address == token.address) {

				this.tokenList[i] = token;
				return;

			}

		}

		this.tokenList.push(token);
	}

	async selectFromTokenList(interaction, idx) {

		let _token = this.tokenList[idx];

		this.savedToken = idx;

		// store contract as current
		await this.setContract(_token.address);

		// edit reply
		await interaction.update({ 
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle(`Viewing ${ _token.symbol }`)
					.setDescription(
					`
						Current Balance: **${ethers.utils.formatUnits(_token.balance.toString(), _token.decimals)} ${ _token.symbol }**

						**Contract Address**
						${_token.address}

					`
				)
			],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
					new ButtonBuilder().setCustomId('delete').setLabel('Delete').setStyle(ButtonStyle.Secondary),
				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('back_to_start').setLabel('Back').setStyle(ButtonStyle.Danger),
				)
			],
			ephemeral: true
		});

	}

	async addManualTokenToList(address) {

		try {

			let _ctx = new ethers.Contract(
				address,
			    [
			    	{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
			    	{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
			    	{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
				    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
				    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
				    {"inputs":[{"internalType":"address","name":"owner","type":"address"}, {"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
				],
			    this.account
			);		

			let _symbol = await _ctx.symbol();
			let _decimals = await _ctx.decimals();
			let _balance = await _ctx.balanceOf(this.account.address);

			this.addTokenToList({
				address: _ctx.address, 
				symbol: _symbol, 
				decimals: _decimals,
				balance: _balance,
				ctx: _ctx
			});

			return true;

		} catch(err) {

			return false;

		}

	}

	async updateTokenList() {

		for(let i = 0; i < this.tokenList.length; i++) {

			if(this.tokenList[i] == null)
				continue;

			let _bal = await this.tokenList[i].ctx.balanceOf(this.account.address);

			if(_bal.eq(0)) {
				this.tokenList.splice(i, 1);
			} else {
				this.tokenList[i].balance = _bal;
			}

		}
	}

	isValidPrivateKey(key) {
		try {
			new ethers.Wallet(key);
			return true;
		} catch(err) {
			return false;
		}
	}

	async setWallet(private_key) {

		//private_key

		// store
		this.account = await new ethers.Wallet(private_key).connect(Network.node);

		// set factory
		this.factory = new ethers.Contract(
		    Network.chains[Network.network.chainId].factory,
		    [
		        'event PairCreated(address indexed token0, address indexed token1, address pair, uint)',
		        'function getPair(address tokenA, address tokenB) external view returns (address pair)'
		    ],
		    this.account
		);

		// set router
		this.router = new ethers.Contract(
			Network.chains[Network.network.chainId].router,
		    [
		        'function getAmountsOut(uint amountIn, address[] memory path) public view returns (uint[] memory amounts)',
		        'function swapExactTokensForTokensSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external returns (uint[] memory amounts)',
		        'function addLiquidity( address tokenA, address tokenB, uint amountADesired, uint amountBDesired, uint amountAMin, uint amountBMin, address to, uint deadline ) external returns (uint amountA, uint amountB, uint liquidity)',
				'function swapExactETHForTokensSupportingFeeOnTransferTokens(uint amountOutMin, address[] calldata path, address to, uint deadline) external payable',
				'function swapExactTokensForETHSupportingFeeOnTransferTokens(uint amountIn, uint amountOutMin, address[] calldata path, address to, uint deadline) external',
				'function addLiquidityETH( address token, uint amountTokenDesired, uint amountTokenMin, uint amountETHMin, address to, uint deadline ) external payable returns (uint amountToken, uint amountETH, uint liquidity)'
			],
		    this.account
		);

		this.eth = new ethers.Contract(
			Network.chains[Network.network.chainId].token,
			[
		    	{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
		    	{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
		    	{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
			    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
			    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
			    {"inputs":[{"internalType":"address","name":"owner","type":"address"}, {"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
			],
			this.account
		);

	}

	async setContract(contract) {

		this.contract.ctx = await new ethers.Contract(
		    contract,
		    [
		    	{"inputs":[{"internalType":"address","name":"recipient","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"transfer","outputs":[{"internalType":"bool","name":"","type":"bool"}],"payable":false,"stateMutability":"nonpayable","type":"function"},
		    	{"inputs":[{"internalType":"address","name":"spender","type":"address"},{"internalType":"uint256","name":"amount","type":"uint256"}],"name":"approve","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"nonpayable","type":"function"},
		    	{"inputs":[{"internalType":"address","name":"account","type":"address"}],"name":"balanceOf","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
			    {"inputs":[],"name":"decimals","outputs":[{"internalType":"uint8","name":"","type":"uint8"}],"stateMutability":"view","type":"function"},
			    {"inputs":[],"name":"symbol","outputs":[{"internalType":"string","name":"","type":"string"}],"stateMutability":"view","type":"function"},
			    {"inputs":[{"internalType":"address","name":"owner","type":"address"}, {"internalType":"address","name":"spender","type":"address"}],"name":"allowance","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"}
			],
		    this.account
		);

		this.contract.symbol = await this.contract.ctx.symbol();
		this.contract.decimals = await this.contract.ctx.decimals();

		this.contract.manager = new Contract(
			this.eth,
			this.contract.ctx,
			this.router,
			this.factory
		);

	}

	async showStart(interaction, update = false) {

		let _balance = await this.account.getBalance();

		let comps = [
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('buy').setLabel('Buy').setStyle(ButtonStyle.Primary),
				new ButtonBuilder().setCustomId('sell').setLabel('Sell').setStyle(ButtonStyle.Primary),
			),
			new ActionRowBuilder().addComponents(
				new ButtonBuilder().setCustomId('add_token_to_list').setLabel('Add Token to List').setStyle(ButtonStyle.Secondary),
				new ButtonBuilder().setCustomId('clear_zero_balances').setLabel('Clear Zero Balances').setStyle(ButtonStyle.Secondary),
			)
		];

		if(this.tokenList.length) {

			comps.unshift(
				new ActionRowBuilder().addComponents(
					new SelectMenuBuilder()
					.setCustomId('select_token')
					.setPlaceholder('Select a token')
					.addOptions(
						this.tokenList.map((token, idx) => {
							return {
								label: token.symbol,
								description: ethers.utils.formatUnits(token.balance.toString(), token.decimals).toString(),
								value: idx.toString()
							}
						})
					),
				)
			);

		}

		let content = { 
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle('Main Menu')
					.setDescription(
					`
						Current wallet balance: **${ethers.utils.formatUnits(_balance, 18)} ETH**

					`
				)
			],
			components: comps,
			ephemeral: true
		};

		if(!update) {
			await interaction.reply(content);
		} else {
			await interaction.update(content);
		}
	}

	async showAutoStart(interaction, update = false) {

		let desc = '';

		if(!this.defaultConfig.autoBuying) {
			desc = `Auto buying is disabled.`;
		} else if(this.autoBoughtTokens.length) {

			for(let i = 0; i < this.autoBoughtTokens.length; i++) {
				desc += `__${(this.autoBoughtTokens[i].hash ? this.autoBoughtTokens[i].hash : 'pending hash')}__: ${this.autoBoughtTokens[i].status}\n`;
			}

		} else {
			desc = `Waiting for tokens..`;
		}

		let content = { 
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x000000)
					.setTitle('Auto Buying')
					.setDescription(desc)
			],
			components: [
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('start_auto').setLabel('Start').setStyle(ButtonStyle.Primary).setDisabled(this.defaultConfig.autoBuying),
					new ButtonBuilder().setCustomId('refresh_auto').setLabel('Refresh').setStyle(ButtonStyle.Primary).setDisabled(!this.defaultConfig.autoBuying)
				),
				new ActionRowBuilder().addComponents(
					new ButtonBuilder().setCustomId('stop_auto').setLabel('Stop').setStyle(ButtonStyle.Danger).setDisabled(!this.defaultConfig.autoBuying)
				)
			],
			ephemeral: true
		};

		if(!update) {
			await interaction.reply(content);
		} else {
			await interaction.update(content);
		}
	}

	async showSettings(interaction, update = false) {

		let content = { 
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle('Default Settings')
					.setDescription(
					`
						1. __Current Degen Wallet:__ **${ this.account == null ? 'Not Set' : `[${this.account.address.replace(this.account.address.substr(5, this.account.address.length - 10), '...')}](https://etherscan.io/address/${this.account.address})` }**

						2. __Default Buy Amount (ETH):__ **${this.defaultConfig.inputAmount == null ? 'Not Set' : ethers.utils.formatUnits(this.defaultConfig.inputAmount.toString(), 18)}**

						3. __Default Sell Amount (%):__ **${this.defaultConfig.sellPercentage == null ? 'Not Set' : this.defaultConfig.sellPercentage}%**

						4. __Default Slippage:__ **${this.defaultConfig.slippage == null ? 'Not Set' : this.defaultConfig.slippage}%**

						5. __Default Max Priority Fee:__ **${this.defaultConfig.maxPriorityFee == null ? 'Not Set' : ethers.utils.formatUnits(this.defaultConfig.maxPriorityFee, 'gwei') + ' gwei'}**
					`
				)
			],
			components: [
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('set_wallet').setLabel('1. Set Default Wallet')
					.setStyle(this.account == null ? ButtonStyle.Primary : ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('set_input').setLabel('2. Set Input Amount')
					.setStyle(this.defaultConfig.inputAmount == null ? ButtonStyle.Primary : ButtonStyle.Secondary).setDisabled((this.account == null)),

				), 
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('set_sell_percentage').setLabel('3. Set Default Sell Percentage')
					.setStyle((this.defaultConfig.sellPercentage == null) ? ButtonStyle.Primary : ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('set_slippage').setLabel('4. Set Default Slippage')
					.setStyle((this.defaultConfig.slippage == null) ? ButtonStyle.Primary : ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('set_priority_fee').setLabel('5. Set Default Priority Fee')
					.setStyle(this.defaultConfig.maxPriorityFee == null ? ButtonStyle.Primary : ButtonStyle.Secondary),

				)
			],
			ephemeral: true
		};

		if(update) {
			await interaction.update(content);
		} else {
			await interaction.reply(content);
		}
	}

	async showAutoBuyFilters(interaction, update = false) {

		let content = { 
			content: '',
			embeds: [
				new EmbedBuilder()
					.setColor(0x0099FF)
					.setTitle('Autobuy Settings')
					.setDescription(
					`

						**Toggles**

						Require Verified Contract: **${ this.autoBuySettings.requireVerified ? 'true' : 'false' }**
						Require Honeypot / Tax Check: **${ this.autoBuySettings.requireHoneypotCheck ? 'true' : 'false' }**
						Require Liquidity Lock: **${ this.autoBuySettings.requireLiquidityLock ? 'true' : 'false' }**
						Allow Previously Deployed Contracts: **${ this.autoBuySettings.allowPrevContracts ? 'true' : 'false' }**

						**Configuration**

						Minimum Liquidity: **${ ethers.utils.formatEther(this.autoBuySettings.minimumLiquidity) } ETH**
						Maximum Buy Tax: **${ this.autoBuySettings.maximumBuyTax }%**
						Maximum Sell Tax: **${ this.autoBuySettings.maximumSellTax }%**
						Top Holder Threshold %: **${ this.autoBuySettings.topHolderThreshold }%**

						Minimum Locked Liquidity (ETH): **${ ethers.utils.formatEther(this.autoBuySettings.minimumLockedLiq) } ETH**

					`
				)
			],
			components: [
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('uc_req_ver').setLabel('Toggle Verified')
					.setStyle(this.autoBuySettings.requireVerified ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_req_hp').setLabel('Toggle HP Check')
					.setStyle(this.autoBuySettings.requireHoneypotCheck ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_req_liq').setLabel('Toggle Liquidity Lock')
					.setStyle(this.autoBuySettings.requireLiquidityLock ? ButtonStyle.Secondary : ButtonStyle.Primary),

					new ButtonBuilder().setCustomId('uc_allow_prev_contracts').setLabel('Toggle Prev. Contracts')
					.setStyle(this.autoBuySettings.allowPrevContracts ? ButtonStyle.Secondary : ButtonStyle.Primary),

				), 
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('uc_set_min_liq').setLabel('Set Min. Liquidity')
					.setStyle(ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('uc_set_btax').setLabel('Set Max. Buy Tax')
					.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireHoneypotCheck),

					new ButtonBuilder().setCustomId('uc_set_stax').setLabel('Set Max. Sell Tax')
					.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireHoneypotCheck),

				), 
				new ActionRowBuilder().addComponents(

					new ButtonBuilder().setCustomId('uc_set_tholder_threshold').setLabel('Set Top Holder Threshold')
					.setStyle(ButtonStyle.Secondary),

					new ButtonBuilder().setCustomId('uc_set_lock_liquidity').setLabel('Set Locked Liquidity')
					.setStyle(ButtonStyle.Secondary).setDisabled(!this.autoBuySettings.requireLiquidityLock),
				)
			],
			ephemeral: true
		};

		if(update) {
			await interaction.update(content);
		} else {
			await interaction.reply(content);
		}
	}

	async sendNormalTransaction(interaction, selling = false) {

		try {

			var msgsent = await interaction.user.send({
				content: '',
				embeds: [
					new EmbedBuilder()
						.setColor(0x0099FF)
						.setTitle('Processing transaction..')
						.setDescription(
						`
							Processing..
						`
					)
				],
				components: []
			});

			// check if pair exists
			let pair = await this.contract.manager.getPair();

			if(!pair) {
				throw 'No pair found.';
			}

			let _balance = this.config.inputAmount || 0;

			if(selling) {
				_balance = await this.contract.ctx.balanceOf(this.account.address);
				_balance = _balance.div(100).mul(this.config.sellPercentage);
			}

			// check if liquidity is available
			let liquidity = await this.contract.manager.getLiquidity(pair, 0);

			if(!liquidity) {
				throw 'Not enough liquidity found.';
			}

			// do approve
			if(selling) {

				let _allowance = await this.contract.ctx.allowance(
					this.account.address,
					Network.chains[Network.network.chainId].router
				);

				// not enough allowance
				if(_allowance.lt(_balance)) {

					await msgsent.edit({
						content: '',
						embeds: [
							new EmbedBuilder()
								.setColor(0x0099FF)
								.setTitle('Processing transaction..')
								.setDescription(
								`
									Approving..
								`
							)
						],
						components: [],
					});

					let _nonce = await Network.node.getTransactionCount(this.account.address);
					let maxFeePergas = await this.computeOptimalGas();

					let tx = await this.contract.ctx.approve(
						Network.chains[Network.network.chainId].router, 
						(ethers.BigNumber.from("2").pow(ethers.BigNumber.from("256").sub(ethers.BigNumber.from("1")))).toString(),
						{
			                'maxPriorityFeePerGas': this.config.maxPriorityFee,
			            	'maxFeePerGas': maxFeePergas,
			            	'gasLimit': parseInt(this.config.gasLimit == null ? '1000000' : this.config.gasLimit),
			                'nonce': _nonce
			            }
				    );

					// wait for tx
				    let response = await tx.wait();

				    if(response.confirmations < 1) {
				    	throw 'Could not approve transaction.';
				    }

				}

			}

			// submit real tx
			let { transaction, gasmaxfeepergas, gaslimit, amountmin} = await (selling ? this.submitSellTransaction() : this.submitBuyTransaction());

			// show tx to user
			await msgsent.edit({
				embeds: [
					new EmbedBuilder()
						.setColor(0xffb800)
						.setTitle('Waiting..')
						.setDescription(
						`
							**Contract**
							[${this.contract.ctx.address}](https://etherscan.io/address/${this.contract.ctx.address}) (${this.contract.symbol})

							**Transaction**
							[click here](https://etherscan.io/tx/${transaction.hash})
						`
					)
				]
			});

			// wait for response
			let response = await Network.node.waitForTransaction(transaction.hash);

			if(response.status != 1) {
				throw `Transaction failed with status: ${response.status}.`;
			}

			if(response.confirmations == 0) {
				throw `The transaction could not be confirmed in time.`;
			}

			// finish it off!
			await msgsent.edit({
				embeds: [
					new EmbedBuilder()
						.setColor(0x009f0b)
						.setTitle('Finished!')
						.setDescription(
						`
							**Contract**
							[${this.contract.ctx.address}](https://etherscan.io/address/${this.contract.ctx.address}) (${this.contract.symbol})

							**Summary**
							Minimum ${selling ? `ETH` : this.contract.symbol} received: ${ethers.utils.formatUnits(amountmin.toString(), selling ? 18 : this.contract.decimals).toString()}
							
							Max Gas: ${ethers.utils.formatUnits(gasmaxfeepergas.toString(), 'gwei').toString()} gwei
							Gas Limit: ${gaslimit.toString()}
						`
					)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setLabel('View Transaction').setStyle(ButtonStyle.Link).setURL(`https://etherscan.io/tx/${response.transactionHash}`),
						new ButtonBuilder().setCustomId('back_to_start').setLabel('Back').setStyle(ButtonStyle.Danger),
					)
				]
			});

			_balance = await this.contract.ctx.balanceOf(this.account.address);

			// store in list
			this.addTokenToList({
				address: this.contract.ctx.address, 
				symbol: this.contract.symbol, 
				decimals: this.contract.decimals,
				balance: _balance,
				ctx: this.contract.ctx
			});

		} catch(err) {

			// ${err.reason ? err.reason : err}

			await msgsent.edit({
				embeds: [
					new EmbedBuilder()
						.setColor(0x9f0000)
						.setTitle('Failed')
						.setDescription(
						`
							**Reason**
							${err}

							**Contract**
							[${this.contract.ctx.address}](https://etherscan.io/address/${this.contract.ctx.address}) (${this.contract.symbol})
						`
					)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setCustomId('back_to_start').setLabel('Back').setStyle(ButtonStyle.Danger),
					)
				]
			});

		}

	}

	async sendAutoBuyTransaction(token_address) {

		try {

			let _balance = this.config.inputAmount || 0;

			// TO:DO check if user has enough balance.
			let bal = await this.getBalance();

			if(bal.lt(_balance)) {
				throw 'Not enough balance.';
			}

			this.addTokenToBoughtList({
				address: token_address,
				status: 'Looking for pair..'
			});

			// store contract
			await this.setContract(token_address);

			// overwrite with defaultConfig
			this.config = this.defaultConfig;

			// check if pair exists
			let pair = await this.contract.manager.getPair();

			if(!pair) {
				throw 'No pair found.';
			}

			// check if liquidity is available
			let liquidity = await this.contract.manager.getLiquidity(pair, 0);

			if(!liquidity) {
				throw 'Not enough liquidity found.';
			}

			this.addTokenToBoughtList({
				address: token_address,
				status: 'Looking for liquidity..'
			});

			// submit real tx
			let { transaction, gasmaxfeepergas, gaslimit, amountmin} = await this.submitBuyTransaction();
			
			this.addTokenToBoughtList({
				address: token_address,
				status: 'Waiting for transaction to confirm..',
				hash: transaction.hash
			});

			// wait for response
			let response = await Network.node.waitForTransaction(transaction.hash);

			if(response.status != 1) {
				throw `Transaction failed with status: ${response.status}.`;
			}

			if(response.confirmations == 0) {
				throw `The transaction could not be confirmed in time.`;
			}

			_balance = await this.contract.ctx.balanceOf(this.account.address);

			this.addTokenToBoughtList({
				address: token_address,
				status: 'TX completed!',
				hash: transaction.hash
			});

			// store in list
			this.addTokenToList({
				address: this.contract.ctx.address, 
				symbol: this.contract.symbol, 
				decimals: this.contract.decimals,
				balance: _balance,
				ctx: this.contract.ctx
			});

		} catch(err) {

			this.addTokenToBoughtList({
				address: token_address,
				status: err.error ? err.error : 'Could not process TX.'
			});

		}

	}

	async sendNormalTransactionApe(interaction, selling = false) {

		try {

			var msgsent = await interaction.user.send({
				content: '',
				embeds: [
					new EmbedBuilder()
						.setColor(0x0099FF)
						.setTitle('Processing transaction..')
						.setDescription(
						`
							Processing..
						`
					)
				],
				components: []
			});

			// check if pair exists
			let pair = await this.contract.manager.getPair();

			if(!pair) {
				throw 'No pair found.';
			}

			let _balance = this.config.inputAmount || 0;

			if(selling) {
				_balance = await this.contract.ctx.balanceOf(this.account.address);
				_balance = _balance.div(100).mul(this.config.sellPercentage);
			}

			// check if liquidity is available
			let liquidity = await this.contract.manager.getLiquidity(pair, 0);

			if(!liquidity) {
				throw 'Not enough liquidity found.';
			}

			// do approve
			if(selling) {

				let _allowance = await this.contract.ctx.allowance(
					this.account.address,
					Network.chains[Network.network.chainId].router
				);

				// not enough allowance
				if(_allowance.lt(_balance)) {

					await msgsent.edit({
						content: '',
						embeds: [
							new EmbedBuilder()
								.setColor(0x0099FF)
								.setTitle('Processing transaction..')
								.setDescription(
								`
									Approving..
								`
							)
						],
						components: []
					});

					let _nonce = await Network.node.getTransactionCount(this.account.address);
					let maxFeePergas = await this.computeOptimalGas();

					let tx = await this.contract.ctx.approve(
						Network.chains[Network.network.chainId].router, 
						(ethers.BigNumber.from("2").pow(ethers.BigNumber.from("256").sub(ethers.BigNumber.from("1")))).toString(),
						{
			                'maxPriorityFeePerGas': this.config.maxPriorityFee,
			            	'maxFeePerGas': maxFeePergas,
			            	'gasLimit': parseInt(this.config.gasLimit == null ? '1000000' : this.config.gasLimit),
			                'nonce': _nonce
			            }
				    );

					// wait for tx
				    let response = await tx.wait();

				    if(response.confirmations < 1) {
				    	throw 'Could not approve transaction.';
				    }

				}

			}

			// submit real tx
			let { transaction, gasmaxfeepergas, gaslimit, amountmin} = await (selling ? this.submitSellTransaction() : this.submitBuyTransaction());

			// show tx to user
			await msgsent.edit({
				embeds: [
					new EmbedBuilder()
						.setColor(0xffb800)
						.setTitle('Waiting..')
						.setDescription(
						`
							**Contract**
							[${this.contract.ctx.address}](https://etherscan.io/address/${this.contract.ctx.address}) (${this.contract.symbol})

							**Transaction**
							[click here](https://etherscan.io/tx/${transaction.hash})
						`
					)
				]
			});

			// wait for response
			let response = await Network.node.waitForTransaction(transaction.hash);

			if(response.status != 1) {
				throw `Transaction failed with status: ${response.status}.`;
			}

			if(response.confirmations == 0) {
				throw `The transaction could not be confirmed in time.`;
			}

			// finish it off!
			await msgsent.edit({
				embeds: [
					new EmbedBuilder()
						.setColor(0x009f0b)
						.setTitle('Finished!')
						.setDescription(
						`
							**Contract**
							[${this.contract.ctx.address}](https://etherscan.io/address/${this.contract.ctx.address}) (${this.contract.symbol})

							**Summary**
							Minimum ${selling ? `ETH` : this.contract.symbol} received: ${ethers.utils.formatUnits(amountmin.toString(), selling ? 18 : this.contract.decimals).toString()}
							
							Max Gas: ${ethers.utils.formatUnits(gasmaxfeepergas.toString(), 'gwei').toString()} gwei
							Gas Limit: ${gaslimit.toString()}
						`
					)
				],
				components: [
					new ActionRowBuilder().addComponents(
						new ButtonBuilder().setLabel('View Transaction').setStyle(ButtonStyle.Link).setURL(`https://etherscan.io/tx/${response.transactionHash}`),
					)
				]
			});

			_balance = await this.contract.ctx.balanceOf(this.account.address);

			// store in list
			this.addTokenToList({
				address: this.contract.ctx.address, 
				symbol: this.contract.symbol, 
				decimals: this.contract.decimals,
				balance: _balance,
				ctx: this.contract.ctx
			});

		} catch(err) {

			await msgsent.edit({
				embeds: [
					new EmbedBuilder()
						.setColor(0x9f0000)
						.setTitle('Failed')
						.setDescription(
						`
							**Reason**
							${err}

							**Contract**
							[${this.contract.ctx.address}](https://etherscan.io/address/${this.contract.ctx.address}) (${this.contract.symbol})
						`
					)
				],
				components: [],
			});

		}

	}

	async submitBuyTransaction() {

		// get amounts out
		let amountsOut = await this.router.getAmountsOut(
			this.config.inputAmount,
			[ this.eth.address, this.contract.ctx.address ]
		);

		let amountOutMin = amountsOut[1].sub(amountsOut[1].div(100).mul(this.config.slippage));

		let maxFeePergas = await this.computeOptimalGas();

		// estimation 
		let result = await this.router.estimateGas.swapExactETHForTokensSupportingFeeOnTransferTokens(
            amountOutMin,
            [ this.eth.address, this.contract.ctx.address ],
            this.account.address,
            Network.getMinutesFromNow(5),
            {
            	'value': this.config.inputAmount,
            	'maxPriorityFeePerGas': this.config.maxPriorityFee,
            	'maxFeePerGas': maxFeePergas,
            	'gasLimit': parseInt(this.config.gasLimit == null ? '1000000' : this.config.gasLimit)
            }
        );

        // get current user nonce
        let _nonce = await Network.node.getTransactionCount(this.account.address);

        let _gasLimit = parseInt(this.config.gasLimit == null ? ethers.utils.formatUnits(result, 'wei') : this.config.gasLimit);
        let tx = await this.account.sendTransaction({
			from: this.account.address,
			to: this.router.address,

			data: this.router.interface.encodeFunctionData(
				'swapExactETHForTokensSupportingFeeOnTransferTokens', 
				[
					amountOutMin, 
					[ 
						this.eth.address, 
						this.contract.ctx.address 
					], 
					this.account.address, 
					Network.getMinutesFromNow(5)
				]
			),

			value: this.config.inputAmount,

			maxPriorityFeePerGas: this.config.maxPriorityFee,
			maxFeePerGas: maxFeePergas,
			gasLimit: _gasLimit,

			nonce: _nonce
		});

		return {
			transaction: tx,
			gasmaxfeepergas: maxFeePergas,
			gaslimit: _gasLimit,
			amountmin: amountOutMin
		}

	}

	async submitSellTransaction() {

		let amountIn = await this.contract.ctx.balanceOf(this.account.address);

		amountIn = amountIn.div(100).mul(this.config.sellPercentage);

		// get amounts out
		let amountsOut = await this.router.getAmountsOut(
			amountIn,
			[ this.contract.ctx.address, this.eth.address ]
		);

		let amountOutMin = amountsOut[1].sub(amountsOut[1].div(100).mul(this.config.slippage));

		let maxFeePergas = await this.computeOptimalGas();

		// estimation 
		let result = await this.router.estimateGas.swapExactTokensForETHSupportingFeeOnTransferTokens(
			amountIn,
            amountOutMin,
            [ this.contract.ctx.address, this.eth.address ],
            this.account.address,
            Network.getMinutesFromNow(5),
            {
            	'maxPriorityFeePerGas': this.config.maxPriorityFee,
            	'maxFeePerGas': maxFeePergas,
            	'gasLimit': parseInt(this.config.gasLimit == null ? '1000000' : this.config.gasLimit)
            }
        );

        // get current user nonce
        let _nonce = await Network.node.getTransactionCount(this.account.address);

        let _gasLimit = parseInt(this.config.gasLimit == null ? ethers.utils.formatUnits(result, 'wei') : this.config.gasLimit);

        let tx = await this.account.sendTransaction({
			from: this.account.address,
			to: this.router.address,

			data: this.router.interface.encodeFunctionData(
				'swapExactTokensForETHSupportingFeeOnTransferTokens', 
				[
					amountIn,
					amountOutMin, 
					[ this.contract.ctx.address, this.eth.address ], 
					this.account.address, 
					Network.getMinutesFromNow(5)
				]
			),

			maxPriorityFeePerGas: this.config.maxPriorityFee,
			maxFeePerGas: maxFeePergas,
			gasLimit: _gasLimit,

			nonce: _nonce
		});

		return {
			transaction: tx,
			gasmaxfeepergas: maxFeePergas,
			gaslimit: _gasLimit,
			amountmin: amountOutMin
		}

	}

	async getBalance() {

		return this.account.getBalance();

	}

	async computeOptimalGas() {

		let gas = await Network.node.getFeeData();

		let baseFeePerGas = gas.lastBaseFeePerGas;
		let maxFeePergas = (baseFeePerGas.mul(2).add(this.config.maxPriorityFee));

		return maxFeePergas;
	}

	isConfigCompleted() {
		
		if(this.defaultConfig.slippage.length > 1 && this.defaultConfig.maxPriorityFee && this.defaultConfig.inputAmount)
			return true;

		return false;

	}

	getConfig() {
		return this.config;
	}

}

module.exports = User;