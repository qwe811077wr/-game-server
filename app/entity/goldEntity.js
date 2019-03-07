/**
 * Date: 2019/2/21
 * Author: admin
 * Description: 跑得快15张牌桌管理
 */
let pomelo = require('pomelo');
let util = require('util');
let Entity = require('./entity');
let consts = require('../common/consts');
let messageService = require('../services/messageService');
let pdkHelper = require('../helper/pdkHelper');
let utils = require('../util/utils');
let pdkAIHelper = require('../helper/pdkAIHelper');

let offset = 1.5;   // 客户端每回合动作表现时间

let GoldEntity = function (opts) {
    opts = opts || {};
	Entity.call(this, opts);
	this.autoSchedule = null; // 托管定时器
	this.roomInfo = {};  // 房间信息
	this.initGoldRoom(opts.usrInfo, opts.stage);
};

util.inherits(GoldEntity, Entity);
module.exports = GoldEntity;

let pro = GoldEntity.prototype;

pro.initGoldRoom = function (usrInfo, stage) {
    this.roomInfo = {
        roomid: this.id,
		creator: usrInfo.id,
		createTime: Math.ceil(Date.now()/1000),
		status: consts.TableStatus.INIT,
		gameType: consts.GameType.PDK_15,
		stage: stage,
		players: [],
		//游戏开始卡牌信息
		cardInfo:{
			handCardData: [0, 0, 0],   	//手牌
			cardCount: [0, 0, 0],      	//手牌数量
			currentUser: 0,     		//当前出牌用户
			turnCardCount: 0,   		//上回合出牌张数
			turnCardData:[],    		//上回合出牌数据
			turnUser: consts.InvalUser, 	//上回合用户
			bUserWarn: [false, false, false] //是否报警
		},
	};
	this.addUserToPlayers(usrInfo, 0);
};

// 进入房间返回客户端数据
pro.clientEnterInfo = function (uid) {
	let wChairID = this._getChairIDByUid(uid)
	let roomInfo = utils.clone(this.roomInfo);
	roomInfo.cardInfo.handCardData = roomInfo.cardInfo.handCardData[wChairID];
	return roomInfo;
};

pro._getChairIDByUid = function (uid) {
	let players = this.roomInfo.players;
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		if (uid == user.id) {
			return user.chairID;
		}
	}
};

pro._getUidByChairID = function (chairID) {
	let players = this.roomInfo.players;
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		if (chairID == user.chairID) {
			return user.id;
		}
	}
};

pro.checkFullMember = function () {
	if (this.roomInfo) {
		if (this.roomInfo.players.length >= 3) {
			return true;
		}
	}
	return false;
};

pro.addUserToPlayers = function (usrInfo, chairID) {
	let playerInfo = {
		id: usrInfo.id,
		name: usrInfo.name,
		gender: usrInfo.gender,
		avatarUrl: usrInfo.avatarUrl,
		coins: usrInfo.coins,
		gems: usrInfo.gems,
		chairID: chairID,
		readyState: consts.ReadyState.Ready_No,
		preSid: usrInfo.preSid,
		autoState: consts.AutoState.AutoNo,
		openid: usrInfo.openid
	};
	this.roomInfo.players.push(playerInfo);
};

pro.readyGame = function (uid, next) {
	let roomState = this.roomInfo.status;
	if (roomState == consts.TableStatus.START) {
		utils.invokeCallback(next, null, {code: consts.ReadyGameCode.GAME_STARTED});
	}else {
		utils.invokeCallback(next, null, {code: consts.ReadyGameCode.OK});
		this.setPlayerReadyState(uid, consts.ReadyState.Ready_Yes);
		let readyCount = this.getPlayerReadyCount();
		if (readyCount >= 3) {
			// 游戏开始
			this._startGame();
		} else{
			// 推送准备状态
			let route = 'onReadyGame';
			let msg = {wChairID: this._getChairIDByUid(uid)};
			this._notifyMsgToOtherMem(null, route, msg);
		}
	}
};

// uid 为空设置所有玩家
pro.setPlayerReadyState = function (uid, state) {
	let players = this.roomInfo.players;
	if (uid) {
		let wChairID = this._getChairIDByUid(uid);
		this.roomInfo.players[wChairID].readyState = state;
	} else {
		for (let i = 0; i < players.length; i++) {
			this.roomInfo.players[i].readyState = state;
		}
	}
};

pro.getPlayerReadyCount = function () {
	let players = this.roomInfo.players;
	let count = 0;
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		if (user.readyState === consts.ReadyState.Ready_Yes) {
			count = count + 1;
		}
	}
	return count;
};

