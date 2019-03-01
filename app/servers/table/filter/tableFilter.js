/**
 * Date: 2019/2/18
 * Author: admin
 * Description:
 */
var entityManager = require('../../../services/entityManager');

module.exports = function() {
    return new Filter();
};

var Filter = function() {
};

/**
 * table filter
 */
Filter.prototype.before = function(msg, session, next){
    var tableEntity = entityManager.getEntity(session.get('tableID'));
    if (!tableEntity) {
        next(new Error('No tableEntity exist!'));
        return;
    }
    session.tableEntity = tableEntity;

    next();
};