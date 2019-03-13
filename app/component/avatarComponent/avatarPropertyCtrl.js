/**
 * Date: 2019/2/11
 * Author: admin
 * Description:
 */
let util = require('util');
let Component = _require('../component');
let avatarProperty = _require('./avatarProperty');
let consts = _require('../../common/consts');

let AvatarPropertyCtrl = function (entity) {
    Component.call(this, entity);
};

util.inherits(AvatarPropertyCtrl, Component);
module.exports = AvatarPropertyCtrl;

let pro = AvatarPropertyCtrl.prototype;

pro.init = function (opts) {
    this._initPersistProperties(opts);
    this._dirtyProp = {};
};

pro._initPersistProperties = function (opts) {
    let persistProperties = avatarProperty.persistProperties;
    let entity = this.entity;
    for (let key in persistProperties) {
        if (key in opts && opts[key] !== undefined) {
            entity[key] = opts[key];
        }
        else {
            entity[key] = persistProperties[key];
        }
    }
};

pro.getPersistProp = function () {
    let persistProperties = avatarProperty.persistProperties;
    let props = {};
    for (let key in persistProperties) {
        props[key] = this.entity[key];
    }
    return props;
};
