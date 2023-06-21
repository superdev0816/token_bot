class UserCollection {

	constructor() {
		this.users = [];
	}

	add(uid, data) {
		this.users[uid] = data;
	}

	get(uid) {
		return this.users[uid];
	}

	exists(uid) {
		return (this.users[uid] != undefined);
	}
}

module.exports = new UserCollection();