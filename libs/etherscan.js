const axios = require('axios');

class Etherscan {

	constructor(key) {

		this.endpoint = 'https://api.etherscan.io/api'; 
		this.key = key;

	}

	async call(params) {

		try {

			params.apikey = this.key;

			let response = await axios({
				method: 'get',
				url: this.endpoint + '?' + new URLSearchParams(params).toString()
			});

			if(response.data)
				return response.data.result;

			return null;

		} catch(err) {
			return err;
		}

	}

}

module.exports = Etherscan;