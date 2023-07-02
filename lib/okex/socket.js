'use strict';

const path = require('path');
const uuidv4 = require('uuid').v4;
const WebSocket = require('ws');
const { SocketBase } = require('../base');
const crypto = require('crypto');

const OkexApi = require('./api');

const env = process.env.NODE_ENV || "development";

const model = (env === 'product') ? require('@aitraum/ets-spot-common.git/model') : require(path.resolve('./common/model'));
const etsSpotCommon = (env === 'product') ? require('@aitraum/ets-spot-common.git') : require(path.resolve('./common'));
const { redisCtrl, config, logger, queue } = etsSpotCommon;
const { CONVERT_INTEGER_VALUE } = etsSpotCommon.enum;
const { retryWrapper, timeout, defaultSatoshiValue } = etsSpotCommon.utils;
const exchangeConfig = require('./env');
const timeUnits = {
    "1m":"1",
    "5m":"5",
    "15m":"15",
    "30m":"30",
    "1H":"60",
    "4H":"240",
    "1Dutc":"1440",
};
const candleList = [15, 30, 60, 240, 1440];

const ohlcMap = {};
const marketMap = {};
const priceMap = {};
const userInfoMap = {};

function getBaseExchangeRate(symbolInfo) {
    let result = {asset: symbolInfo.base, value:0};
    if(symbolInfo.quote == exchangeConfig.standardOfficialCurrency) {
        result['value'] = Math.round(priceMap[symbolInfo.symbol] * CONVERT_INTEGER_VALUE) / CONVERT_INTEGER_VALUE;
    }
    else if(symbolInfo.base == exchangeConfig.standardOfficialCurrency) {
        result['asset'] = symbolInfo.quote;
        result['value'] = Math.round(1 / priceMap[symbolInfo.symbol] * CONVERT_INTEGER_VALUE) / CONVERT_INTEGER_VALUE;
    }
    else {
        if(priceMap[`${symbolInfo.base}-${exchangeConfig.standardOfficialCurrency}`]) {
            return result;
        }
        let baseExchangeRate = priceMap[`${symbolInfo.quote}-${exchangeConfig.standardOfficialCurrency}`];
        if(!baseExchangeRate) {
            baseExchangeRate = 1 / priceMap[`${exchangeConfig.standardOfficialCurrency}-${symbolInfo.quote}`];
        }
        result['value'] = Math.round(priceMap[symbolInfo.symbol] * baseExchangeRate * CONVERT_INTEGER_VALUE) / CONVERT_INTEGER_VALUE;
    }
    return result;
}

async function findNewOhlcByLastTime(ohlcCollection, lastTime) {
    await ohlcCollection.find({"_id":{"$lte":lastTime}}).sort({"_id":-1}).limit(1).toArray(async function(err, docs) {
        if (err) {
            throw err;
        }
        if (docs[0].value[0] < lastTime) {
            return await findNewOhlcByLastTime(ohlcCollection, lastTime)
        }
    });
}

class OkexPublicSocket extends SocketBase {
    constructor(params, ticket){
        const endPoint = 'wss://wsaws.okex.com:8443/ws/v5/public';
        super('okex', ticket, endPoint);
        this.params = {
            op: 'subscribe',
            args: params
        };
        this.beforeCandles = {};

        this.client.onopen = async(arg) => await this.onOpen(arg);
        this.client.onclose = async(arg) => await this.onClose(arg);
        this.client.onerror = async(arg) => await this.onError(arg);
        this.client.onmessage = async(arg) => await this.onMessage(arg);
        this.ticket = ticket;
    }

    //Okex connection 유지 목적
    initTimer() {
        this.timeout = setTimeout(() => {
            if (this.client && this.client.readyState === WebSocket.OPEN) {
                this.client.send('ping');
            }
        }, 5000);
    }

    resetTimer() {
        if (this.timeout) {
            clearTimeout(this.timeout);
            this.timeout = null;
            this.initTimer();
        }
    }

