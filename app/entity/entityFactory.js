/**
 * Date: 2019/2/11
 * Author: admin
 * Description:
 */
var Avatar = require("./avatar")
var PrivateEntity = require("./privateEntity");
var GoldEntity = require("./goldEntity");

var entityClasses = {
	Avatar: Avatar,
    PrivateEntity: PrivateEntity,
    GoldEntity: GoldEntity,
}

var entityFactory = module.exports;

entityFactory.createEntity = function (entityType, entityid, entitycontent) {
    entitycontent = entitycontent || {}
    if (entityid)
        entitycontent["_id"] = entityid;
    var entityCreator = entityClasses[entityType];
    return new entityCreator(entitycontent);
};
