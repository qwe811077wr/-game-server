/**
 * Date: 2019/2/16
 * Author: admin
 * Description:
 */
let pomelo = require('pomelo');
var entityManager = require('../../../services/entityManager');
var logger = require('pomelo-logger').getLogger('game', __filename);
var consts = require('../../../common/consts');

module.exports = function(app) {
    return new Remote(app);
};

var Remote = function(app) {
    this.app = app;
};

var pro = Remote.prototype;

// 全服广播入口
pro.onGlobalMessage = function (route, msg, cb) {
    let avatars = entityManager.getEntitiesByClass('Avatar');
    let funcPres = route.split('.');
    // todo: 考虑分段处理
    for (let avatar of avatars) {
        let func = avatar, env = avatar, len = funcPres.length;
        for (let i = 0; i < len; i++) {
            func = func[funcPres[i]];
            if (i !== len - 1) {
                env = func;
            }
        }
        func.call(env, msg);
    }
    cb();
};

// 离开房间
pro.onLeaveRoom = function (avtID, roomID, cb) {
    var avatar = entityManager.getEntity(avtID);
    avatar.updateUserRoomId(roomID);
    avatar.removeSessionSetting("tableServer", true);
    cb();
};

// 进入金币场
pro.onEnterGoldGame = function (avtID, tableID, toServerID, cb) {
    logger.info('avtID[%s] tableID[%s] toServerID[%s] onEnterGoldGame.', avtID, tableID, toServerID);
    var avatar = entityManager.getEntity(avtID);
    avatar.updateUserGoldRoomid(tableID);
    avatar.setSessionSetting("tableID", tableID);
    avatar.setSessionSetting("tableServer", toServerID);
    avatar.importSessionSetting();
    cb();
};

// 金币场解散房间
pro.onGoldDissolveGame = function (avtID, cb) {
    var avatar = entityManager.getEntity(avtID);
    avatar.updateUserGoldRoomid(0);
	var sessionService = pomelo.app.get('sessionService');
    var sessions = sessionService.getByUid(avatar.id);
    if (sessions && sessions.length > 0) {
		avatar.removeSessionSetting("tableServer", true);
	}
    cb();
};