/**
 * Date: 2019/3/4
 * Author: admin
 * Description:
 */
let pomelo = require('pomelo');
let util = require('util');
let Component = _require('../component');
let consts = require('../../common/consts');

let LobbyComponent = function (entity) {
    Component.call(this, entity);
};

util.inherits(LobbyComponent, Component);
module.exports = LobbyComponent;

let pro = LobbyComponent.prototype;

pro.init = function (opts) {
};

// 获取金币场游戏大厅信息
pro.getMatchInfo = function (gameType, next) {
	if (!this._checkValid(gameType, 0)) {
		next(null, {code: consts.MatchCode.GAEM_TYPE_INVALID});
		return;
	}

	pomelo.app.rpc.matchGlobal.matchRemote.getMatchInfo(null, gameType, function (resp) {
		next(null, resp);
	});
};

// 进入金币场
pro.enterGoldRoom = function (gameType, stage, next) {
	if (!this._checkValid(gameType, stage)) {
		next(null, {code: consts.MatchCode.GAEM_TYPE_INVALID});
		return;
	}

	let usrInfo = this.entity.clientLoginInfo();
	usrInfo.preSid = this.entity.serverId;
	pomelo.app.rpc.matchGlobal.matchRemote.enterGoldRoom(null, gameType, stage, usrInfo, function (resp) {
		next(null, resp);
	});
};

pro._checkValid = function (gameType, stage) {
	if (gameType == consts.GameType.PDK_15 && stage >= 0 && stage < consts.Pdk15StageCount) {
		return true;
	} else if (gameType == consts.GameType.PDK_16 && stage >= 0 && stage < consts.Pdk16StageCount) {
		return true;
	}
	return false;
};