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
handler.getMatchInfo = function (msg, session, next) {
	let gameType = msg.gameType;
	session.avatar.match.getMatchInfo(gameType, next);
};

// 进入金币场
handler.enterGoldRoom = function (msg, session, next) {
	let gameType = msg.gameType;
	let stage = msg.stage;
	session.avatar.match.enterGoldRoom(gameType, stage, next);
};