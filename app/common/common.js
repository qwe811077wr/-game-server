var com = module.exports;

// 是否是机器人
com.isRobot = function (openid) {
	if (openid.indexOf("robot_") != -1) {
		return true;
	}
	return false;
};

// 生成n位长度的随机数字id
com.generateRandom = function(n) { 
	n = n || 8;
    var str = "0123456789";
    var result = "";
    for(var i = 0; i < n; i++) {
		result += str[parseInt(Math.random() * str.length)];
		if (i == 0 && result == '0') {
			let tmp = '123456789'
			result = tmp[parseInt(Math.random() * tmp.length)]
		}
    }
    return Number(result);
}