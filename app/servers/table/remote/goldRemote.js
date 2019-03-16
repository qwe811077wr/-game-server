var entityFactory = _require('../../../entity/entityFactory');
var entityManager = _require('../../../services/entityManager');
var consts = require('../../../common/consts');

module.exports = function (app) {
	return new Remote(app);
};

var Remote = function (app) {
	this.app = app;
};

var pro = Remote.prototype;

pro.enterGoldRoom = function (gameType, stage, usrInfo, cb) {
	let goldEntity = entityManager.getEntity(usrInfo.goldRoomId);
	if (!goldEntity) {
		// 创建
		if (gameType == consts.GameType.PDK_15 || gameType == consts.GameType.PDK_16) {
			goldEntity = entityFactory.createEntity("GoldEntity", null, {
				usrInfo: usrInfo,
				gameType: gameType,
				stage: stage,
			});
		} else {
			cb({code: consts.RoomCode.GAME_TYPE_INVALID});
			return;
		}
	}
	goldEntity.updateUserToPlayers(usrInfo);
	cb({
		code: consts.RoomCode.OK,
		roomInfo: goldEntity.clientEnterInfo(usrInfo.id)
	});
};

pro.joinGoldRoom = function (roomid, usrInfo, cb) {
	let resp = {};
	let goldEntity = entityManager.getEntity(roomid);
	if (goldEntity) {
		goldEntity.updateUserToPlayers(usrInfo);
		if (usrInfo.goldRoomId === roomid) {
			// 已经在房间里
			resp["code"] = consts.RoomCode.OK;
			resp["roomInfo"] = goldEntity.clientEnterInfo(usrInfo.id);
		} else if (goldEntity.checkFullMember()) {
			// 人数已满
			resp["code"] = consts.RoomCode.FULL_PLAYER_ROOM;
		} else {
			// 加入
			let chairID = goldEntity.roomInfo.players.length;
			goldEntity.addUserToPlayers(usrInfo, chairID);
			resp["code"] = consts.RoomCode.OK;
			resp["roomInfo"] = goldEntity.clientEnterInfo(usrInfo.id);
		}
	} else {
		resp["code"] = consts.RoomCode.NO_EXIST_ROOM;
	}
	cb(resp);
};
