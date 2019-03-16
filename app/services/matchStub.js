/**
 * Date: 2019/2/20
 * Author: admin
 * Description: 
 * 匹配规则: 只匹配机器人, 机器人进入房间自动准备
 */
let pomelo = require('pomelo');
var logger = require('pomelo-logger').getLogger('game', 'matchStub');
var consts = require('../common/consts');
var dispatcher = _require('../util/dispatcher');
let messageService = _require('../services/messageService');

var instance = null;

module.exports = function (app) {
    if (instance) {
        return instance;
    }
    return instance = new MatchStub(app);
};

var MatchStub = function (app) {
	this.app = app;
	this.matchInfo = {};
	this.robotList = {};
	this.schedulList = {};
	this._init();
};

var pro  = MatchStub.prototype;

pro._init = function () {
	let self = this;
	// pdk15 init
	// this.matchInfo[consts.GameType.PDK_15] = [];
	// this.robotList[consts.GameType.PDK_15] = [];
	// this.schedulList[consts.GameType.PDK_15] = [];
	// for (let i = 0; i < consts.Pdk15StageCount; i++) {
	// 	this.matchInfo[consts.GameType.PDK_15][i] = {};
	// 	this.robotList[consts.GameType.PDK_15][i] = [];
	// 	this.schedulList[consts.GameType.PDK_15][i] = setInterval(function () {
	// 		self._startMatchRobot(consts.GameType.PDK_15, i);
	// 	}, 3000 + i * 3000);
	// }

	// pdk16 init
	this.matchInfo[consts.GameType.PDK_16] = [];
	this.robotList[consts.GameType.PDK_16] = [];
	this.schedulList[consts.GameType.PDK_16] = [];
	for (let i = 0; i < consts.Pdk16StageCount; i++) {
		this.matchInfo[consts.GameType.PDK_16][i] = {};
		this.robotList[consts.GameType.PDK_16][i] = [];
		this.schedulList[consts.GameType.PDK_16][i] = setInterval(function () {
			self._startMatchRobot(consts.GameType.PDK_16, i);
		}, 3000 + i * 3000);
	}
};

// 获取金币场大厅信息
pro.getMatchInfo = function (gameType, cb) {
	let gameInfo = [];
	let robotStages = this.robotList[gameType];
	let i = 0;
	do {
		const robots = robotStages[i];
		gameInfo.push(robots.length);
		i++;
	} while (i < robotStages.length);

	let resp = {
		code: consts.MatchCode.OK,
		gameInfo: gameInfo
	}
	cb(resp);
};

// 进入房间
pro.enterGoldRoom = function (gameType, stage, usrInfo, cb) {
	let self = this;
	let goldRoomId = usrInfo.goldRoomId;
	let roomInfo = {};
	if (goldRoomId != "0") {
		roomInfo = this._findRoomInfoEx(goldRoomId) || {};
	}
	let toServerId = roomInfo.toServerId;
	if (!toServerId) {
		// 如果是机器人
		if (this._isRobot(usrInfo.openid)) {
			this._addRobotToReadyList(gameType, stage, usrInfo);
			cb({code: consts.MatchCode.OK});
			return;
		}

		let tables = pomelo.app.getServersByType('table');
		let res = dispatcher.dispatch(usrInfo.id, tables);
		toServerId = res.id;
	}

	pomelo.app.rpc.table.goldRemote.enterGoldRoom.toServer(toServerId, gameType, stage, usrInfo, function (resp) {
		cb(resp);
		if (resp.code == consts.RoomCode.OK) {
			let roomInfo = resp.roomInfo;
			roomInfo.toServerId = toServerId;
			self._updateRoomInfo(gameType, stage, roomInfo);
			self._enterRoomCtr(usrInfo, roomInfo);
		}
	});
};

// 机器人添加进准备列表
pro._addRobotToReadyList = function (gameType, stage, usrInfo) {
	let robotArr = this.robotList[gameType][stage];
	if (!this._updateUsrInfo(usrInfo, robotArr)) {
		robotArr.push(usrInfo);
		logger.info('添加机器人进列表:', usrInfo);
	}
};

// 更新玩家属性
pro._updateUsrInfo = function (usr, array) {
	for (let i = 0; i < array.length; i++) {
		const _id = array[i].id;
		if (_id == usr.id) {
			array[i].coins = usr.coins;
			array[i].gems = usr.gems;
			return true;
		}
	}
	return false;
};

