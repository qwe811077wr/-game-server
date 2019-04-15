/**
 * Date: 2019/4/15
 * Author: admin
 * Description: 金币场统计 [cmd: node goldMatchStatistics.js]
 */
let connectToMaster = require('./gameOperationConnect').connectToMaster;

function goldMatchStatistics(opts) {
    let id = 'pomelo_goldMatch_statistics_' + Date.now();
    connectToMaster(id, opts, function (client) {
        client.request('gameOperation', {signal: 'goldMatch'}, function (err, msg) {
            if (err) {
                console.error(err);
            }
            else {
				let info = msg.body
				console.log('金币场房间统计：')
				for (const key in info) {
					let matchInfo = info[key].matchInfo;
					for (const id in matchInfo) {
						let array = matchInfo[id];
						for (let i = 0; i < array.length; i++) {
							const stages = array[i];
							let realnum = 0;
							let robotnum = 0;
							for (const roomid in stages) {
								let roomInfo = stages[roomid];
								let num1 = 0;
								let num2 = 0;
								for (const k in roomInfo.players) {
									if (isRobot(roomInfo.players[k].openid)) {
										num1 = num1 + 1;
									}
								}
								num2 = Object.keys(roomInfo.players).length - num1;
								realnum = realnum + num2;
								robotnum = robotnum + num1;
							}
							let roomnum = Object.keys(stages).length;
							console.log(id + '-' + i + ' roomnum = ' + roomnum + ' realnum = ' + realnum + ' robotnum = ' + robotnum);
						}
					}
				}

				console.log('机器人列表人数统计：');
				for (const key in info) {
					let robotList = info[key].robotList;
					for (const id in robotList) {
						let array = robotList[id];
						for (let i = 0; i < array.length; i++) {
							const stages = array[i];
							console.log(id + '-' + i + ' count = ' + stages.length);
						}
					}
				}
			}
            process.exit(0);
        })
    });
};

var isRobot = function (openid) {
	if (openid.indexOf("robot_") != -1) {
		return true;
	}
	return false;
};

let arguments = process.argv.splice(2);
let opts = {
    username: arguments[0],
    password: arguments[1],
    host: arguments[2],
    port: arguments[3],
};

goldMatchStatistics(opts);
