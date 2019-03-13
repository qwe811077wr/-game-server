/**
 * Date: 2019/3/13
 * Author: admin
 * Description: 常用的运维操作放到这里
 */
let countDownLatch = require('../../node_modules/pomelo/lib/util/countDownLatch');
let utils = require('../../node_modules/pomelo/lib/util/utils');
let Constants = require('../../node_modules/pomelo/lib/util/constants');
let logger = require('pomelo-logger').getLogger('game', __filename);
let entityMgr = require('../services/entityManager');

module.exports = function (opts) {
    return new Module(opts);
};

module.exports.moduleId = 'gameOperation';

let Module = function (opts) {
    opts = opts || {};
    this.app = opts.app;
};

Module.prototype.monitorHandler = function (agnet, msg, cb) {
    let app = this.app;
    switch (msg.signal) {
        case 'updateLogin':
            if (msg.canLogin) {
                app.set('canLogin', true);
            }
            else {
                app.set('canLogin', false);
            }
            logger.info('set canLogin ' + msg.canLogin);
            utils.invokeCallback(cb, null);
            break;
        case 'kick':
            let member = msg.member, reason = msg.reason;
            if (member === 'all') {
                let entities = entityMgr.getAllEntities();
                for (let id in entities) {
                    entities[id].kickOffline(reason);
                }
            }
            else {
                let entity = entityMgr.getEntity(member);
                if (entity) {
                    entity.kickOffline(reason);
                }
            }
            utils.invokeCallback(cb, null);
            break;
        default:
            logger.error('receive error signal: %j', msg);
    }
};

Module.prototype.clientHandler = function (agent, msg, cb) {
    let app = this.app;
    logger.info('game operation, msg: %o', msg);
    switch (msg.signal) {
        case 'updateLogin':
            updateLogin(app, agent, msg, cb);
            break;
        case 'kick':
            kick(app, agent, msg, cb);
            break;
        default:
            logger.error('game operation unknow signal: ' + msg.signal);
            utils.invokeCallback(cb, new Error('The command cannot be recognized, please check.'), null);
    }
};

var updateLogin = function (app, agent, msg, cb) {
    let connectorServers = app.getServersByType('connector');
    let gateServers = app.getServersByType('gate');
    let count = connectorServers.length + gateServers.length;
    let latch = countDownLatch.createCountDownLatch(count, {timeout: Constants.TIME.TIME_WAIT_COUNTDOWN}, function() {
        utils.invokeCallback(cb, null);
    });
    let callback = function() {
        latch.done();
    };
    for(let sid in connectorServers) {
        let record = connectorServers[sid];
        agent.request(record.id, module.exports.moduleId, msg, callback);
    }
    for(let sid in gateServers) {
        let record = gateServers[sid];
        agent.request(record.id, module.exports.moduleId, msg, callback);
    }
};

var kick = function (app, agent, msg, cb) {
    let connectorServers = app.getServersByType('connector');
    let count = connectorServers.length;
    let latch = countDownLatch.createCountDownLatch(count, {timeout: Constants.TIME.TIME_WAIT_COUNTDOWN}, function() {
        utils.invokeCallback(cb, null);
    });
    let callback = function() {
        latch.done();
    };
    for(let sid in connectorServers) {
        let record = connectorServers[sid];
        agent.request(record.id, module.exports.moduleId, msg, callback);
    }
};