    async onOpen(arg) {
        this.initTimer();
        console.log(`${this.exchangeName} :: ${this.userName} WS Connection Success! - ${new Date()}`);
        //subscribe
        this.client.send(JSON.stringify(this.params));
    }

    async onMessage(msg) {
        this.resetTimer();
        if(msg.data === 'pong'){
            return;
        }
        const msgMap = JSON.parse(msg.data);
        if(!msgMap.data) {
            return;
        }

        const expr = msgMap.arg.channel.startsWith('candle') ? 'candle' : msgMap.arg.channel;
        switch(expr) {
            case 'trades': return await this.onTradeMessage(msgMap); break;
            case 'candle': return await this.onOhlcMessage(msgMap); break;
        }
        // return await this.onOhlcMessage(msgMap);
    }

    async onOhlcMessage(msgMap) {
        const nowCandleArg = msgMap.arg;
        const nowCandleData = msgMap.data[0];
        const symbol = nowCandleArg.instId;
        this.beforeCandles[symbol] || ( this.beforeCandles[symbol] = nowCandleData );

        if(this.beforeCandles[symbol][0] === nowCandleData[0]){
            this.beforeCandles[symbol] = nowCandleData;
            return;
        }
        const lastCandleData = this.beforeCandles[symbol];

        const now = new Date();
        const lastData = lastCandleData.map(Number);
        const lastTime = lastData[0];
        const candleTimeStr = nowCandleArg.channel.replace('candle', '');
        this.beforeCandles[symbol] = nowCandleData;

        const ohlcCollection =  model.ohlcDb.collection(`okex_${symbol}_${timeUnits[candleTimeStr]}`);
        if(['product', 'staging', 'testserver'].includes(env)) {
            await ohlcCollection.updateOne(
                {_id:lastTime},
                {$set: {_id:lastTime, value: lastData}},
                {upsert: true}
            ).catch(e => {});
            if(parseInt(timeUnits[candleTimeStr]) >= 15) {
                await redisCtrl.pushQueue(`okex:watcher:ohlc_queue`, `${symbol}_${timeUnits[candleTimeStr]}`);
                console.log(`${now.toISOString()} - ${symbol}_${timeUnits[candleTimeStr]}`);
            }
        }
        else {
            await findNewOhlcByLastTime(ohlcCollection, currentTime);
            if(parseInt(timeUnits[candleTimeStr]) >= 15) {
                await redisCtrl.pushQueue(`okex:watcher:ohlc_queue`, `${symbol}_${timeUnits[candleTimeStr]}`);
            }
        }
    }

    async onTradeMessage(msgMap) {
        const tradeArg = msgMap.arg;
        const tradeData = msgMap.data[0];
        const symbol = tradeArg.instId;
        const [base, quote] = symbol.split("-");

        const lastPrice = priceMap[symbol];
        priceMap[symbol] = parseFloat(tradeData['px']);
        if(lastPrice != priceMap[symbol]) {
            await redisCtrl.setCurrentPrice('okex', symbol, defaultSatoshiValue(tradeData['px']));
            const baseExchangeRate = getBaseExchangeRate({base, quote, symbol});
            if(baseExchangeRate.value > 0) {
                await redisCtrl.setBaseExchangeRate('okex', baseExchangeRate.asset, baseExchangeRate.value);
            }
        }

    }

    recycle() {
        this.client.terminate();
        this.client = null;
        this.flags = true;
        this.client = new WebSocket(this.endPoint);
        this.client.binaryType = 'arraybuffer';
        this.startTime = new Date();
        this.client.onopen = async(arg) => await this.onOpen(arg);
        this.client.onclose = async(arg) => await this.onClose(arg);
        this.client.onerror = async(arg) => await this.onError(arg);
        this.client.onmessage = async(arg) => await this.onMessage(arg);
        this.client.ticket = this.userName;
    }

