/**
 * Date:  2019/2/11
 * Author: admin
 * Description: avatar属性定义
 */
let persistProperties = {
    openid: "",  // 微信openid
    uid: 0,  // 角色数字id
    name: "unknow",  // 名字
    gender: 0,  // 性别：0：未知 1：男性 2：女性
    avatarUrl: "",  // 用户头像图片的 URL
    coins: 100000,  // 金币
	gems: 0,  // 元宝
	roomid: 0, //房间ID
    goldRoomId: "0", // 金币场房间ID
	lastOfflineTime: 0,  //上次下线时间
	winCount: 0, //赢的次数
	failCount: 0, //输的次数
};

module.exports = {
    persistProperties: persistProperties
};