// 游戏开始
pro._startGame = function () {
	this.roomInfo.status = consts.TableStatus.START;
	// 洗牌
	let cardData = pdkHelper.RandCardList();

	// 配牌
	// cardData = [
	// 	2, 60, 43, 11, 10, 41, 56, 40, 39, 54, 53, 21, 20, 4, 51,
	// 	45, 29, 44, 28, 12, 59, 27, 26, 57, 9, 6, 37, 52, 36, 35,
	// 	1, 13, 58, 42, 25, 24, 8, 55, 23, 7, 38, 22, 5, 19, 3,
	// ];

	// 发牌、排序
	var handCardData = [];
	var pos = 0
	for (let i = 0; i < 3; i++) {
		let carditem = cardData.slice(pos, pos + consts.MaxCardCount);
		handCardData.push(carditem);
		pos = pos + consts.MaxCardCount;
		pdkHelper.SortCardList(handCardData[i], consts.MaxCardCount);
		this.roomInfo.cardInfo.handCardData[i] = carditem;
		this.roomInfo.cardInfo.cardCount[i] = consts.MaxCardCount;
	}
	this.logger.info('玩家手牌数据:', handCardData);

    // 黑桃3先出
    var banker = this._getBankerUser(handCardData, 3);
    this.roomInfo.cardInfo.currentUser = banker;
	
	// 游戏开始,通知发牌
	for (let i = 0; i < this.roomInfo.players.length; i++) {
		const user = this.roomInfo.players[i];
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
	let cardInfo = this.roomInfo.cardInfo;
	let playerCount = 3;
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
	bCardData = bCardData.slice(0, bCardCount);

	// 是否轮到出牌
	if (wChairID != cardInfo.currentUser) {
		this.logger.warn('wChairID[%d] currentUser[%d] no equiel!',wChairID, cardInfo.currentUser);
		utils.invokeCallback(next, null, {code: consts.PlayCardCode.NO_TURN_OUT_CARD});
		this._broadcastHandCardMsg(wChairID);
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
		this._broadcastHandCardMsg(wChairID);
		return;
	}

	// 出牌排序
	pdkHelper.SortCardList(bCardData, bCardCount);

	// 跟随出牌
	if (cardInfo.turnCardCount != 0 && wChairID != cardInfo.turnUser) {
		if (cardInfo.cardCount[wChairID] != bCardCount) {
			if (pdkHelper.CompareCard(cardInfo.turnCardData,bCardData,cardInfo.turnCardCount,bCardCount)==false) {
				utils.invokeCallback(next, null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
				this._broadcastHandCardMsg(wChairID);
				return;
			}
		} else {
			if (pdkHelper.CompareLastCard(cardInfo.turnCardData,bCardData,cardInfo.turnCardCount,bCardCount)==false)
			{
				utils.invokeCallback(next, null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
				this._broadcastHandCardMsg(wChairID);
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
			this._broadcastHandCardMsg(wChairID);
			return;
		}
	}

	// 删除扑克
	if(pdkHelper.RemoveCard(bCardData,bCardCount,cardInfo.handCardData[wChairID],cardInfo.cardCount[wChairID]) == false)
	{
		utils.invokeCallback(next, null, {code: consts.PlayCardCode.REMOVE_CARD_ERROR});
		this._broadcastHandCardMsg(wChairID);
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
	this._broadcastHandCardMsg(wChairID);

	// 报单消息
	if (cardInfo.cardCount[wChairID]==1) {
		this._broadcastSingCardMsg(wChairID);
	}

	// 出牌消息
	this._broadcastOutCardMsg(wChairID, bCardData, bCardCount, cardInfo.currentUser);

	if (cardInfo.currentUser == consts.InvalUser) {
		// 结算消息
		this.logger.info('赢家: [%d](%s), 出牌:', wChairID, this.roomInfo.players[wChairID].name, bCardData);
		this._broadcastSettlementMsg(wChairID);
		// 重置房间数据
		this._resetRoomData();
	} else {
		this.logger.info('当前:[%d](%s), 出牌:', wChairID, this.roomInfo.players[wChairID].name, bCardData);
		// 要不起自动下一手
		this._checkNextOutCard(wChairID, cardInfo.currentUser);
	}
};

// 重置房间数据
pro._resetRoomData = function () {
	this.roomInfo.status = consts.TableStatus.INIT;
	this.roomInfo.cardInfo.turnCardData = [];
	this.roomInfo.cardInfo.turnCardCount = 0;
	this.roomInfo.cardInfo.turnUser = consts.InvalUser;
	this.roomInfo.cardInfo.bUserWarn = [false, false, false];
	this.setPlayerReadyState(null, consts.ReadyState.Ready_No);
	this._setAutoState(null, consts.AutoState.AutoNo);
};

pro._getChairIDByUid = function (uid) {
	let players = this.roomInfo.players;
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
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

	let cardInfo = this.roomInfo.cardInfo;
	let playerCount = 3;
	let handCardData = cardInfo.handCardData[nextChariID];
	let cardCount = cardInfo.cardCount[nextChariID];
	let turnCardData = cardInfo.turnCardData;
	let turnCardCount = cardInfo.turnCardCount;

	if (pdkHelper.SearchOutCard(handCardData, cardCount, turnCardData, turnCardCount)==false)
	{
		// 要不起
		let wPassUser = nextChariID;
		let currentUser=(wPassUser+1) % playerCount;
		this.roomInfo.cardInfo.currentUser = currentUser;
		this.logger.info('要不起:[%d](%s)',wPassUser, this.roomInfo.players[wPassUser].name);

		// 推送要不起消息
		this._broadcastPassCardMsg(wPassUser, currentUser);

		// 递归
		this._checkNextOutCard(wChairID, currentUser);
	}
};

// 推送玩家手牌消息
pro._broadcastHandCardMsg = function (wChairID) {
	let uid = this._getUidByChairID(wChairID);
	let route = 'onHandCardUser';
	let msg = {
		wChairID: wChairID,
		handCardData: this.roomInfo.cardInfo.handCardData[wChairID] || []
	};
	this._notifyMsgToOtherMem(uid, route, msg);
};

// 推送单张报警消息
pro._broadcastSingCardMsg = function (wChairID) {
	let cardInfo = this.roomInfo.cardInfo;
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
	this._setAutoState(wAutoUser, bAuto);
	if (bAuto == consts.AutoState.AutoYes && wAutoUser == this.roomInfo.cardInfo.currentUser) {
		// 自动出牌
		this.playCard();
	}
};

// uid 为空向队伍里所有人推送, 否则指定uid推送
pro._notifyMsgToOtherMem = function (uid, route, msg) {
	var uids = [];
	for (let i = 0; i < this.roomInfo.players.length; i++) {
		const user = this.roomInfo.players[i];
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

// 设置托管状态
pro._setAutoState = function (wChairID, state) {
	if (wChairID) {
		this.roomInfo.players[wChairID].autoState = state;
	} else {
		for (let i = 0; i < this.roomInfo.players.length; i++) {
			this.roomInfo.players[i].autoState = state;
		}
	}
};

// 得到托管状态
pro._getAutoState = function (wChairID) {
	return this.roomInfo.players[wChairID].autoState;
}

// 托管定时器重置
pro._resetAutoSchedule = function (dt) {
	let self = this;
	dt = dt || 15;  // 默认15s自动托管
	dt = dt + offset;
	self._clearAutoSchedul();
	
	let wChairID = this.roomInfo.cardInfo.currentUser;
	if (wChairID == consts.InvalUser) {
		return;
	}

	// 已经托管不能直接调用playCard，要有延时(TODO:原因以后研究...)
	if (self._getAutoState(wChairID) == consts.AutoState.AutoYes) {
		dt = 1;
	}

	self.autoSchedule = setInterval(function () {
		if (self._getAutoState(wChairID) == consts.AutoState.AutoYes) {
			// 已经托管
			self.playCard();
		} else {
			// 进入托管
			self._broadcastAutoCardMsg(wChairID, consts.AutoState.AutoYes);
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

pro.leaveRoom = function (uid, next) {
	// 房间不存在
	if (this.isDestroyed()) {
		next(null, {code: consts.LeaveRoomCode.NO_EXIST_ROOM});
		return;
	}

	// 已经开局不能退出
	if (this.roomInfo.status === consts.TableStatus.START) {
		next(null, {code: consts.LeaveRoomCode.START_GAME_NO_LEAVE});
		return;
	}

	// 解散房间
	next(null, {code: consts.LeaveRoomCode.LEAVE_ROOM_DISSOLVE});
	this.destroy();
};

// 销毁
pro.destroy = function () {
	this._clearAutoSchedul();

	let gameType = this.roomInfo.gameType;
	let stage = this.roomInfo.stage;
	let goldRoomId = this.roomInfo.roomid;
	let players = this.roomInfo.players;
	pomelo.app.rpc.matchGlobal.matchRemote.dissolveGoldRoom(null, gameType, stage, goldRoomId, null);

	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		let preServerID = user.preSid;
		pomelo.app.rpc.connector.entryRemote.onGoldDissolveGame.toServer(preServerID, user.id, null);
	}
	Entity.prototype.destroy.call(this);
};