const ethers = require('ethers');

class Contract {

	constructor(token_in, token_out, router, factory) {
		this.token_in = token_in;
		this.token_out = token_out;

		this.router = router;
		this.factory = factory;
	}

	async getPair() {

		let pairAddress = await this.factory.getPair(this.token_in.address, this.token_out.address);

		if(!pairAddress || (pairAddress.toString().indexOf('0x0000000000000') > -1))
			return false;

	    return pairAddress;
	}

	async getLiquidity(pair, needed) {

		let liquidity = await this.token_in.balanceOf(pair);

		if(!liquidity || liquidity.lt(needed))
			return false;

		return liquidity;

	}

	async waitForPair() {

	    // get pair address
	    let pairAddress = await this.factory.getPair(this.token_in.address, this.token_out.address);

	    // no pair found, re-launch
	    while(!pairAddress || (pairAddress.toString().indexOf('0x0000000000000') > -1)) {
	    	pairAddress = await this.factory.getPair(this.token_in.address, this.token_out.address);
	    }

	    return pairAddress;
	}

	async waitForLiquidity(pair, needed) {

		let liquidity = await this.token_in.balanceOf(pair);

		while(!liquidity || liquidity.lt(needed)) {
			liquidity = await this.token_in.balanceOf(pair);
		}

		return liquidity;

	}

}

module.exports = Contract;