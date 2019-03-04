/**
 * Date: 2019/2/20
 * Author: admin
 * Description: 
 */
let pomelo = require('pomelo');
var logger = require('pomelo-logger').getLogger('game', 'matchStub');
var consts = require('../common/consts');
var dispatcher = require('../util/dispatcher');

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
	// pdk15 init
	this.matchInfo[consts.GameType.PDK_15] = {};
	this.robotList[consts.GameType.PDK_15] = {};
	this.schedulList[consts.GameType.PDK_15] = {};
	for (let i = 0; i < consts.PdkStageCount; i++) {
		this.matchInfo[consts.GameType.PDK_15][i] = {};
		this.robotList[consts.GameType.PDK_15][i] = [];
		this.schedulList[consts.GameType.PDK_15][i] = setInterval(function () {
			self._startMatchRobot(consts.GameType.PDK_15, i);
		}, 1000 + i * 3000);
	}
};

// 获取金币场大厅信息
pro.getMatchInfo = function (gameType, cb) {
	
};

// 进入房间
pro.enterGoldRoom = function (gameType, stage, usrInfo, cb) {
	let self = this;
	let goldRoomId = usrInfo.goldRoomId;
	let roomInfo = this._findRoomInfo(gameType, stage, goldRoomId) || {};
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
		let roomInfo = resp.roomInfo;
		roomInfo.toServerId = toServerId;
		self._updateRoomInfo(gameType, stage, roomInfo);
	});
};

// 机器人添加进准备列表
pro._addRobotToReadyList = function (gameType, stage, usrInfo) {
	let robotArr = this.robotList[gameType][stage]
	if (!this._isInArray(usrInfo.id, robotArr)) {
		robotArr.push(usrInfo);
	}
};

// 获取一个机器人信息
pro._getRobotInfo = function () {
	
};

// 移除

// 是否在数组中
pro._isInArray = function (id, array) {
	for (let i = 0; i < array.length; i++) {
		const _id = array[i].id;
		if (_id == id) {
			return true;
		}
	}
	return false;
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
pro._removeRoomInfo = function (gameType, stage, roomId) {
	let list = this.matchInfo[gameType][stage];
	delete list[roomId];
};

// 查找房间信息
pro._findRoomInfo = function (gameType, stage, roomId) {
	let list = this.matchInfo[gameType][stage];
	let roomInfo = list[roomId];
	return roomInfo;
};

// 开始匹配机器人
pro._startMatchRobot = function (gameType, stage) {
	let self = this;
	let list = this.matchInfo[gameType][stage];
	for (let i = 0; i < list.length; i++) {
		const roomInfo = list[i];
		if (roomInfo.players.length < 3) {
			// 加入房间
			let toServerId = roomInfo.toServerId;
			let roomId = roomInfo.roomid;
			let usrInfo = 
			pomelo.app.rpc.table.goldRemote.joinGoldRoom.toServer(toServerId, roomId, usrInfo, function (resp) {
				if (resp.code == consts.RoomCode.OK) {
					let roomInfo = resp.roomInfo;
					roomInfo.toServerId = toServerId;
					self._updateRoomInfo(gameType, stage, roomInfo);
				}
			});
		}
	}
};




///-----------------------------------------------------------------

// 匹配玩家
pro._checkMatchPDK15 = function (stage) {
	let hallInfo = this.pdk15_info[stage];
	let readyPlayers = hallInfo.readyPlayers;
	let robotPlayers = hallInfo.robotPlayers;
	let startTeams = hallInfo.startTeams;
	if (readyPlayers[0]) {
		let remainPlayers = readyPlayers.slice(1, readyPlayers.length) || [];
		let mergePlayers = robotPlayers.concat(remainPlayers);
		if (mergePlayers.length < 2) {
			return;
		}
		mergePlayers = this._shuffleArray(mergePlayers);
		let team = [];
		team.push(readyPlayers[0]);
		team.push(mergePlayers[0]);
		team.push(mergePlayers[1]);
		startTeams.push(team);
		logger.info('matchTeam=', team);

		this._removeReadyListByTeam(stage, team);

		// 队伍创房开始比赛
		this._createTeamTable(consts.GameType.PDK_15, stage, team);
	}
};

// 队伍远程创建牌桌
pro._createTeamTable = function (gametype, stage, team) {
	let leader = team[0];
	let tables = pomelo.app.getServersByType('table');
	let res = dispatcher.dispatch(leader.id, tables);
	pomelo.app.rpc.table.goldRemote.startGame.toServer(res.id, gametype, stage, team, null);
};

// 混乱数组
pro._shuffleArray = function (array) {
	let temp = array.slice(0);
	array = [];
	while (temp.length > 0) {
		let idx = Math.floor(Math.random() * 10000) % temp.length;
		array.push(temp[idx]);
		temp.splice(idx, 1);
	}
	return array;
};

// 队伍里玩家从准备列表移除
pro._removeReadyListByTeam = function (stage, team) {
	let hallInfo = this.pdk15_info[stage];
	let readyPlayers = hallInfo.readyPlayers;
	let robotPlayers = hallInfo.robotPlayers;
	for (let i = 0; i < team.length; i++) {
		const user = team[i];
		if (this._isRobot(user.openid)) {
			// 机器人
			for (let m = 0; m < robotPlayers.length; m++) {
				const _user = robotPlayers[m];
				if (_user.id == user.id) {
					robotPlayers.splice(m, 1);
					break;
				}
			}
		} else {
			// 真实玩家
			for (let m = 0; m < readyPlayers.length; m++) {
				const _user = readyPlayers[m];
				if (_user.id == user.id) {
					readyPlayers.splice(m, 1);
					break;
				}
			}
		}
	}
};


// 把队伍从已开赛列表中移除
pro.removeFromStartList = function (gameType, stage, team, cb) {
	logger.info('removeTeam=', team);
	if (gameType == consts.GameType.PDK_15) {
		let hallInfo = this.pdk15_info[stage];
		let startTeams = hallInfo.startTeams;
		let isFind = false;
		for (let i = 0; i < startTeams.length; i++) {
			const starteam = startTeams[i];
			for (let j = 0; j < starteam.length; j++) {
				const user = starteam[j];
				if (user.id == team[j].id) {
					isFind = true;
				} else {
					isFind = false;
					break;
				}
			}
			if (isFind) {
				startTeams.splice(i, 1);
				break;
			}
		}
		if (!isFind) {
			logger.warn('no find team in startTeams.');
		}
	} else {
		logger.warn('no exist playway type[%d]', gameType);
	}
	cb();
};