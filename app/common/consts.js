/**
 * Date: 2019/2/11
 * Author: admin
 * Description: 常量文件
 */
module.exports = {
	APP_ID: "wx6e08467553158527",
    APP_SECRET: "4c5ce70f86af49bd8eba1901ff1adc62",

	ENABLE_GM: true,
	
	// entity state
    ENTITY_STATE_INITED: 1,
	ENTITY_STATE_DESTROYED: 2,
	
	// 平台
    Platform: {
        WIN: "win",
        WECHAT: "wechat",
	},

	AutoDissolveTime: 60,  //自动解散时间
	InvalUser: 65535, 	   //无效用户
	Pdk15StageCount: 3,    // 跑得快15阶梯数量
	Pdk16StageCount: 3,    // 跑得快16阶梯数量
	
/* *************************  code begin  ************************* */

    Code: {
        OK: 0,
        FAIL: 1
    },

    Login: {
        OK: 200,  		// 成功
        RELAY: 201,     // 重新登入
        MAINTAIN: 202,  // 维护
        FAIL: 500       // 失败
    },

    CheckInResult: {
        SUCCESS: 0,  		// 成功
        ALREADY_ONLINE: 1,  // 已经在线
	},

	// 创房,加房
    RoomCode: {
        OK: 0,
		NO_EXIST_ROOM: 1, //房间不存在
		FULL_PLAYER_ROOM: 2, //房间人数已满
		GAME_TYPE_INVALID: 3, //游戏类型不存在
	},

	// 牌桌状态
    TableStatus: {
		INIT: 0,    //创建牌桌,准备界面
		START: 1,   //游戏开始
	},
	
	// 离开房间
	LeaveRoomCode: {
		OK: 0,
		NO_EXIST_ROOM: 1,   //房间不存在
		START_GAME_NO_LEAVE: 2, //游戏已经开始不能离开牌桌
		LEAVE_ROOM_DISSOLVE: 3, //房间只有一个人离开,房间解散
	},

	// 准备
	ReadyGameCode: {
		OK: 0,
		GAME_STARTED: 1,    //游戏已经开始  
		COINS_LESS: 2,      //玩家金币不足
	},

	ReadyState: {
		Ready_No: 0,    	//没有准备
		Ready_Yes: 1,  		//已经准备
	},

	AutoState: {
		AutoNo: 0,    // 没有托管
		AutoYes: 1,   // 已经托管
	},

	// 解散状态
	DissolveState: {
		Diss_Init: 0,      	//初始状态(或拒绝)
		Diss_Send: 1, 		//发起方
		Diss_Agree: 2, 		//同意
		Diss_Undone: 3,  	//未处理
		Diss_Achive: 4,     //解散成功
	},

	// 解散游戏code
	DissolveCode: {
		OK: 0,
		FAIL: 1,   // 客户端数据异常
		GAME_NO_START: 2,   //游戏没有开始没有解散操作
	},

	PlayCardCode: {
		OK: 0,
		NO_TURN_OUT_CARD: 1, //没有轮到自己出牌
		OUT_CARD_TYPE_ERROR: 2, //出牌类型错误
		REMOVE_CARD_ERROR: 3, //删除出牌错误
	},

	// 金币场code
	MatchCode: {
		OK: 0,
		GAEM_TYPE_INVALID: 1,  // 游戏类型不存在
		EXIST_IN_GAME: 2, 	//已经在游戏中了
		STAGE_COINS_LOW: 3, //阶梯金币数量不满足
	},

	// 游戏类型
	GameType: {
		PDK_15: 1,  // 跑得快15张
		PDK_16: 2,  // 跑得快16张
	}
}