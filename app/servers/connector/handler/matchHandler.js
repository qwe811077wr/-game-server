/**
 * Date: 2019/3/4
 * Author: admin
 * Description: 金币场匹配相关接口
 */

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

// 获取金币场游戏大厅信息
pro.getMatchInfo = function (msg, session, next) {
	// pomelo.app.rpc.matchGlobal.matchRemote.getMatchInfo(null, gameType, function (resp) {
	// 	next(null, resp);
	// });
};

// 进入金币场
pro.enterGoldRoom = function (msg, session, next) {
	let gameType = msg.gameType;
	let stage = msg.stage;
	session.avatar.match.enterGoldRoom(gameType, stage, next);
};