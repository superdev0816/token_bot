const { 
	Client, 
	ButtonStyle, 
	ButtonBuilder, 
	EmbedBuilder, 
	Events, 
	InteractionType,
	ModalBuilder, 
	TextInputBuilder, 
	TextInputStyle, 
	ActionRowBuilder, 
	GatewayIntentBits 
} = require('discord.js');

class Helpers {

	isInt(value) {
	  	return !isNaN(value) && 
	         parseInt(Number(value)) == value && 
	         !isNaN(parseInt(value, 10));
	}

	isFloat(value) {

		if(this.isInt(value))
			return true;

	  	return !isNaN(value) && 
	         parseFloat(value) == value && 
	         !isNaN(parseFloat(value, 10));
	}

	padTo2Digits(num) {
	  return num.toString().padStart(2, '0');
	}

	formatDate(date) {
	  return (
	    [
	      date.getFullYear(),
	      this.padTo2Digits(date.getMonth() + 1),
	      this.padTo2Digits(date.getDate()),
	    ].join('-') +
	    ' ' +
	    [
	      this.padTo2Digits(date.getHours()),
	      this.padTo2Digits(date.getMinutes()),
	      this.padTo2Digits(date.getSeconds()),
	    ].join(':')
	  );
	}

	dotdot(string) {

		if(string == null)
			return 'N/A';

		return string.replace(string.substr(5, string.length - 10), '...');
	}

}

module.exports = new Helpers();