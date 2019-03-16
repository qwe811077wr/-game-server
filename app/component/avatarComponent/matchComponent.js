/**
 * Date: 2019/3/4
 * Author: admin
 * Description:
 */
let pomelo = require('pomelo');
let util = require('util');
let Component = require('../component');
let consts = require('../../common/consts');
let stageCfg = _require('../../common/stage');

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

	// 阶梯金币上下限检测
	let curCoins = this.entity.coins;
	if (!this._checkStage(gameType, stage, curCoins)) {
		next(null, {
			code: consts.MatchCode.STAGE_COINS_LOW,
			canStage: this._getCanEnterStage(gameType, curCoins)
		});
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

pro._checkStage = function (gameType, stage, curCoins) {
	let cfg = stageCfg[gameType][stage];
	if (cfg.eArea < 0) {
		if (curCoins >= cfg.bArea) {
			return true;
		}
	} else {
		if (curCoins >= cfg.bArea && curCoins <= cfg.eArea) {
			return true;
		}
	}
	return false;
};

pro._getCanEnterStage = function (gameType, curCoins) {
	let cfg = stageCfg[gameType];
	let canStage = [];
	for (const i in cfg) {
		let began = cfg[i].bArea;
		let end = cfg[i].eArea;
		if (end < 0) {
			if (curCoins >= began) {
				canStage.push(parseInt(i));
			}
		} else {
			if (curCoins >= began && curCoins <= end) {
				canStage.push(parseInt(i));
			}
		}
	}
	return canStage;
};