// 从机器人列表移除一个机器人并将其返回
pro._spliceRobotToReadyList = function (gameType, stage) {
	let robotArr = this.robotList[gameType][stage]
	let robot = robotArr.splice(0, 1);
	if (robot[0]) {
		logger.info('自动分配机器人:', robot);
	}
	return robot[0];
};

// 是否是机器人
pro._isRobot = function (openid) {
	if (openid.indexOf("robot_") != -1) {
		return true;
	}
	return false;
};

// 更新房间信息
pro._updateRoomInfo = function (gameType, stage, roomInfo) {
	let list = this.matchInfo[gameType][stage];
	list[roomInfo.roomid] = roomInfo;
};

// 移除房间信息
pro._removeRoomInfo = function (gameType, stage, roomid) {
	let list = this.matchInfo[gameType][stage];
	logger.info('房间移除:', roomid);
	delete list[roomid];
};

// 查找房间信息
pro._findRoomInfo = function (gameType, stage, roomid) {
	let list = this.matchInfo[gameType][stage];
	let roomInfo = list[roomid];
	return roomInfo;
};

// 只有房间id查找
pro._findRoomInfoEx = function (roomid) {
	for (const idx in this.matchInfo) {
		if (this.matchInfo.hasOwnProperty(idx)) {
			const rooms = this.matchInfo[idx];
			for (const id in rooms) {
				if (rooms.hasOwnProperty(id)) {
					const roomInfo = rooms[id];
					if (roomInfo.roomid == roomid) {
						return roomInfo;
					}
				}
			}
		}
	}
};

// 开始匹配机器人
pro._startMatchRobot = function (gameType, stage) {
	let self = this;
	let roomList = this.matchInfo[gameType][stage];
	for (let i in roomList) {
		const roomInfo = roomList[i];
		let remainPlayerCount = 3 - roomInfo.players.length;
		for (let index = 0; index < remainPlayerCount; index++) {
			// 填充机器人加入
			let toServerId = roomInfo.toServerId;
			let roomid = roomInfo.roomid;
			let usrInfo = this._spliceRobotToReadyList(gameType, stage);
			if (!usrInfo) {
				return;
			}
			pomelo.app.rpc.table.goldRemote.joinGoldRoom.toServer(toServerId, roomid, usrInfo, function (resp) {
				if (resp.code == consts.RoomCode.OK) {
					let roomInfo = resp.roomInfo;
					roomInfo.toServerId = toServerId;
					self._updateRoomInfo(gameType, stage, roomInfo);
					self._enterRoomCtr(usrInfo, roomInfo);
				} else {
					self._addRobotToReadyList(gameType, stage, usrInfo);
				}
			});
		}
	}
};

pro._enterRoomCtr = function (usrInfo, roomInfo) {
	// 绑定serverid、table_key
	let tableID = roomInfo.roomid;
	let toServerID = roomInfo.toServerId;
	let preSid = usrInfo.preSid;
	pomelo.app.rpc.connector.entryRemote.onEnterGoldGame.toServer(preSid, usrInfo.id, tableID, toServerID, null);
	
	// 推送玩家加入信息
	let user = this._getUserInfoByUid(usrInfo.id, roomInfo.players);
	this._notifyMsgToAllUser(roomInfo.players, 'onUserEntryRoom', user);
};

pro._notifyMsgToAllUser = function (players, route, msg) {
	var uids = [];
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
        uids.push({uid: user.id, sid: user.preSid});
	}
    if (uids.length) {
        messageService.pushMessageByUids(uids, route, msg);
    }
};

pro._getUserInfoByUid = function (uid, players) {
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		if (uid == user.id) {
			return user;
		}
	}
};

pro.dissolveGoldRoom = function (gameType, stage, goldRoomId, cb) {
	let roomInfo = this._findRoomInfo(gameType, stage, goldRoomId);
	let players = roomInfo.players;
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		if (this._isRobot(user.openid)) {
			// 机器人自动加入准备列表
			this._addRobotToReadyList(gameType, stage, user);
		}
	}
	this._removeRoomInfo(gameType, stage, goldRoomId);
	cb();
};