var consts = require('../../../common/consts');
var fly = require('flyio');
var logger = require('pomelo-logger').getLogger('game', __filename);
var entityManager = _require('../../../services/entityManager');
var entityFactory = _require('../../../entity/entityFactory');

module.exports = function (app) {
    return new Handler(app);
};

var Handler = function (app) {
    this.app = app;
};

var handler = Handler.prototype;

/**
 * New client entry chat server.
 *
 * @param  {Object}   msg     request message
 * @param  {Object}   session current session object
 * @param  {Function} next    next stemp callback
 * @return {Void}
 */
handler.enter = function (msg, session, next) {
    // 维护中，禁止登录
    if (!this.app.get('canLogin')) {
        next(null, {code: consts.Login.MAINTAIN});
        return;
	}
	
    // 微信login获取的code
    let code = msg.code, userInfo = msg.userInfo, platform = msg.platform;
    if (!code) {
        next(null, {code: consts.Login.FAIL});
        return;
	}
	
    // 微信
    if (platform === consts.Platform.WECHAT) {
        doWxLogin(this.app, session, next, code, userInfo);
    }
    else {
        // code作为openid直接登录
        doLogin(this.app, session, next, code, "", code, userInfo);
    }
};

var doWxLogin = function (app, session, next, code, userInfo) {
    let url = 'https://api.weixin.qq.com/sns/jscode2session?appid=' + consts.APP_ID +
        '&secret=' + consts.APP_SECRET + '&js_code=' + code + '&grant_type=authorization_code'
    fly.get(url).then(
        function (response) {
            if (response.status != 200) {
                next(null, {code: consts.Login.FAIL});
                logger.error("get openid connect failed.");
                return;
            }
            let data = JSON.parse(response.data);
            if (data.errcode) {
                logger.error("get openid error.%o", data);
                next(null, {code: consts.Login.FAIL});
                return;
            }
            let openid = data["openid"],
                session_key = data["session_key"];
            console.log("xxxxxxxxxaa", openid, session_key)

            doLogin(app, session, next, openid, session_key, code, userInfo);
        }
    ).catch(function (error) {
        logger.error(error);
    })
};

var doLogin = function (app, session, next, openid, session_key, code, userInfo) {
    // 查db
    app.db.find("Avatar", {"openid": openid}, ["_id"], null, function (err, docs) {
        if (err) {
            logger.error("db find avatar error" + err);
            next(null, {code: consts.Login.FAIL});
            return;
        }
        let uuid = null;
        if (docs.length == 0) {
            uuid = app.db.genId();
        } else {
            uuid = docs[0]["_id"];
        }
        app.rpc.auth.authRemote.checkin(null, openid, uuid, app.get('serverId'),
            function (result, formerSid, formerUid) {
                // 已经登录，走顶号流程
                if (result == consts.CheckInResult.ALREADY_ONLINE) {
                    if (formerUid !== uuid) {
                        // 事件大了！！！
                        logger.error("same account with different uuid, openid[%s] formerUid[%s] newUid[%s]", openid, formerUid, uuid);
                        next(null, {code: consts.Login.FAIL});
                        return;
                    }
                    if (formerSid == app.get('serverId')) {
                        var avatar = entityManager.getEntity(formerUid);
                        if (!avatar) {
                            readyLogin(app, session, uuid, openid, session_key, userInfo, next, false);
                        }
                        else {
                            // 刷新session_key和userInfo
                            avatar.session_key = session_key;
                            avatar.updateUserInfo(userInfo);
                            avatar.reconnect();  // 重连上了
                            app.get('sessionService').kick(formerUid, "relay");
                            session.bind(avatar.id);
                            session.on('closed', onAvatarLeave.bind(null, app));
                            // 重新设置session setting
                            avatar.importSessionSetting();
                            next(null, {
                                code: consts.Login.OK,
                                info: avatar.clientLoginInfo()
                            });
                            avatar.emit("EventReconnect", avatar);  //通知服务器内部监听重连消息
                        }
                    }
                    else {
                        // 不在同一个进程，告诉客户端重连
                        var conector = null;
                        var connectors = app.getServersByType('connector');
                        for (var i in connectors) {
                            if (connectors[i].id === formerSid)
                                conector = connectors[i];
                        }
                        next(null, {
                            code: consts.Login.RELAY,
                            uuid: code,
                            host: conector.clientHost,
                            port: conector.clientPort
                        });
                    }
                }
                else {
                    readyLogin(app, session, uuid, openid, session_key, userInfo, next, false);
                }
            });
    });
};

var readyLogin = function (app, session, uuid, openid, session_key, userInfo, next, bRelay) {
    // 查db
    app.db.find("Avatar", {"_id": uuid}, null, null, function (err, docs) {
        if (err) {
            logger.error("db find avatar error" + err);
            next(null, {code: consts.Login.FAIL});
            return;
        }
        if (docs.length == 0) {
            // 新建号
            var avatar = entityFactory.createEntity("Avatar", uuid, {
                openid: openid,
                session_key: session_key,
            })
            
            avatar.save();  // 主动存盘一次
            logger.info("create new avatar id: " + avatar.id);
        } else {
            // 登录成功
            docs[0].openid = openid;
            docs[0].session_key = session_key;
            var avatar = entityFactory.createEntity("Avatar", null, docs[0]);
            logger.info("avatar login success. id: " + avatar.id);
        }
        avatar.updateUserInfo(userInfo, true);
        var sessionService = app.get('sessionService');
        sessionService.kick(avatar.id, 'relay');
        session.bind(avatar.id);
        session.on('closed', onAvatarLeave.bind(null, app));
        next(null, {
            code: consts.Login.OK,
            info: avatar.clientLoginInfo()
        });
        if (bRelay) {
            app.rpc.auth.authRemote.relayCheckin(null, openid, uuid, app.get('serverId'), null);
        }
    })
};

/**
 * User log out handler
 *
 * @param {Object} app current application
 * @param {Object} session current session object
 *
 */
var onAvatarLeave = function (app, session, reason) {
    if (!session || !session.uid) {
        return;
    }
    if (reason == "relay") {
        // 顶号
        console.log("xxxxxxxxxxxxxxx", "onAvatarLeave relay")
        return;
    }
    var avtID = session.uid;
    var avatar = entityManager.getEntity(avtID);
    console.log("avatarLeave: " + session.uid);
    avatar.disconnect();
};
