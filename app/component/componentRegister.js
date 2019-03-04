/**
 * Date: 2019/2/11
 * Author: admin
 * Description: 负责component注册
 */
var LoggerComponent = require('./entityComponent/loggerComponent');
let AvatarPropertyCtrl = require('./avatarComponent/avatarPropertyCtrl');
let LobbyComponent = require('./avatarComponent/lobbyComponent');
let MatchComponent = require('./avatarComponent/matchComponent');

var componentClass = {
	logger: LoggerComponent,
	avatarProp: AvatarPropertyCtrl,
	lobby: LobbyComponent,
	match: MatchComponent,
};

var componentRegister = module.exports;

componentRegister.getComponent = function (name) {
    return componentClass[name];
};
