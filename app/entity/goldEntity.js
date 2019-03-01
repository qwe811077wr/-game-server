/**
 * Date: 2019/2/21
 * Author: admin
 * Description: 金币场牌桌管理
 */
let pomelo = require('pomelo');
let util = require('util');
let Entity = require('./entity');
let consts = require('../common/consts');
let messageService = require('../services/messageService');
let pdkHelper = require('../helper/pdkHelper');
let utils = require('../util/utils');
let pdkAIHelper = require('../helper/pdkAIHelper');

let GoldEntity = function (opts) {
    opts = opts || {};
	Entity.call(this, opts);

	this.cardInfo = {};
	this.gametype = opts.gametype;
	this.stage = opts.stage;
	this.team = opts.team;
	this.autoinfo = [0, 0, 0];   // 托管信息
	this.autoSchedule = null; // 托管定时器
	this.initGoldRoom();
};

util.inherits(GoldEntity, Entity);
module.exports = GoldEntity;

let pro = GoldEntity.prototype;

pro.initGoldRoom = function () {
    this.cardInfo = {
        handCardData: [0, 0, 0],   	//手牌
        cardCount: [0, 0, 0],      	//手牌数量
        currentUser: 0,     		//当前出牌用户
        turnCardCount: 0,   		//上回合出牌张数
        turnCardData:[],    		//上回合出牌数据
        turnUser: consts.InvalUser, 	//上回合用户
        bUserWarn: [false, false, false] //是否报警
    };
	this._startGame();
};

// 游戏开始
pro._startGame = function () {
	// 洗牌
	let cardData = pdkHelper.RandCardList();

	// 配牌
	// cardData = [
	// 	1, 45, 13, 60, 12, 10, 55, 23, 54, 37, 21, 52, 4, 19, 3,
	// 	29, 44, 43, 11, 58, 26, 57, 25, 40, 24, 22, 6, 53, 36, 35,
	// 	2, 28, 59, 27, 42, 41, 9, 56, 8, 39, 7, 38, 5, 20, 51,
	// ];

	// 发牌、排序
	var handCardData = [];
	var pos = 0
	for (let i = 0; i < 3; i++) {
		let carditem = cardData.slice(pos, pos + consts.MaxCardCount);
		handCardData.push(carditem);
		pos = pos + consts.MaxCardCount;
		pdkHelper.SortCardList(handCardData[i], consts.MaxCardCount);
		this.cardInfo.handCardData[i] = carditem;
		this.cardInfo.cardCount[i] = consts.MaxCardCount;
	}
	this.logger.info('玩家手牌数据:', handCardData);

    // 黑桃3先出
    var banker = this._getBankerUser(handCardData, 3);
    this.cardInfo.currentUser = banker;
	
	// 游戏开始,通知发牌
	for (let i = 0; i < this.team.length; i++) {
		const user = this.team[i];
		let sid = user.preSid;
		let route = 'onStartGame';
		let msg = {
			wCurrentUser: banker,
			cbCardData: handCardData[i],
			wChairID: i
		}
		let uids = [{
			uid: user.id,
			sid: sid
		}]
		messageService.pushMessageByUids(uids, route, msg);
		this.logger.info("name[%s] sid[%s] msg[%s]", user.name, sid, route);

		// 插入charirID
		this.team[i].chairID = i;

		// 绑定serverid、table_key
		let tableID = this.id;
		let toServerID = pomelo.app.getServerId();
		pomelo.app.rpc.connector.entryRemote.onGoldStartGame.toServer(sid, user.id, tableID, toServerID, null);
	}
	this._resetAutoSchedule(20);
};

// 获取庄家[cbCard:这个牌先出]
pro._getBankerUser = function(handCardData, cbCard)
{
	for (let i =0;i < 3;i++)
	{
		for (let j =0; j < consts.MaxCardCount;j++)
		{
			if (handCardData[i][j] == cbCard)
			{
				return i;
			}
		}
	}
	return consts.InvalUser;
};

