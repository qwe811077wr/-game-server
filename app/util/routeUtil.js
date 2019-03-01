/**
 * Date: 2019/2/18
 * Author: admin
 * Description: 路由控制
 */

var exp = module.exports

exp.table = function (session, msg, app, cb) {
    var serverId = session.get('tableServer');

    if(!serverId) {
        cb(new Error('can not find server info for type: ' + msg.serverType));
        return;
    }

    cb(null, serverId);
};
