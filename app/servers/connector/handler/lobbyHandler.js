/**
 * Date: 2019/2/14
 * Author: admin
 * Description: 大厅相关接口
 */

module.exports = function(app) {
    return new Handler(app);
};

var Handler = function(app) {
    this.app = app;
};

var handler = Handler.prototype;

handler.createRoom = function (msg, session, next) {
    session.avatar.lobby.createRoom(msg.roomCfg, next);
};

handler.joinRoom = function (msg, session, next) {
	session.avatar.lobby.joinRoom(msg.roomid, next);
};

handler.getMatchInfo = function (msg, session, next) {
    session.avatar.lobby.getMatchInfo(msg.gameType, next);
};

handler.startMatch = function (msg, session, next) {
    session.avatar.lobby.startMatch(msg.gameType, msg.stage, next);
};