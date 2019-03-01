/**
 * Date: 2019/2/18
 * Author: admin
 * Description: 中心服务器,限制只开一台,管理全局数据
 */

module.exports = function (app) {
	return new Remote(app);
};

var Remote = function (app) {
	this.app = app;
};

var pro = Remote.prototype;

pro.addRoomId2Sid = function (roomid, sid, cb) {
	this.app.get('centerStub').addRoomId2Sid(roomid, sid, cb);
};

pro.getRoomId2Sid = function (roomid, cb) {
	this.app.get('centerStub').getRoomId2Sid(roomid, cb);
};

pro.getRoomId2SidEx = function (recordid, roomid, cb) {
	this.app.get('centerStub').getRoomId2SidEx(recordid, roomid, cb);
};

pro.removeRoomId2Sid = function (roomid, cb) {
	this.app.get('centerStub').removeRoomId2Sid(roomid, cb);
};