var mongoose = require('mongoose'),
    Schema = mongoose.Schema;

var AvatarSchema = new Schema({
    _id: String,
    openid: String,
    uid: Number,
    name: String,
    gender: Number,
    avatarUrl: String,
    coins: Number,
    gems: Number,
	roomid: Number,
	goldRoomId: String,
});

AvatarSchema.set('toObject', { getters: true });

module.exports = AvatarSchema;