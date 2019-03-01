/**
 * Date: 2019/2/18
 * Author: admin
 * Description:
 */
var logger = require('pomelo-logger').getLogger('game', 'centerStub');

var instance = null;

module.exports = function (app) {
    if (instance) {
        return instance;
    }
    return instance = new CenterStub(app);
};

var CenterStub = function (app) {
    this.app = app;
    this.roomid2sid = {};
};

var pro  = CenterStub.prototype;

pro.addRoomId2Sid = function (roomid, sid, cb) {
    logger.info("roomid[%s] sid[%s] add.", roomid, sid);
	this.roomid2sid[roomid] = sid;
	cb();
};

pro.getRoomId2Sid = function (roomid, cb) {
	let sid = this.roomid2sid[roomid];
	logger.info("roomid[%s] sid[%s] get.", roomid, sid);
	cb(sid);
};

pro.getRoomId2SidEx = function (recordid, roomid, cb) {
	let sid = this.roomid2sid[recordid];
	if (!sid) {
		sid = this.roomid2sid[roomid];
		logger.info("roomid[%s] sid[%s] getex.", roomid, sid);
	} else {
		roomid = recordid;
		logger.info("recordid[%s] sid[%s] getex.", recordid, sid);
	}
	cb(roomid, sid);
};

pro.removeRoomId2Sid = function (roomid, cb) {
	logger.info("roomid[%s] remove.", roomid);
	delete this.roomid2sid[roomid];
	cb();
};
