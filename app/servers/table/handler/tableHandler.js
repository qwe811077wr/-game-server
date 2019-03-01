module.exports = function(app) {
	return new Handler(app);
};

var Handler = function(app) {
	this.app = app;
};

var handler = Handler.prototype;

// 退出房间
handler.leaveRoom = function(msg, session, next) {
	session.tableEntity.leaveRoom(session.uid, next);
};

// 游戏准备
handler.readyGame = function (msg, session, next) {
    session.tableEntity.readyGame(session.uid, next);
};

// 解散游戏
handler.dissolveGame = function (msg, session, next) {
	session.tableEntity.dissolveGame(session.uid, msg.dissolveType, next);
};

// 出牌
handler.playCard = function (msg, session, next) {
	let bCardData = msg.bCardData;
	let bCardCount = msg.bCardCount;
	session.tableEntity.playCard(session.uid, bCardData, bCardCount, next);
};

// 托管
handler.autoCard = function (msg, session, next) {
	session.tableEntity.autoCard(session.uid, msg.bAuto, next);
};
