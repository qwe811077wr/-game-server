/**
 * Date: 2019/2/16
 * Author: admin
 * Description: 牌桌管理
 */
let pomelo = require('pomelo');
let util = require('util');
let Entity = require('./entity');
let consts = require('../common/consts');
let pdkHelper = require('../helper/pdkHelper');
let messageService = require('../services/messageService');
let utils = require('../util/utils');

let PrivateEntity = function (opts) {
    opts = opts || {};
	Entity.call(this, opts);

	this.preServerID = {}; // 前端服务器ID
	this.roomInfo = {};

	// 房主创房
	this.usrInfo = opts.usrInfo;
	this.roomCfg = opts.roomCfg;
	this.initPdkRoom(opts.preSid, this.usrInfo, this.roomCfg);

	this.autoDissSchedule = null;  // 自动解散房间定时器
};

util.inherits(PrivateEntity, Entity);
module.exports = PrivateEntity;

let pro = PrivateEntity.prototype;

pro.initPdkRoom = function (preSid, usrInfo, roomCfg) {
	this.roomInfo = {
        roomid: this.id,
		creator: usrInfo.id,
		createTime: Math.ceil(Date.now()/1000),
		status: consts.TableStatus.INIT,
		dissolveTime: 0,
		roomCfg: roomCfg,
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
	this.addUserToPlayers(preSid, usrInfo, 0);

	// 同步中心服
	let roomid = this.id;
	let sid = pomelo.app.getServerId();
	pomelo.app.rpc.centerGlobal.centerRemote.addRoomId2Sid(null, roomid, sid, null);
};

// 进入房间返回客户端数据
pro.clientEnterInfo = function (uid) {
	let wChairID = this._getChairIDByUid(uid)
	let roomInfo = utils.clone(this.roomInfo);
	roomInfo.cardInfo.handCardData = roomInfo.cardInfo.handCardData[wChairID];
	return roomInfo;
};

pro.addUserToPlayers = function (preSid, usrInfo, chairID) {
	let playerInfo = {
		id: usrInfo.id,
		name: usrInfo.name,
		gender: usrInfo.gender,
		avatarUrl: usrInfo.avatarUrl,
		coins: usrInfo.coins,
		gems: usrInfo.gems,
		chairID: chairID,
		dissolveState: consts.DissolveState.Diss_Init,
		readyState: consts.ReadyState.Ready_No
	};
	this.roomInfo.players.push(playerInfo);
	this.preServerID[usrInfo.id] = preSid;
};

pro.removeUserInPlayers = function (uid) {
	if (this.roomInfo) {
		let userInfo = this.roomInfo.players;
		for (let i = 0; i < userInfo.length; i++) {
			const user = userInfo[i];
			if (uid == user.id) {
				this.roomInfo.players.splice(i, 1);
				break;
			}
		}
	}
};

pro.checkFullMember = function () {
	if (this.roomInfo) {
		let maxnum = this.roomInfo.roomCfg.playerCount;
		if (this.roomInfo.players.length >= maxnum) {
			return true;
		}
	}
	return false;
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

	if (this.roomInfo.players.length === 1) {
		// 解散房间
		this.destroy();
		next(null, {code: consts.LeaveRoomCode.LEAVE_ROOM_DISSOLVE});
	} else {
		// 离开房间
		this.removeUserInPlayers(uid);
		next(null, {code: consts.LeaveRoomCode.OK});

		// 向其它人广播离开消息
		let route = 'onLeaveRoom';
		let msg = {uid: uid};
		this._notifyMsgToOtherMem(uid, this.roomInfo.players, route, msg);
	}

	// 更新数据库房间ID记录
	let preServerID = this.preServerID[uid];
	pomelo.app.rpc.connector.entryRemote.onLeaveRoom.toServer(preServerID, uid, 0, null);
};

// uid 为空向所有人推, 否则排除uid向其它人推
pro._notifyMsgToOtherMem = function (uid, players, route, msg) {
	var uids = [];
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		if (uid && user.id === uid)
			continue
		let preServerID = this.preServerID[user.id];
		this.logger.info("uid[%s] preSid[%s] msg[%s]", user.id, preServerID, route);
		uids.push({uid: user.id, sid: preServerID});
	}
    if (uids.length) {
        messageService.pushMessageByUids(uids, route, msg);
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

pro.readyGame = function (uid, next) {
	let roomState = this.roomInfo.status;
	if (roomState == consts.TableStatus.START) {
		next(null, {code: consts.ReadyGameCode.GAME_STARTED});
	}else {
		next(null, {code: consts.ReadyGameCode.OK});
		this.setPlayerReadyState(uid, consts.ReadyState.Ready_Yes);
		let readyCount = this.getPlayerReadyCount();
		let playerCount = this.roomInfo.roomCfg.playerCount;
		if (readyCount >= playerCount) {
			// 游戏开始
			this._startGame();
		} else{
			// 推送准备状态
			let route = 'onReadyGame';
			let msg = {wChairID: this._getChairIDByUid(uid)};
			this._notifyMsgToOtherMem(uid, this.roomInfo.players, route, msg);
		}
	}
};

// 游戏开始
pro._startGame = function () {
	this.roomInfo.status = consts.TableStatus.START;

	// 洗牌
	let cardData = pdkHelper.RandCardList();

	// 配牌
	// cardData = [
	// 	0x03,0x13,0x23,0x04,0x14,0x24,0x05,0x15,0x25,0x16,0x06,0x08,0x18,0x28,0x38,
	// 	0x02,0x0B,0x1B,0x2A,0x0A,0x1A,0x09,0x08,0x07,0x06,0x16,0x25,0x05,0x14,0x23,
	// 	0x05,0x15,0x25,0x06,0x16,0x26,0x07,0x17,0x27,0x18,0x39,0x1A,0x1B,0x3C,0x1D
	// ];

	// 发牌、排序
	var handCardData = [];
	var pos = 0
	for (let i = 0; i < this.roomCfg.playerCount; i++) {
		let carditem = cardData.slice(pos, pos + consts.MaxCardCount);
		handCardData.push(carditem);
		pos = pos + consts.MaxCardCount;
		pdkHelper.SortCardList(handCardData[i], consts.MaxCardCount);
		this.roomInfo.cardInfo.handCardData[i] = carditem;
		this.roomInfo.cardInfo.cardCount[i] = consts.MaxCardCount;
	}
	this.logger.info('玩家手牌数据:', handCardData);

	// 庄家
	if (this.roomCfg.playerCount == 2) {
		// 随机
		var banker = Math.floor(Math.random()*10) % 2;
		this.roomInfo.cardInfo.currentUser = banker;
	} else {
		// 黑桃3先出
		var banker = this._getBankerUser(handCardData, 3);
		this.roomInfo.cardInfo.currentUser = banker;
	}

	// 游戏开始,通知发牌
	for (let i = 0; i < this.roomInfo.players.length; i++) {
		const user = this.roomInfo.players[i];
		let preServerID = this.preServerID[user.id];
		let route = 'onStartGame';
		let msg = {
			wCurrentUser: banker,
			cbCardData: handCardData[i],
			wChairID: i
		}
		let uids = [{
			uid: user.id,
			sid: preServerID
		}]
		messageService.pushMessageByUids(uids, route, msg);
		this.logger.info("uid[%s] preSid[%s] msg[%s]", user.id, preServerID, route);
	}
};

pro._setPlayerDissolveState = function (uid, state) {
	let players = this.roomInfo.players;
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		if (user.id === uid) {
			this.roomInfo.players[i].dissolveState = state;
			break;
		}
	}
};

pro._setDissolveRemainTime = function (remainTime) {
	this.roomInfo.dissolveTime = remainTime;
};

pro._getDissolveInfoData = function () {
	let players = this.roomInfo.players;
	let data = [];
	for (let i = 0; i < players.length; i++) {
		const user = players[i];
		let dissData = {};
		dissData.id = user.id;
		dissData.name = user.name;
		dissData.chairID = user.chairID;
		dissData.dissolveState = user.dissolveState;
		data.push(dissData);
	}
	return data;
};

// 自动解散定时器开启
pro._startSchedulTime = function (time) {
	let self = this;
	self._clearSchedulTime();
	self.autoDissSchedule = setInterval(function () {
		time = time - 1;
		self._setDissolveRemainTime(time);
		if (time <= 0) {
			time = 0;
			self._clearSchedulTime();
			// 自动解散
			let players = self.roomInfo.players;
			for (let i = 0; i < players.length; i++) {
				const user = players[i];
				self._setPlayerDissolveState(user.id, consts.DissolveState.Diss_Achive);
			}
			self._broadcastDissolveMsg();
		}
	}, 1000);
};

// 广播解散消息
pro._broadcastDissolveMsg = function () {
	let players = this.roomInfo.players;
	let route = 'onDissolveRoom';
	let msg = {
		dissolveData: this._getDissolveInfoData(),
		autoRemainTime: this.roomInfo.dissolveTime
	}
	self._notifyMsgToOtherMem(null, players, route, msg);
};

// 清理定时器
pro._clearSchedulTime = function () {
	if (this.autoDissSchedule) {
		clearTimeout(this.autoDissSchedule);
		this.autoDissSchedule = null;
		this._setDissolveRemainTime(0);
	}
};

// 解散游戏
pro.dissolveGame = function (uid, dissolveType, next) {
	// 游戏没有开始没有解散操作
	if (this.roomInfo.status !== consts.TableStatus.START) {
		next(null, consts.DissolveCode.GAME_NO_START);
		return;
	}

	let players = this.roomInfo.players;
	if (dissolveType == consts.DissolveState.Diss_Send) {
		//1 发起解散
		for (let i = 0; i < players.length; i++) {
			const user = players[i];
			if (uid == user.id ) {
				this._setPlayerDissolveState(uid, consts.DissolveState.Diss_Send);
			} else{
				this._setPlayerDissolveState(user.id, consts.DissolveState.Diss_Undone);
			}
		}
		this._startSchedulTime(consts.AutoDissolveTime);
	} else if(state == consts.DissolveState.Diss_Agree) {
		//2 同意
		let isDissove = true;
		this._setPlayerDissolveState(uid, consts.DissolveState.Diss_Agree);
		for (let i = 0; i < players.length; i++) {
			const user = players[i];
			if (user.dissolveState == consts.DissolveState.Diss_Undone) {
				isDissove = false;
				break;
			}
		}
		if (isDissove) {
			for (let i = 0; i < players.length; i++) {
				const user = players[i];
				this._setPlayerDissolveState(user.id, consts.DissolveState.Diss_Achive);
			}
			this._clearSchedulTime();
		}
	} else if(state == consts.DissolveState.Diss_Init) {
		//0 拒绝
		for (let i = 0; i < players.length; i++) {
			const user = players[i];
			this._setPlayerDissolveState(user.id, Macro.DissolveState.Diss_Init);
		}
		this._clearSchedulTime();
	} else{
		// 未知情况
		this.logger.warn('dissove state=%d no exist!', state);
		next(null, {code: consts.DissolveCode.FAIL});
		return;
	}
	next(null, {code: consts.DissolveCode.OK});
	this._broadcastDissolveMsg();
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

// 出牌
pro.playCard = function(uid, bCardData, bCardCount, next) {
	let wChairID = this._getChairIDByUid(uid);
	let cardInfo = this.roomInfo.cardInfo;
	let players = this.roomInfo.players;
	let playerCount = this.roomInfo.roomCfg.playerCount;

	// 是否轮到出牌
	if (wChairID != cardInfo.currentUser) {
		this.logger.warn('wChairID[%d] currentUser[%d] no equiel!',wChairID, cardInfo.currentUser);
		next(null, {code: consts.PlayCardCode.NO_TURN_OUT_CARD});
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
		next(null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
		this._broadcastHandCardMsg(uid);
		return;
	}

	// 出牌排序
	pdkHelper.SortCardList(bCardData, bCardCount);

	// 跟随出牌
	if (cardInfo.turnCardCount != 0 && wChairID != cardInfo.turnUser) {
		if (cardInfo.cardCount[wChairID] != bCardCount) {
			if (pdkHelper.CompareCard(cardInfo.turnCardData,bCardData,cardInfo.turnCardCount,bCardCount)==false) {
				next(null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
				this._broadcastHandCardMsg(uid);
				return;
			}
		} else {
			if (pdkHelper.CompareLastCard(cardInfo.turnCardData,bCardData,cardInfo.turnCardCount,bCardCount)==false)
			{
				next(null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
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
			next(null, {code: consts.PlayCardCode.OUT_CARD_TYPE_ERROR});
			this._broadcastHandCardMsg(uid);
			return;
		}
	}

	// 删除扑克
	if(pdkHelper.RemoveCard(bCardData,bCardCount,cardInfo.handCardData[wChairID],cardInfo.cardCount[wChairID]) == false)
	{
		next(null, {code: consts.PlayCardCode.REMOVE_CARD_ERROR});
		this._broadcastHandCardMsg(uid);
		this.logger.error(bCardData,bCardCount,cardInfo.handCardData[wChairID],cardInfo.cardCount[wChairID]);
		return;
	}
	next(null, {code: consts.PlayCardCode.OK});

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

	// 结算
	if (cardInfo.currentUser == consts.InvalUser) {
		this.logger.info('赢家: [%d](%s), 出牌:', wChairID, players[wChairID].name, bCardData);
		this._broadcastSettlementMsg(wChairID);
		// 重置房间数据
		this._resetRoomData();
	} else {
		this.logger.info('当前:[%d](%s), 出牌:', wChairID, players[wChairID].name, bCardData);
		// 要不起自动下一手
		this._checkNextOutCard(wChairID, cardInfo.currentUser);
	}
};

// 推送玩家手牌消息
pro._broadcastHandCardMsg = function (uid) {
	let wChairID = this._getChairIDByUid(uid);
	let cardInfo = this.roomInfo.cardInfo;
	let route = 'onHandCardUser';
	let msg = {
		wChairID: wChairID,
		handCardData: cardInfo.handCardData[wChairID] || []
	};
	let preServerID = this.preServerID[uid];
	var uids = [{uid: uid, sid: preServerID}];
	messageService.pushMessageByUids(uids, route, msg);
};

// 推送单张报警消息
pro._broadcastSingCardMsg = function (wChairID) {
	let cardInfo = this.roomInfo.cardInfo;
	let players = this.roomInfo.players;
	cardInfo.bUserWarn[wChairID] = true;
	let route = 'onWarnUser';
	let msg = {wWarnUser: wChairID};
	this._notifyMsgToOtherMem(null, players, route, msg);
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
	let players = this.roomInfo.players;
	this._notifyMsgToOtherMem(null, players, route, msg);
};

// 推送要不起消息
pro._broadcastPassCardMsg = function (wPassUser, currentUser) {
	let route = 'onPassCard'
	let msg = {
		wPassUser: wPassUser,
		wCurrentUser: currentUser,
	}
	let players = this.roomInfo.players;
	this._notifyMsgToOtherMem(null, players, route, msg);
};

// 推送结算消息
pro._broadcastSettlementMsg = function (wChairID) {
	let route = 'onSettlement'
	let msg = {
		winUser: wChairID,
	}
	let players = this.roomInfo.players;
	this._notifyMsgToOtherMem(null, players, route, msg);
};

// 要不起自动下手
pro._checkNextOutCard = function (wChairID, nextChariID) {
	if (wChairID == nextChariID) {
		return false;
	}

	let cardInfo = this.roomInfo.cardInfo;
	let playerCount = this.roomInfo.roomCfg.playerCount;
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
		let players = this.roomInfo.players;
		this.logger.info('要不起:[%d](%s)',wPassUser, players[wPassUser].name);

		// 推送要不起消息
		this._broadcastPassCardMsg(wPassUser, currentUser);

		// 递归
		this._checkNextOutCard(wChairID, currentUser);
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
};

// 获取庄家[cbCard:这个牌先出]
pro._getBankerUser = function(handCardData, cbCard)
{
	let playerCount = this.roomCfg.playerCount;
	for (let i =0;i < playerCount;i++)
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


// 销毁
pro.destroy = function () {
	pomelo.app.rpc.centerGlobal.centerRemote.removeRoomId2Sid(null, this.id, null);
	this._clearSchedulTime();
	Entity.prototype.destroy.call(this);
};