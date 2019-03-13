/**
 * Date: 2019/2/11
 * Author: admin
 * Description: 负责component注册
 */
var LoggerComponent = _require('./entityComponent/loggerComponent');
let AvatarPropertyCtrl = _require('./avatarComponent/avatarPropertyCtrl');
let LobbyComponent = _require('./avatarComponent/lobbyComponent');
let MatchComponent = _require('./avatarComponent/matchComponent');

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
