var entityFactory = require('../../../entity/entityFactory');
var entityManager = require('../../../services/entityManager');
var consts = require('../../../common/consts');

module.exports = function (app) {
	return new Remote(app);
};

var Remote = function (app) {
	this.app = app;
};

var pro = Remote.prototype;

pro.createRoom = function (preSid, usrInfo, roomCfg, cb) {
	let privateEntity = entityManager.getEntity(usrInfo.roomid);
	if (!privateEntity) {
		// 创建
		let roomid = this._generateRoomId();
        privateEntity = entityFactory.createEntity("PrivateEntity", roomid, {
			preSid: preSid,
			usrInfo: usrInfo,
			roomCfg: roomCfg
		});
	}

	cb({
		code: consts.RoomCode.OK,
		roomInfo: privateEntity.clientEnterInfo(usrInfo.id)
	});
};

pro.joinRoom = function (preSid, usrInfo, roomid, cb) {
	let resp = {};
	let privateEntity = entityManager.getEntity(roomid);
	if (privateEntity) {
		if (usrInfo.roomid === roomid) {
			// 已经在房间里
			resp["code"] = consts.RoomCode.OK;
			resp["roomInfo"] = privateEntity.clientEnterInfo(usrInfo.id);
		} else if (privateEntity.checkFullMember()) {
			// 人数已满
			resp["code"] = consts.RoomCode.FULL_PLAYER_ROOM;
		} else {
			// 加入
			let chairID = privateEntity.roomInfo.players.length;
			privateEntity.addUserToPlayers(preSid, usrInfo, chairID);
			resp["code"] = consts.RoomCode.OK;
			resp["roomInfo"] = privateEntity.clientEnterInfo(usrInfo.id);
		}
	} else {
		resp["code"] = consts.RoomCode.NO_EXIST_ROOM;
	}
	cb(resp);
};

// TODO: 临时使用(可能不唯一)
pro._generateRoomId = function () {
	var roomId = "";
	for (var i = 0; i < 6; ++i) {
		roomId += Math.floor(Math.random() * 10);
		if (i == 0 && roomId == 0) {
			roomId = '1';
		}
	}
	return parseInt(roomId);
};
