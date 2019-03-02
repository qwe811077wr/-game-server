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
	this.robotList = {};
	this.roomsInfo = {};
	this._init();
};

var pro  = MatchStub.prototype;

pro._init = function () {
	// pdk15 init
	this.roomsInfo[consts.GameType.PDK_15] = {};
	this.robotList[consts.GameType.PDK_15] = {};
	for (let i = 0; i < 3; i++) {
		this.roomsInfo[consts.GameType.PDK_15][i] = {};
		this.robotList[consts.GameType.PDK_15][i] = [];
	}
};

pro._checkRoom = function (gameType, stage) {
	let gamelist = this.roomsInfo[gameType];
	if (!gamelist) {
		return false;
	}

	let stagelist = gamelist[stage];
	if (!stagelist) {
		return false;
	}

	return true;
};

// 进入房间
pro.enterRoom = function (gameType, stage, usrInfo, cb) {
	if (!this._checkRoom(gameType, stage)) {
		cb({code: consts.MatchCode.GAEM_TYPE_INVALID});
		return;
	}

	// 如果是机器人
	if (this._isRobot(usrInfo.openid)) {
		this._addRobotToReadyList(gameType, stage, usrInfo);
		cb({code: consts.MatchCode.OK});
		return;
	}

	if (false) {
		// 已经在房间
	} else {
		// 有空位且房间内玩家已准备
		

		// 创建房间
		let tables = pomelo.app.getServersByType('table');
		let res = dispatcher.dispatch(usrInfo.id, tables);
		pomelo.app.rpc.table.goldRemote.createRoom.toServer(res.id, usrInfo, function (resp) {
			cb(resp);


		});
	}
};

// 机器人添加进准备列表
pro._addRobotToReadyList = function (gameType, stage, usrInfo) {
	let robotArr = this.robotList[gameType][stage]
	if (!this._isInArray(usrInfo.id, robotArr)) {
		robotArr.push(usrInfo);
	}
};

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




///-----------------------------------------------------------------

// 获取金币场大厅信息
pro.getMatchInfo = function (gameType, cb) {
	if (gameType == consts.GameType.PDK_15) {
		let resp = {
			code: consts.MatchCode.OK,
			hallInfo: this._getPdk15Info()
		}
		cb(resp);
	} else {
		logger.warn('no exist playway type[%d]', gameType);
		cb({code: consts.MatchCode.GAME_TYPE_FAIL});
	}
};

pro._getPdk15Info = function () {
	let hallInfo = [];
	for (let i = 0; i < this.pdk15_info.length; i++) {
		const info = this.pdk15_info[i];
		let count = info.readyPlayers.length + info.robotPlayers.length + info.startTeams.length * 3;
		hallInfo.push({
			playerCount: count,
		});
	}
	return hallInfo;
};



// 开始匹配 stage 0, 1, 2 ...对应选择阶梯
pro.startMatch = function(gameType, stage, usrInfo, cb) {
	// 是否已经在比赛中
	if (this._isInTable(stage, usrInfo.id)) {
		cb({code: consts.MatchCode.EXIST_IN_GAME});
		return;
	};

	if (gameType == consts.GameType.PDK_15) {
		let hallInfo = this.pdk15_info[stage];
		if (hallInfo) {
			cb({code: consts.MatchCode.OK});
			// 加入分配列表
			this._addReadyPlayer(gameType, stage, usrInfo);
		} else {
			logger.warn('no exist stage type[%d]', stage);
			cb({code: consts.MatchCode.STAGE_TYPE_FAIL});
		}
	} else {
		logger.warn('no exist playway type[%d]', gameType);
		cb({code: consts.MatchCode.GAME_TYPE_FAIL});
	}
};

// 添加准备玩家
pro._addReadyPlayer = function (gameType, stage, usrInfo) {
	if (gameType == consts.GameType.PDK_15) {
		if (this._isRobot(usrInfo.openid)) {
			let robotPlayers = this.pdk15_info[stage].robotPlayers;
			if (!this._isInList(robotPlayers, usrInfo.id)) {
				robotPlayers.push(usrInfo);
			}
		} else {
			let readyPlayers = this.pdk15_info[stage].readyPlayers;
			if (!this._isInList(readyPlayers, usrInfo.id)) {
				readyPlayers.push(usrInfo);
			}
		}
	}
};

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

// 是否是机器人
pro._isRobot = function (openid) {
	if (openid.indexOf("robot_") != -1) {
		return true;
	}
	return false;
};

// 是否已经牌桌里
pro._isInTable = function (stage, id) {
	let hallInfo = this.pdk15_info[stage];
	let startTeams = hallInfo.startTeams;
	for (let i = 0; i < startTeams.length; i++) {
		const team = startTeams[i];
		for (let j = 0; j < team.length; j++) {
			const user = team[j];
			if (user.id == id) {
				return true;
			}
		}
	}
	return false;
};

// 是否已经在列表中
pro._isInList = function (list, id) {
	for (let i = 0; i < list.length; i++) {
		const user = list[i];
		if (user.id == id) {
			return true;
		}
	}
	return false;
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