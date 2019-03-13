/**
 * Date: 2019/3/13
 * Author: admin
 * Description: 踢下线
 */
let connectToMaster = require('./gameOperationConnect').connectToMaster;

function kickAvatar(opts) {
    let id = 'pomelo_kick_avatar_' + Date.now();
    connectToMaster(id, opts, function (client) {
        client.request('gameOperation', {signal: 'kick', member: opts.member, reason: opts.reason},
            function (err) {
                if (err) {
                    console.error(err);
                }
                else {
                    console.info("kick finish");
                }
                process.exit(0);
            })
    });
};

let arguments = process.argv.splice(2);
if (arguments.length === 0) {
    console.log('argument not enough');
    process.exit(1);
}
let opts = {
    member: arguments[0],
    reason: arguments[1],
    username: arguments[2],
    password: arguments[3],
    host: arguments[4],
    port: arguments[5],
};

kickAvatar(opts);