    static async start() {
        try {
            const okexApi = new OkexApi();
            const newSymbolList = await okexApi.marketDataRefresh();
            if(newSymbolList && newSymbolList.length > 0) {
                await OkexPublicSocket.repairOhlc(okexApi, newSymbolList);
            }
            const marketList = await okexApi.getAllMarket();
            const priceList = await okexApi.getAllPrice();
            const setBaseExchangeRateQueries = [];
            priceList.map(priceInfo => {
                priceMap[priceInfo.instId] = priceInfo.last;
            });
            const parameterMap = {
                "candle15m": [], "candle30m": [],
                "candle1H": [], "candle4H": [], "candle1Dutc": [], "trades": []
            };

            for(const market of marketList) {
                const [base, quote] = market.symbol.split("-");
                const baseExchangeRate = getBaseExchangeRate({base:base, quote:quote, symbol:market.symbol});
                if(baseExchangeRate.value > 0) {
                    setBaseExchangeRateQueries.push(baseExchangeRate.asset);
                    setBaseExchangeRateQueries.push(baseExchangeRate.value);
                }
                marketMap[market.symbol] = market;

                for(const ticket in parameterMap) {
                    parameterMap[ticket].push({
                        channel: ticket,
                        instId: market.symbol
                    })
                }

            }
            await redisCtrl.setBaseExchangeRateList('okex', setBaseExchangeRateQueries);
            const publicSockets = [];
            for(const ticket in parameterMap) {
                publicSockets.push(new OkexPublicSocket(parameterMap[ticket], ticket));
            }
            return publicSockets;
        }
        catch (e) {
            console.log(e);
        }
    }

    static async repairOhlc(okexApi, symbolList) {
        const now = new Date().getTime();
        for(const symbol of symbolList) {
            for(const candle of candleList) {
                const ohlcCollection = model.ohlcDb.collection(`okex_${symbol}_${candle}`);
                const ohlcMap = {};
                await new Promise((resolve, reject) => {
                    ohlcCollection.find({"_id":{"$lte":now}}).sort({"_id":-1}).limit(1000).toArray(async function(err, docs) {
                        if(err) {
                            return reject(err);
                        }
                        docs.map(doc => {
                            ohlcMap[doc["_id"]] = doc.value;
                        });
                        resolve();
                    });
                });
                const ohlcHistory = await okexApi.getOhlcHistory(symbol, candle, now, 100);
                ohlcHistory.pop(-1);
                const bulk = ohlcCollection.initializeUnorderedBulkOp();
                for(const ohlc of ohlcHistory) {
                    const newData = ohlc.map(Number);
                    if(!ohlcMap[newData[0]]) {
                        bulk.insert({"_id":newData[0], "value":newData});
                    }
                    else if( JSON.stringify(ohlcMap[newData[0]]) !== JSON.stringify(newData) ) {
                        bulk.find({_id: newData[0]}).update({
                                $set: {_id:newData[0], value: newData}},
                            {upsert: true});
                    }
                }
                if(bulk.length > 0) {
                    try {
                        await new Promise((resolve, reject) => {
                            bulk.execute(function (err) {
                                if(err) {
                                    reject(err);
                                }
                                resolve();
                            });
                        })
                    }
                    catch (e) {
                        console.log(e);
                    }
                }
            }
        }
    }
}
exports.PublicSocket = OkexPublicSocket;

class OkexPrivateSocket extends SocketBase {
    constructor(user){
        const endPoint = 'wss://wsaws.okex.com:8443/ws/v5/private';
        super('okex', user.userName, endPoint);
        this.user = user;
        this.exchangeApi = new OkexApi(user);
        this.apiKey = this.exchangeApi.apiKey;
        this.secretKey = this.exchangeApi.secretKey;
        this.passphrase = this.exchangeApi.passphrase;
        this.retryCount = 0;
        this.maxRetryCount = 10;
        this.orderQueue = new queue();
        this.beforeBalances = {};
        this.initWebsocket();
    }