// 出牌(参数为空是托管AI出牌)
pro.playCard = function(uid, bCardData, bCardCount, next) {
	let cardInfo = this.cardInfo;
	let team = this.team;
	let playerCount = team.length;
	let wChairID = null;
	if (uid) {
		wChairID = this._getChairIDByUid(uid);
	} else {
		// 托管AI出牌
		wChairID = cardInfo.currentUser;
		if (wChairID == cardInfo.turnUser) {
			cardInfo.turnCardData = [];
		}
		let handCardData = cardInfo.handCardData[wChairID];
		let turnCardData = cardInfo.turnCardData;
		let bNextWarn = cardInfo.bUserWarn[(wChairID+1)%playerCount];
		let outCard = pdkAIHelper.AISearchOutCard(handCardData, turnCardData, bNextWarn);
		if (!outCard) {
			// 要不起
			return;
		}
		bCardData = outCard.bCardData;
		bCardCount = outCard.bCardCount;
	}

	// 是否轮到出牌
	if (wChairID != cardInfo.currentUser) {
		this.logger.warn('wChairID[%d] currentUser[%d] no equiel!',wChairID, cardInfo.currentUser);
		utils.invokeCallback(next, null, {code: consts.PlayCardCode.NO_TURN_OUT_CARD});
		this._broadcastHandCardMsg(uid);
		return;
	}

	// 检测出牌类型
	let bCardType = 0;
	if (cardInfo.cardCount[wChairID] != bCardCount) {
		bCardType = pdkHelper.GetCardType(bCardData, bCardCount);
	} else {
		bCardType = pdkHelper.GetLastCardType(bCardData,bCardCount);
	}
	if(bCardType == pdkHelper.CardType.CT_ERROR) 
	{
		utils.invokeCallback(next, null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
		this._broadcastHandCardMsg(uid);
		return;
	}

	// 出牌排序
	pdkHelper.SortCardList(bCardData, bCardCount);

	// 跟随出牌
	if (cardInfo.turnCardCount != 0 && wChairID != cardInfo.turnUser) {
		if (cardInfo.cardCount[wChairID] != bCardCount) {
			if (pdkHelper.CompareCard(cardInfo.turnCardData,bCardData,cardInfo.turnCardCount,bCardCount)==false) {
				utils.invokeCallback(next, null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
				this._broadcastHandCardMsg(uid);
				return;
			}
		} else {
			if (pdkHelper.CompareLastCard(cardInfo.turnCardData,bCardData,cardInfo.turnCardCount,bCardCount)==false)
			{
				utils.invokeCallback(next, null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
				this._broadcastHandCardMsg(uid);
				return;
			}
		}
	}

	//报警必须出最大牌
	if (cardInfo.bUserWarn[(wChairID+1)%playerCount]==true && bCardCount==1)
	{
		pdkHelper.SortCardList(cardInfo.handCardData[wChairID],cardInfo.cardCount[wChairID]);
		if (pdkHelper.GetCardLogicValue(cardInfo.handCardData[wChairID][0]) != pdkHelper.GetCardLogicValue(bCardData[0]))
		{
			utils.invokeCallback(next, null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
			this._broadcastHandCardMsg(uid);
			return;
		}
	}

	// 删除扑克
	if(pdkHelper.RemoveCard(bCardData,bCardCount,cardInfo.handCardData[wChairID],cardInfo.cardCount[wChairID]) == false)
	{
		utils.invokeCallback(next, null, {code: consts.PlayCardCode.REMOVE_CARD_ERROR});
		this._broadcastHandCardMsg(uid);
		this.logger.error(bCardData,bCardCount,cardInfo.handCardData[wChairID],cardInfo.cardCount[wChairID]);
		return;
	}
	utils.invokeCallback(next, null, {code: consts.PlayCardCode.OK});

	// 出牌记录
	cardInfo.cardCount[wChairID]-=bCardCount;
	cardInfo.turnCardCount=bCardCount;
	cardInfo.turnCardData=bCardData.slice(0);
	cardInfo.turnUser=wChairID;

	// 切换用户
	if (cardInfo.cardCount[wChairID]!=0)
		cardInfo.currentUser=(cardInfo.currentUser+1) % playerCount;
	else
		cardInfo.currentUser = consts.InvalUser;

	// 发送自己当前剩余手牌
	this._broadcastHandCardMsg(uid);

	// 报单消息
	if (cardInfo.cardCount[wChairID]==1) {
		this._broadcastSingCardMsg(wChairID);
	}

	// 出牌消息
	this._broadcastOutCardMsg(wChairID, bCardData, bCardCount, cardInfo.currentUser);

	if (cardInfo.currentUser == consts.InvalUser) {
		// 结算消息
		this.logger.info('赢家: [%d](%s), 出牌:', wChairID, team[wChairID].name, bCardData);
		this._broadcastSettlementMsg(wChairID);
		// 销毁房间
		this.destroy();
	} else {
		this.logger.info('当前:[%d](%s), 出牌:', wChairID, team[wChairID].name, bCardData);
		// 要不起自动下一手
		this._checkNextOutCard(wChairID, cardInfo.currentUser);
	}
};

pro._getChairIDByUid = function (uid) {
	let team = this.team;
	for (let i = 0; i < team.length; i++) {
		const user = team[i];
		if (uid == user.id) {
			return user.chairID;
		}
	}
};

// 要不起自动下手
pro._checkNextOutCard = function (wChairID, nextChariID) {
	if (wChairID == nextChariID) {
		return false;
	}

	let cardInfo = this.cardInfo;
	let playerCount = this.team.length;
	let handCardData = cardInfo.handCardData[nextChariID];
	let cardCount = cardInfo.cardCount[nextChariID];
	let turnCardData = cardInfo.turnCardData;
	let turnCardCount = cardInfo.turnCardCount;

	if (pdkHelper.SearchOutCard(handCardData, cardCount, turnCardData, turnCardCount)==false)
	{
		// 要不起
		let wPassUser = nextChariID;
		let currentUser=(wPassUser+1) % playerCount;
		this.cardInfo.currentUser = currentUser;
		let team = this.team;
		this.logger.info('要不起:[%d](%s)',wPassUser, team[wPassUser].name);

		// 推送要不起消息
		this._broadcastPassCardMsg(wPassUser, currentUser);

		// 递归
		this._checkNextOutCard(wChairID, currentUser);
	}
};

// 推送玩家手牌消息
pro._broadcastHandCardMsg = function (uid) {
	if (!uid) {
		return;
	}

	let wChairID = this._getChairIDByUid(uid);
	let route = 'onHandCardUser';
	let msg = {
		wChairID: wChairID,
		handCardData: this.cardInfo.handCardData[wChairID]
	};
	this._notifyMsgToOtherMem(uid, route, msg);
};

// 推送单张报警消息
pro._broadcastSingCardMsg = function (wChairID) {
	let cardInfo = this.cardInfo;
	cardInfo.bUserWarn[wChairID] = true;
	let route = 'onWarnUser';
	let msg = {wWarnUser: wChairID};
	this._notifyMsgToOtherMem(null, route, msg);
};

// 推送出牌消息
pro._broadcastOutCardMsg = function (wChairID, bCardData, bCardCount, currentUser) {
	let route = 'onOutCard'
	let msg = {
		outcardUser: wChairID,
		cardData: bCardData,
		cardCount: bCardCount,
		currentUser: currentUser
	}
	this._notifyMsgToOtherMem(null, route, msg);
	this._resetAutoSchedule();
};

// 推送结算消息
pro._broadcastSettlementMsg = function (wChairID) {
	let route = 'onSettlement'
	let msg = {
		winUser: wChairID,
	}
	this._notifyMsgToOtherMem(null, route, msg);
};

// 推送要不起消息
pro._broadcastPassCardMsg = function (wPassUser, currentUser) {
	let route = 'onPassCard'
	let msg = {
		wPassUser: wPassUser,
		wCurrentUser: currentUser,
	}
	this._notifyMsgToOtherMem(null, route, msg);
	this._resetAutoSchedule();
};

// 推送托管消息
pro._broadcastAutoCardMsg = function (wAutoUser, bAuto) {
	let route = 'onAutoCard'
	let msg = {
		wAutoUser: wAutoUser,
		bAuto: bAuto
	}
	this._notifyMsgToOtherMem(null, route, msg);
	
	this.autoinfo[wAutoUser] = bAuto;
	if (bAuto == 1 && wAutoUser == this.cardInfo.currentUser) {
		// 自动出牌
		this.playCard();
	}
};

// uid 为空向队伍里所有人推送, 否则指定uid推送
pro._notifyMsgToOtherMem = function (uid, route, msg) {
	var uids = [];
	for (let i = 0; i < this.team.length; i++) {
		const user = this.team[i];
		if (uid) {
			if (user.id == uid) {
				let preServerID = user.preSid;
				uids.push({uid: user.id, sid: preServerID});
				break;
			}
		} else {
			let preServerID = user.preSid;
			uids.push({uid: user.id, sid: preServerID});
		}
	}

    if (uids.length) {
        messageService.pushMessageByUids(uids, route, msg);
    }
};

// 托管定时器重置
pro._resetAutoSchedule = function (dt) {
	let self = this;
	dt = dt || 15;  // 默认15s自动托管
	self._clearAutoSchedul();
	
	let wChairID = self.cardInfo.currentUser;
	if (wChairID == consts.InvalUser) {
		return;
	}

	// 已经托管不能直接调用playCard，要有延时(TODO:原因以后研究...)
	if (self.autoinfo[wChairID] == 1) {
		dt = 1;
	}

	self.autoSchedule = setInterval(function () {
		if (self.autoinfo[wChairID] == 1) {
			// 已经托管
			self.playCard();
		} else {
			// 进入托管
			self._broadcastAutoCardMsg(wChairID, 1);
		}
	}, dt * 1000);
};

// 托管定时器清除
pro._clearAutoSchedul = function () {
	if (this.autoSchedule) {
		clearTimeout(this.autoSchedule);
		this.autoSchedule = null;
	}
};

// 托管请求
pro.autoCard = function (uid, bAuto, next) {
	let wChairID = this._getChairIDByUid(uid);
	this._broadcastAutoCardMsg(wChairID, bAuto);
	next(null, consts.OK);
};

// 销毁
pro.destroy = function () {
	this._clearAutoSchedul();
	for (let i = 0; i < this.team.length; i++) {
		const user = this.team[i];
		let preServerID = user.preSid;
		pomelo.app.rpc.connector.entryRemote.onGoldDissolveGame.toServer(preServerID, user.id, null);
	}
	pomelo.app.rpc.matchGlobal.matchRemote.removeFromStartList(null, this.gametype, this.stage, this.team, null);
	Entity.prototype.destroy.call(this);
};