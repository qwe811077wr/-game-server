var reload = require('./app/util/require');
var pomelo = require('pomelo');
let fs = require('fs'), path = require('path');

var mongodb = require("./app/mongodb/mongodb");
var routeUtil = require('./app/util/routeUtil');
var CenterStub = require('./app/services/centerStub');
var RollStub = require('./app/services/rollStub');
var MatchStub = require('./app/services/matchStub');

let avatarFilter = require('./app/servers/connector/filter/avatarFilter');
let tableFilter = require('./app/servers/table/filter/tableFilter');

/**
 * Init app for client.
 */
var app = pomelo.createApp();
app.set('name', 'kzyx');
app.set('reload', reload, true);

var initDB = function (app) {
    app.loadConfig('mongodb', app.getBase() + '/config/mongodb.json');
    var db = mongodb(app);
    db.init();
    app.set('db', db, true);
};

// app configuration
app.configure('production|development', 'connector', function () {
    app.set('canLogin', true);
    app.before(avatarFilter());
    let curFilePath = path.resolve(__dirname);
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            heartbeat: 10,
            useDict: true,
            // ssl: {
            //     type: 'wss',
            //     key: fs.readFileSync(curFilePath + '/keys/server.key'),
            //     cert: fs.readFileSync(curFilePath + '/keys/server.crt')
            // },
            useProtobuf: true,
            handshake: function (msg, cb) {
                cb(null, {});
            }
        });
});

app.configure('production|development', 'gate', function () {
    app.set('canLogin', true);
    let curFilePath = path.resolve(__dirname);
    app.set('connectorConfig',
        {
            connector: pomelo.connectors.hybridconnector,
            useDict: true,
            // ssl: {
            //     type: 'wss',
            //     key: fs.readFileSync(curFilePath + '/keys/server.key'),
            //     cert: fs.readFileSync(curFilePath + '/keys/server.crt')
            // },
            useProtobuf: true,
        });
});

app.configure('production|development', function () {
	app.enable('systemMonitor');
    if (typeof app.registerAdmin === 'function') {
        let onlineUser = require('./app/modules/onlineUser');
        app.registerAdmin(onlineUser, {app: app});
        let gameOperation = require('./app/modules/gameOperation');
        app.registerAdmin(gameOperation, {app: app});
    }
	
	app.route('table', routeUtil.table);
	initDB(app);
    // message缓冲
	app.set('pushSchedulerConfig', {scheduler: pomelo.pushSchedulers.buffer, flushInterval: 20});
	
	// handler 热更新开关
    app.set('serverConfig',
	{
		reloadHandlers: false
	});

    // remote 热更新开关
    app.set('remoteConfig',
	{
		reloadRemotes: false
	});
});

app.configure('production|development', 'auth', function () {
    app.set('rollStub', RollStub(app));
});

app.configure('production|development', 'centerGlobal', function () {
	app.set('centerStub', CenterStub(app));
});

app.configure('production|development', 'matchGlobal', function () {
	app.set('matchStub', MatchStub(app));
});

app.configure('production|development', 'table', function () {
    app.before(tableFilter());
});

// start app
app.start();

process.on('uncaughtException', function (err) {
  console.error(' Caught exception: ' + err.stack);
});
