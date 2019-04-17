/**
 * Date: 2019/4/17
 * Author: admin
 * Description: 解散房间 [node dissolveRoom.js roomid]
 */
let connectToMaster = require('./gameOperationConnect').connectToMaster;

function dissolveRoom(opts) {
    let id = 'pomelo_dissolve_room_' + Date.now();
    connectToMaster(id, opts, function (client) {
        client.request('gameOperation', {signal: 'dissolve', roomId: opts.roomId},
            function (err) {
                if (err) {
                    console.error(err);
                }
                else {
                    console.info("dissolveRoom finish");
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
    roomId: arguments[0],
    username: arguments[1],
    password: arguments[2],
    host: arguments[3],
    port: arguments[4],
};

dissolveRoom(opts);
