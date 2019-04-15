/**
 * Date: 2019/4/14
 * Author: admin
 * Description: 在线玩家 [cmd: node onlineAvatar]
 */
let connectToMaster = require('./gameOperationConnect').connectToMaster;

function onlineAvatar(opts) {
    let id = 'pomelo_online_avatar_' + Date.now();
    connectToMaster(id, opts, function (client) {
        client.request('onlineUser', null, function (err, msg) {
            if (err) {
                console.error(err);
            }
            else {
                let totalConnCount = 0, loginedCount = 0, list = [];
                var msg2 = msg.body;
                for(var sid in msg2) {
                    totalConnCount += msg2[sid].totalConnCount;
                    loginedCount += msg2[sid].loginedCount;
                    var lists = msg2[sid].loginedList;
                    for(var i=0;i<lists.length;i++){
                        list.push({
                            address : lists[i].address,
                            serverId : sid,
                            username : lists[i].username,
                            loginTime : new Date(parseInt(lists[i].loginTime)).toLocaleString().replace(/年|月/g, "-").replace(/日/g, " "),
                            uid : lists[i].uid
                        });
                    }
                }	
                
                console.log(list);
                console.log('totalConnCount = ', totalConnCount);
                console.log('onlineCount = ', loginedCount);
            }
            process.exit(0);
        })
    });
};

let arguments = process.argv.splice(2);
let opts = {
    username: arguments[0],
    password: arguments[1],
    host: arguments[2],
    port: arguments[3],
};

onlineAvatar(opts);
