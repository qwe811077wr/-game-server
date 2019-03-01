var entityFactory = require('../../../entity/entityFactory');
var consts = require('../../../common/consts');

module.exports = function (app) {
	return new Remote(app);
};

var Remote = function (app) {
	this.app = app;
};

var pro = Remote.prototype;

pro.startGame = function (gametype, stage, team, cb) {
    entityFactory.createEntity("GoldEntity", null, {
		gametype: gametype,
		stage: stage,
		team: team
	});
	cb();
};
