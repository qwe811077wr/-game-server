
var pdkHelper = require('../helper/pdkHelper');
var pro = module.exports;

//扑克类型
let CT_ERROR					= 0									//错误类型
let CT_SINGLE					= 1									//单牌类型
let CT_DOUBLE					= 2									//对牌类型
let CT_SINGLE_LINE				= 3									//单连类型
let CT_DOUBLE_LINE				= 4									//对连类型
let CT_THREE_LINE				= 5									//三连类型
let CT_THREE_LINE_TAKE_TWO		= 6									//三带两单
let CT_FOUR_LINE_TAKE_THREE		= 7									//四带三单
let CT_BOMB_CARD				= 8									//炸弹类型

/**
 * 自动出牌AI.
 *
 * @param {Array} handCardData 玩家手牌
 * @param {Array} turnCardData 上回合出的牌
 * @param {Bool} bNextWarn 下家是否报警
 * @return {Object} OutCard 返回提取要出的牌
 *
 */
pro.AISearchOutCard = function(handCardData, turnCardData, bNextWarn){
	handCardData = handCardData || [];
	turnCardData = turnCardData || [];
	let handCardCount = handCardData.length;
	let turnCardCount = turnCardData.length;
	pdkHelper.SortCardList(handCardData,handCardCount);
	if (turnCardCount==0)
	{
		let OutCard = {
			bCardCount: 0,		//出牌数目
			bCardData: [],		//扑克列表
			wOutCardUser: 0,  	//出牌玩家
		};
		let IScanOut = false;
		let TempTurnCard = [], TempTurnCount;
		let OutCardResult = {
			cbCardCount: 0,		//扑克数目
			cbResultCard: []	//结果扑克
		};
		let AnalyseResult = pdkHelper.AnalysebCardData(handCardData,handCardCount);
		
		//两手出牌，有 2 先出 2
		if (pdkHelper.GetCardLogicValue(handCardData[0])==15
			&&pdkHelper.GetCardType(handCardData,handCardCount)==CT_ERROR
			&&handCardCount>1)
		{
			let cbLeftCardData = handCardData.slice(1, handCardData.length);
			if (pdkHelper.GetCardType(cbLeftCardData,handCardCount-1)!=CT_ERROR)
			{
				OutCard.bCardData[0]=handCardData[0];
				OutCard.bCardCount = 1;
				IScanOut =  true;
			}
		}
		//最后三张牌，带2，所以出中间一个牌
		if (pdkHelper.GetCardLogicValue(handCardData[0])==15 && handCardCount==3 && bNextWarn == false)
		{
			OutCard.bCardData[0]=handCardData[1];
			OutCard.bCardCount = 1;
			IScanOut =  true;
		}
		if(IScanOut==false)  //********单顺****************
		{
			//////**********************2011年6月7日 17:52:13*******************************////
			//分析扑克
			let SigneHand = [], SigneCount=0, bombVlue=0;
			if(AnalyseResult.cbFourCount>0) bombVlue = pdkHelper.GetCardLogicValue(AnalyseResult.cbFourCardData[0]);
			//搜索连牌
			for (let i=handCardCount-1;i>=5;i--)
			{
				//获取数值
				let cbHandLogicValue=pdkHelper.GetCardLogicValue(handCardData[i]);
				//构造判断
				if (cbHandLogicValue>10)break;
				if(IScanOut==true)break;
				//搜索连牌
				let cbLineCount=0;
				for (let j=i;j>=0;j--)
				{
					if ((pdkHelper.GetCardLogicValue(handCardData[j])-cbLineCount) ==cbHandLogicValue
						&&bombVlue!=pdkHelper.GetCardLogicValue(handCardData[j])
						&&pdkHelper.GetCardLogicValue(handCardData[j])<15) //不能拆炸弹
					{
						//增加连数
						SigneHand[cbLineCount++]=handCardData[j];
					}
				}
				if (cbLineCount>=5) //完成判断
				{
					OutCard.bCardData = SigneHand.slice(0);
					OutCard.bCardCount = cbLineCount;
					IScanOut = true;
				}
			}
			/////********************************************************************/////
		}
		///// 333 带 2
		if(AnalyseResult.cbThreeCount>0&&handCardCount>=5&&IScanOut==false)
		{
			if(pdkHelper.GetCardLogicValue(AnalyseResult.cbThreeCardData[AnalyseResult.cbThreeCount*3-1])==3)
			{
				if(AnalyseResult.cbSignedCount>=2) //优先带单牌
				{
					let pos = AnalyseResult.cbThreeCount*3-3;
					OutCard.bCardData = AnalyseResult.cbThreeCardData.slice(pos, pos + 3);
					OutCard.bCardData[3] =AnalyseResult.cbSignedCardData[AnalyseResult.cbSignedCount-1];
					OutCard.bCardData[4] =AnalyseResult.cbSignedCardData[AnalyseResult.cbSignedCount-2];
				}
				else
				{
					let pos = handCardCount-5;
					OutCard.bCardData = handCardData.slice(pos, pos + 5);
				}

				OutCard.bCardCount = 5;
				IScanOut = true;
			}
		}
		//最后一把
		if(AnalyseResult.cbThreeCount==1&&handCardCount<=4&&IScanOut==false)
		{
			OutCard.bCardData = handCardData.slice(0);
			OutCard.bCardCount = handCardCount;
			IScanOut = true;
		}

		if (IScanOut==false) //三带二
		{
			TempTurnCard = [];
			let bombVlue=0;
			if(AnalyseResult.cbFourCount>0) bombVlue = pdkHelper.GetCardLogicValue(AnalyseResult.cbFourCardData[AnalyseResult.cbFourCount*4-1]);
			TempTurnCard[0] =0x03;
			TempTurnCard[1] =0x03;
			TempTurnCard[2] =0x03;
			TempTurnCard[3] =0x04;
			TempTurnCard[4] =0x05;
			TempTurnCount = 5;
			if (pdkHelper.SearchOutCard(handCardData,handCardCount,TempTurnCard,TempTurnCount,OutCardResult)==true)
			{
				if (OutCardResult.cbCardCount==5)
				{
					//开始打JJJ以上 带二 不允许
					if(pdkHelper.GetCardLogicValue(OutCardResult.cbResultCard[0])>11&&handCardCount>10)
					{
						IScanOut = false;
					}
					else if(pdkHelper.GetCardLogicValue(OutCardResult.cbResultCard[0])!=bombVlue)///炸弹不能拆
					{
						OutCard.bCardData = OutCardResult.cbResultCard.slice(0);
						OutCard.bCardCount = OutCardResult.cbCardCount;
						IScanOut = true;
					}
				}
			}
		}
		if (IScanOut==false)  //双顺
		{
			if(AnalyseResult.cbDoubleCount>1)
			{
				//获取数值
				let  cbHandLogicValue=pdkHelper.GetCardLogicValue(AnalyseResult.cbDoubleCardData[AnalyseResult.cbDoubleCount*2-1]);
				//搜索连牌
				let cbLineCount=0;
				let DoubleHand = [];
				let Index = AnalyseResult.cbDoubleCount*2-1;
				do
				{
					if (((pdkHelper.GetCardLogicValue(AnalyseResult.cbDoubleCardData[Index])-cbLineCount)==cbHandLogicValue)
						&&((pdkHelper.GetCardLogicValue(AnalyseResult.cbDoubleCardData[Index-1])-cbLineCount)==cbHandLogicValue))
					{
						//增加连数
						DoubleHand[cbLineCount*2]=AnalyseResult.cbDoubleCardData[Index];
						DoubleHand[(cbLineCount++)*2+1]=AnalyseResult.cbDoubleCardData[Index-1];
					}
					Index-=2;
				}while (Index>0);
				//完成判断
				if (cbLineCount>=2)
				{
					OutCard.bCardData = DoubleHand.slice(0);
					OutCard.bCardCount = cbLineCount*2;
					IScanOut = true;
				}
			}
		}
		let wSameCardNum =0;
		if (IScanOut==false)
		{
			let FirstLogV;
			FirstLogV = pdkHelper.GetCardLogicValue(handCardData[handCardCount-1]);
			wSameCardNum = 0;
			for(let i=0;i<handCardCount;i++)
			{
				if (FirstLogV== pdkHelper.GetCardLogicValue(handCardData[handCardCount-1-i]))
					OutCard.bCardData[wSameCardNum++]= handCardData[handCardCount-1-i];
				else break;
			}
			if (wSameCardNum==3)
			{
				OutCard.bCardData = OutCard.bCardData.slice(0, 2);
				wSameCardNum = 2;
			}
			OutCard.bCardCount = wSameCardNum;
		}
		//下家报警，单牌出最大
		if (bNextWarn==true&&wSameCardNum==1)
		{
			let TempTurnCard = [],TempTurnCount;
			TempTurnCount = 2;
			TempTurnCard[0] =3;
			TempTurnCard[1] =3;
			let OutCardResult = {
				cbCardCount: 0,		//扑克数目
				cbResultCard: []	//结果扑克
			};
			if (pdkHelper.SearchOutCard(handCardData,handCardCount,TempTurnCard,TempTurnCount,OutCardResult)==true)
			{
				OutCard.bCardData = OutCardResult.cbResultCard.slice(0);
				OutCard.bCardCount = OutCardResult.cbCardCount;
			}
			else 
			{
				OutCard.bCardData[0] = handCardData[0];
				OutCard.bCardCount = 1;
			}
		}
		//一次出完 
		if (pdkHelper.GetCardType(handCardData,handCardCount)!=CT_ERROR)
		{
			if (handCardCount<=6&&AnalyseResult.cbFourCount>0)
			{
				OutCard.bCardData = AnalyseResult.cbFourCardData.slice(0, 4);
				OutCard.bCardCount = 4;
			}
			else
			{
				OutCard.bCardData = handCardData.slice(0);
				OutCard.bCardCount = handCardCount;
			}
		}
		//机器人当庄,起手黑桃3
		// if (handCardCount == 15)
		// {
		// 	let i=0;
		// 	for ( ; i<OutCard.bCardCount; i++)
		// 	{
		// 		if (OutCard.bCardData[i] == 0x03)
		// 		{
		// 			break;
		// 		}
		// 	}
		// 	//没有黑桃3
		// 	if ( i == OutCard.bCardCount)
		// 	{
		// 		wSameCardNum = 0;
		// 		for(let i=0;i<handCardCount;i++)
		// 		{
		// 			if (0x03 == pdkHelper.GetCardLogicValue(handCardData[handCardCount-1-i]))
		// 				OutCard.bCardData[wSameCardNum++]= handCardData[handCardCount-1-i];
		// 			else break;
		// 		}
		// 		if (wSameCardNum==3)
		// 		{
		// 			OutCard.bCardData = OutCard.bCardData.slice(0, 2);
		// 			wSameCardNum = 2;
		// 		}
		// 		OutCard.bCardCount = wSameCardNum;
		// 	}
		// }
		// m_pIAndroidUserItem->SendSocketData(REC_SUB_C_OUT_CART,&OutCard,sizeof(OutCard));
		return OutCard;
	}
	else
	{
		//获取类型
		let cbTurnOutType=pdkHelper.GetCardType(turnCardData,turnCardCount);
		let AnalyseResult = pdkHelper.AnalysebCardData(handCardData,handCardCount);
		let OutCardResult = {
			cbCardCount: 0,		//扑克数目
			cbResultCard: []	//结果扑克
		};
		if (pdkHelper.SearchOutCard(handCardData,handCardCount,turnCardData,turnCardCount,OutCardResult)==true)
		{
			let OutCard = {
				bCardCount: 0,				//出牌数目
				bCardData: [],				//扑克列表
				wOutCardUser: 0             //出牌玩家
			};
			if(AnalyseResult.cbFourCount>0&&cbTurnOutType!=CT_BOMB_CARD)
			{    //****************如果把炸弹拆了，强制出炸弹***********************
				for(let i=0;i<OutCardResult.cbCardCount;i++)
				{
					if (pdkHelper.GetCardLogicValue(OutCardResult.cbResultCard[i])
						==pdkHelper.GetCardLogicValue(AnalyseResult.cbFourCardData[0]))
					{
						OutCard.bCardData = AnalyseResult.cbFourCardData.slice(0);
						OutCard.bCardCount = 4;
						// m_pIAndroidUserItem->SendSocketData(REC_SUB_C_OUT_CART,&OutCard,sizeof(OutCard));
						return OutCard;
					}
				}
			}
			OutCard.bCardData = OutCardResult.cbResultCard.slice(0);
			OutCard.bCardCount = OutCardResult.cbCardCount;

			//下家报警，单牌出最大
			if (bNextWarn==true&&OutCard.bCardCount==1)
			{
				OutCard.bCardData[0] = pdkHelper.GetHandMaxCard(handCardData,handCardCount);
				OutCard.bCardCount = 1;
			}
			else if (OutCard.bCardCount==1&&handCardCount>1)
			{
				pdkHelper.SortCardList(handCardData,handCardCount);
				if (pdkHelper.GetCardLogicValue(handCardData[1])>pdkHelper.GetCardLogicValue(turnCardData[0]))
				{
					OutCard.bCardData[0] = handCardData[1];
					OutCard.bCardCount = 1;
				}
			}
			// m_pIAndroidUserItem->SendSocketData(REC_SUB_C_OUT_CART,&OutCard,sizeof(OutCard));
			return OutCard;
		}
		else
		{
			// m_pIAndroidUserItem->SendSocketData(REC_SUB_C_PASS_CARD);
		}
	}
	return;
}