    initWebsocket(){
        if(this.client.readyState === WebSocket.CLOSED){
            this.client = null;
            this.client = new WebSocket(this.endPoint);
        }
        this.client.onopen = async(arg) => {
            console.log(`${this.exchangeName} :: ${this.userName} WS Connection Success! - ${new Date()}`);
            this.clearSocketTimer();
            this.initPingTimer();
            this.login();
        };
        this.client.onclose = async(arg) => {
            console.log(`${this.exchangeName} :: ${this.userName} WS Connection Closed! - ${new Date()}`);
            console.log(`${this.exchangeName} :: ${this.userName} Reason : ${arg.reason}, Code : ${arg.code}`);
            console.log(`${this.exchangeName} :: ${this.userName} Retry Count : ${this.retryCount}`);
            const now = new Date();
            if(now.getDate() !== this.startTime.getDate()){
                this.startTime = new Date();
                this.retryCount = 0;
            }
            if(this.client && this.retryCount < this.maxRetryCount) {
                this.retryCount++;
                this.initSocketTimer();
            }
            else{
                this.client ?
                    console.log(`${this.exchangeName} :: ${this.userName} WS Reached Max Retry Count - ${new Date()}`) :
                    console.log(`${this.exchangeName} :: ${this.userName} WS Client ${this.client} - ${new Date()}`);
                this.clearSocketTimer();
            }
        };
        this.client.onmessage = async(arg) => {
            this.resetPingTimer();
            // if(arg.data === 'pong'){
            //     return;
            // }
            const msgMap = JSON.parse(arg.data);
            if(msgMap.event === 'login'){
                this.subscribe();
                return;
            }
            if(msgMap.event === 'error'){
                if(!this.invalidApiKey(msgMap)) this.client.close(4000, msgMap.msg);
                return;
            }
            if(!msgMap.data) {
                return;
            }

            switch(msgMap.arg.channel) {
                case 'account': await this.AccountPosition(msgMap); break;
                case 'orders': await this.orderQueue.pushNormal(this.onOrderMessage, this.user, msgMap); break;
            }
        };
        this.client.onerror = async(arg) => await this.onError(arg);
    }

    //Okex connection 유지 목적
    initPingTimer() {
        this.pingTimer = setTimeout(() => {
            if (this.client && this.client.readyState === WebSocket.OPEN) {
                //this.client.send('ping');
                //계정 유효성 확인을 위해 ping 대신 로그인 시도
                this.login();
            }
        }, 10000);
    }

    resetPingTimer() {
        if (this.pingTimer) {
            clearTimeout(this.pingTimer);
            this.pingTimer = null;
            this.initPingTimer();
        }
    }

    initSocketTimer() {
        if(this.reconnectTimer) return;
        this.initWebsocket();
        const self = this;
        this.reconnectTimer = setInterval(() => {
            if(self.client.readyState !== WebSocket.CLOSED) {
                console.log(`${self.exchangeName} :: ${self.userName} WS Ready State ${self.client.readyState} - ${new Date()}`);
                return;
            }
            self.initWebsocket();
        }, 3000);
    }

    clearSocketTimer() {
        if(!this.reconnectTimer) return;
        clearInterval(this.reconnectTimer);
        this.reconnectTimer = null;
    }

    login(){
        const timestamp = new Date().getTime() / 1000;
        const str = timestamp + 'GET' +'/users/self/verify';
        const hmac = crypto.createHmac('sha256', this.secretKey);
        const signature = hmac.update(str).digest('base64');
        this.client.send(JSON.stringify({
            op: 'login',
            args: [
                {
                    apiKey: this.apiKey,
                    passphrase: this.passphrase,
                    timestamp: timestamp,
                    sign: signature
                }
            ]
        }));
    }

