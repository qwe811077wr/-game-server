/**
 * Date: 2019/2/20
 * Author: admin
 * Description: 管理所有游戏金币场匹配逻辑, 限定只开一台
 */

module.exports = function (app) {
	return new Remote(app);
};

var Remote = function (app) {
	this.app = app;
};

var pro = Remote.prototype;

pro.getMatchInfo = function (gameType, cb) {
	this.app.get('matchStub').getMatchInfo(gameType, cb);
};

pro.startMatch = function (gameType, stage, usrInfo, cb) {
	this.app.get('matchStub').startMatch(gameType, stage, usrInfo, cb);
};

pro.removeFromStartList = function (gameType, stage, team, cb) {
	this.app.get('matchStub').removeFromStartList(gameType, stage, team, cb);
};