    subscribe(op = 'subscribe') {
        this.client.send(JSON.stringify({
            op,
            args: [
                {
                    channel: 'account'
                },
                {
                    channel: 'orders',
                    instType: 'SPOT'
                }
            ]
        }));
    }

    async onOrderMessage(user, msgMap) {
        try{
            for(const orderInfo of msgMap.data){
                let parserReceiptForm;
                const uKey = OkexApi.getUKeyByClientOrderId(orderInfo['clOrdId']);
                const [userIdFirst, uuid] = uKey.split('-');
                if(user.id.split('-')[0] != userIdFirst) {
                    continue;
                }
                if(orderInfo['state'] === 'canceled') {
                    parserReceiptForm = { clientOrderId: orderInfo['clOrdId'], status: 'CANCELED' };
                }
                else if(['limit','market'].includes(orderInfo['ordType'])){
                    const exchangeData = orderInfo;
                    const okexApi = new OkexApi();
                    parserReceiptForm = await okexApi.makeSocketActualOrderReceiptForm(exchangeData);

                }
                else{
                    continue;
                }

                const data = {
                    packetId: uuidv4(),
                    exchangeOrderData: parserReceiptForm
                };
                await retryWrapper(redisCtrl.pushQueue, `socket:parser`, `order||okex||${user.id}||actual||${JSON.stringify(data)}`);
                await retryWrapper(redisCtrl.listenTempQueue, `okex:privateSocket:processQueue:${data.packetId}`, 3);
            }
        }
        catch (e) {
            logger.errorConsole(e);
        }

    }

    async AccountPosition(msgMap) {
        if(msgMap.data.length == 0) {
            return;
        }
        let checkAccountmode = await this.validAccountMode(msgMap.data[0]);
        if(!checkAccountmode) {
            this.subscribe('unsubscribe');
            return;
        }
        const nowBalances = msgMap.data[0].details;
        for(const balance of nowBalances){
            const asset = balance.ccy;
            this.beforeBalances[asset] || ( this.beforeBalances[asset] = {} );

            if(this.beforeBalances[asset].free === balance.availBal){
                continue;
            }
            const nowBalance = {asset: asset, free: balance.availBal, locked: balance.frozenBal};
            this.beforeBalances[asset] = nowBalance;
            await redisCtrl.pushQueue(`socket:parser`, `balance||okex||${this.user.id}||actual||${JSON.stringify(nowBalance)}`);
        }
    }
    async validAccountMode(accountInfo){
        //simple 모드일 경우 isoEq는 항상 '' 이다.
        const simpleModeIsoEq = '';
        const isSimpleMode = ( accountInfo['isoEq'] === simpleModeIsoEq );
        if(!isSimpleMode){
            await this.disconnectQueue('InvalidAccountMode');
        }
        return isSimpleMode;
    }

    /**
     * 60005, 60007, 60009 에러코드는 로그인 불가
     * 60010 에러코드는 로그인 재요청 에러코드(api key 유효성 검사를 위해 임의로 발생)
     * @param msgMap
     * @returns {boolean}
     */
    invalidApiKey(msgMap){
        if(['60005', '60007', '60009'].includes(msgMap.code)){
            this.disconnectQueue('InvalidApiKey');
            return true;
        }else if(msgMap.code === '60010'){
            return true;
        }
    }
    disconnectQueue(msg){
        redisCtrl.pushQueue(`socket:parser`,
            `privateSocketStatus||okex||${this.user.id}||actual||${JSON.stringify({status: msg})}`);
    }

    async listenKeyPingUpdate(socket, reconectFunction){

    }

    terminate() {
        this.client.terminate();
        this.client = null;
    }

    static async start(user, retryCount=0) {
        try {
            return new OkexPrivateSocket(user);
        }
        catch (e) {
            logger.errorConsole(e);
            if(retryCount < 10) {
                await timeout(5000);
                return await OkexPrivateSocket.start(user, retryCount+1);
            }

        }
    }

}

exports.PrivateSocket = OkexPrivateSocket;