'use strict';

const path = require('path');
const uuidv4 = require('uuid').v4;
const WebSocket = require('ws');
const { SocketBase } = require('../base');

const BinanceApi = require('./api');

const env = process.env.NODE_ENV || "development";

const model = (env === 'product') ? require('@aitraum/ets-spot-common.git/model') : require(path.resolve('./common/model'));
const etsSpotCommon = (env === 'product') ? require('@aitraum/ets-spot-common.git') : require(path.resolve('./common'));
const { redisCtrl, config, logger, queue } = etsSpotCommon;
const { CONVERT_INTEGER_VALUE } = etsSpotCommon.enum;
const { retryWrapper, timeout } = etsSpotCommon.utils;
const { APIKeyInvalidError, ExchangeApiError } = require('./error');
const exchangeConfig = require('./env');
const timeUnits = {
    "1m":"1",
    "5m":"5",
    "15m":"15",
    "30m":"30",
    "1h":"60",
    "4h":"240",
    "1d":"1440",
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

class BinancePublicSocket extends SocketBase {
    constructor(params, ticket){
        const baseUrl = 'wss://stream.binance.com:9443/stream?streams=';
        const endPoint = baseUrl + params.join('/');
        super('binance', ticket, endPoint);
        this.exchangeApi = new BinanceApi();
        this.params = params;
        this.client.onopen = async(arg) => await this.onOpen(arg);
        this.client.onclose = async(arg) => await this.onClose(arg);
        this.client.onerror = async(arg) => await this.onError(arg);
        this.client.onmessage = async(arg) => await this.onMessage(arg);
        this.ticket = ticket;
        this.client.on('ping', () => {
            this.ping(this)
        });
    }

    ping(self) {
        clearTimeout(self.healthCheck);
        self.healthCheck = setTimeout((self) => {
            self.client.disconnect();
        }, 240000, self);
        console.log(`BINANCE :: ${self.ticket} Health Check Success! - ${new Date()}`);
    }

    async onOpen(arg) {
        await super.onOpen(arg);
        this.healthCheck = setTimeout((self) => {
            self.client.disconnect();
        }, 240000, this);
    }

    async onClose(arg) {
        clearTimeout(this.healthCheck);
        await super.onClose(arg);
    }

    async onMessage(msg) {
        const msgMap = JSON.parse(msg.data);
        switch(msgMap.data['e']) {
            case 'trade': return await this.onTradeMessage(msgMap); break;
            case 'kline': return await this.onOhlcMessage(msgMap); break;
        }
        return await this.onOhlcMessage(msgMap);
    }

    async onOhlcMessage(msgMap) {
        const kline = msgMap.data['k'];
        if(kline['x'] != true) {
            return;
        }
        const now = new Date();
        const currentTime = kline['t'];
        const currentData = [
            parseInt(kline['t']), parseFloat(kline['o']), parseFloat(kline['h']), parseFloat(kline['l']),
            parseFloat(kline['c']), parseFloat(kline['v']), parseInt(kline['T']), parseFloat(kline['q']),
            parseFloat(kline['n']), parseFloat(kline['V']), parseFloat(kline['Q']), parseFloat(kline['B'])
        ];
        const symbolData = BinanceApi.changeCoin(kline['s']);
        const ohlcCollection =  model.ohlcDb.collection(`binance_${symbolData.symbol}_${timeUnits[kline['i']]}`);
        if(['product', 'staging', 'testserver'].includes(env)) {
            await ohlcCollection.updateOne(
                {_id:parseInt(currentTime)},
                {$set: {_id:currentTime, value: currentData}},
                {upsert: true}
            ).catch(e => {return;});
            if(parseInt(timeUnits[kline['i']]) >= 15) {
                await redisCtrl.pushQueue(`binance:watcher:ohlc_queue`, `${symbolData.symbol}_${timeUnits[kline['i']]}`);
                console.log(`${now.toISOString()} - ${symbolData.symbol}_${timeUnits[kline['i']]}`);
            }
        }
        else {
            await findNewOhlcByLastTime(ohlcCollection, currentTime);
            if(parseInt(timeUnits[kline['i']]) >= 15) {
                await redisCtrl.pushQueue(`binance:watcher:ohlc_queue`, `${symbolData.symbol}_${timeUnits[kline['i']]}`);
            }
        }
    }
    async onOhlcMessageOld(msgMap) {
        if(!ohlcMap[msgMap.data['s']]) {
            ohlcMap[msgMap.data['s']] = {};
        }
        if(!ohlcMap[msgMap.data['s']][msgMap.data['k']['i']]) {
            ohlcMap[msgMap.data['s']][msgMap.data['k']['i']] = {};
        }
        const kline = msgMap.data['k'];
        const lastTime = ohlcMap[msgMap.data['s']][msgMap.data['k']['i']]._id ?
            ohlcMap[msgMap.data['s']][msgMap.data['k']['i']]._id : 0;
        let lastData = ohlcMap[msgMap.data['s']][msgMap.data['k']['i']].value ?
            ohlcMap[msgMap.data['s']][msgMap.data['k']['i']].value : [];

        const currentTime = kline['t'];
        const currentData = [
            parseInt(kline['t']), parseFloat(kline['o']), parseFloat(kline['h']), parseFloat(kline['l']),
            parseFloat(kline['c']), parseFloat(kline['v']), parseInt(kline['T']), parseFloat(kline['q']),
            parseFloat(kline['n']), parseFloat(kline['V']), parseFloat(kline['Q']), parseFloat(kline['B'])
        ];

        if(lastTime != currentTime) {
            ohlcMap[msgMap.data['s']][msgMap.data['k']['i']]._id = currentTime;
            ohlcMap[msgMap.data['s']][msgMap.data['k']['i']].value = currentData;
            const symbolData = BinanceApi.changeCoin(kline['s']);
            if(!symbolData || !symbolData.symbol) {
                console.log(symbolData);
                return;
            }
            if(lastData.length > 0) {
                const ohlcCollection =  model.ohlcDb.collection(`binance_${symbolData.symbol}_${timeUnits[kline['i']]}`);
                if(['product', 'staging', 'testserver'].includes(env)) {
                    await ohlcCollection.updateOne(
                        {_id:parseInt(lastTime)},
                        {$set: {_id:lastTime, value: lastData}},
                        {upsert: true}
                    ).catch(e => {return;});
                    if(parseInt(timeUnits[kline['i']]) >= 15) {
                        await redisCtrl.pushQueue(`binance:watcher:ohlc_queue`, `${symbolData.symbol}_${timeUnits[kline['i']]}`);
                    }
                }
                else {
                    await findNewOhlcByLastTime(ohlcCollection, lastTime);
                    if(parseInt(timeUnits[kline['i']]) >= 15) {
                        await redisCtrl.pushQueue(`binance:watcher:ohlc_queue`, `${symbolData.symbol}_${timeUnits[kline['i']]}`);
                    }
                }
            }
        }
        else {
            ohlcMap[msgMap.data['s']][msgMap.data['k']['i']].value = currentData;
        }
    }

    async onTradeMessage(msgMap) {
        const symbolInfo = BinanceApi.changeCoin(msgMap.data['s']);
        if(!symbolInfo){
            return;
        }
        if(msgMap.data.e !== 'trade'){
            return;
        }
        const lastPrice = priceMap[symbolInfo.symbol];
        priceMap[symbolInfo.symbol] = parseFloat(msgMap.data['p']);
        if(lastPrice != priceMap[symbolInfo.symbol]) {
            await redisCtrl.setCurrentPrice('binance', symbolInfo.symbol, msgMap.data['p']);
            const baseExchangeRate = getBaseExchangeRate(symbolInfo);
            if(baseExchangeRate.value > 0) {
                await redisCtrl.setBaseExchangeRate('binance', baseExchangeRate.asset, baseExchangeRate.value);
            }
        }

    }

    recycle() {
        this.flags = true;
        this.client = new WebSocket(this.endPoint);
        this.startTime = new Date();
        this.client.onopen = async(arg) => await this.onOpen(arg);
        this.client.onclose = async(arg) => await this.onClose(arg);
        this.client.onerror = async(arg) => await this.onError(arg);
        this.client.onmessage = async(arg) => await this.onMessage(arg);
        this.client.ticket = this.userName;
        this.client.on('ping', this.ping);
    }

    static async start() {
        try {
            const binanceApi = new BinanceApi();
            const newSymbolList = await binanceApi.marketDataRefresh();
            if(newSymbolList && newSymbolList.length > 0) {
                await BinancePublicSocket.repairOhlc(binanceApi, newSymbolList);
            }
            const marketList = await binanceApi.getAllMarket();
            const priceList = await binanceApi.getAllPrice();
            const setBaseExchangeRateQueries = [];
            priceList.map(priceInfo => {
                const symbolInfo = BinanceApi.changeCoin(priceInfo.symbol);
                if(!symbolInfo) {
                    return;
                }
                priceMap[symbolInfo.symbol] = priceInfo.price;
            });
            const parameterMap = {
                // "@kline_1m": [], "@kline_5m": [],
                "@kline_15m": [], "@kline_30m": [],
                "@kline_1h": [], "@kline_4h": [], "@kline_1d": [], "@trade": []
            };

            for(const market of marketList) {
                const [base, quote] = market.symbol.split("-");
                const symbol = base+quote;
                const baseExchangeRate = getBaseExchangeRate({base:base, quote:quote, symbol:market.symbol});
                if(baseExchangeRate.value > 0) {
                    setBaseExchangeRateQueries.push(baseExchangeRate.asset);
                    setBaseExchangeRateQueries.push(baseExchangeRate.value);
                }
                marketMap[market.symbol] = market;
                const symbolStr = symbol.toLowerCase();
                // parameterMap["@kline_1m"].push(`${symbolStr}@kline_1m`);
                // parameterMap["@kline_5m"].push(`${symbolStr}@kline_5m`);
                parameterMap["@kline_15m"].push(`${symbolStr}@kline_15m`);
                parameterMap["@kline_30m"].push(`${symbolStr}@kline_30m`);
                parameterMap["@kline_1h"].push(`${symbolStr}@kline_1h`);
                parameterMap["@kline_4h"].push(`${symbolStr}@kline_4h`);
                parameterMap["@kline_1d"].push(`${symbolStr}@kline_1d`);
                parameterMap["@trade"].push(`${symbolStr}@trade`);
            }
            await redisCtrl.setBaseExchangeRateList('binance', setBaseExchangeRateQueries);
            const publicSockets = [];
            for(const ticket in parameterMap) {
                publicSockets.push(new BinancePublicSocket(parameterMap[ticket], ticket));
            }
            return publicSockets;
        }
        catch (e) {
            console.log(e);
        }
    }

    static async repairOhlc(binanceApi, symbolList) {
        const now = new Date().getTime();
        for(const symbol of symbolList) {
            for(const candle of candleList) {
                const ohlcCollection = model.ohlcDb.collection(`binance_${symbol}_${candle}`);
                const ohlcMap = {};
                await new Promise((resolve, reject) => {
                    ohlcCollection.find({"_id":{"$lte":now}}).sort({"_id":-1}).limit(1000).toArray(async function(err, docs) {
                        if(err) {
                            return reject(err);
                        }
                        docs.map(doc => {
                            ohlcMap[parseInt(doc["_id"])] = [doc.value[0], doc.value[1], doc.value[2], doc.value[3], doc.value[4], doc.value[5]];
                        });
                        resolve();
                    });
                });
                const ohlcHistory = await binanceApi.getOhlcHistory(symbol, candle, now, 500);
                ohlcHistory.pop(-1);
                const bulk = ohlcCollection.initializeUnorderedBulkOp();
                for(const ohlc of ohlcHistory) {
                    const newData = [parseFloat(ohlc[0]), parseFloat(ohlc[1]),
                        parseFloat(ohlc[2]), parseFloat(ohlc[3]), parseFloat(ohlc[4]), parseFloat(ohlc[5]),
                        parseFloat(ohlc[6]), parseFloat(ohlc[7]), parseFloat(ohlc[8]), parseFloat(ohlc[9]),
                        parseFloat(ohlc[10]), parseFloat(ohlc[11])];
                    if(!ohlcMap[parseInt(ohlc[0])]) {
                        bulk.insert({"_id":parseInt(ohlc[0]), "value":newData});
                    }
                    else if(ohlcMap[parseInt(ohlc[0])][4] != ohlc[4] ||
                        ohlcMap[parseInt(ohlc[0])][3] != ohlc[3] || ohlcMap[parseInt(ohlc[0])][2] != ohlc[2] ||
                        ohlcMap[parseInt(ohlc[0])][1] != ohlc[1]) {
                        bulk.find({_id: parseInt(ohlc[0])}).update({
                                $set: {_id:parseInt(ohlc[0]), value: newData}},
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
exports.PublicSocket = BinancePublicSocket;

class BinancePrivateSocket extends SocketBase {
    constructor(listenKey, user, endPoint, exchangeApi){
        super('binance', user.userName, endPoint);
        this.listenKey = listenKey;
        this.user = user;
        this.exchangeApi = exchangeApi;
        this.retryCount = 0;
        this.orderQueue = new queue();
        this.client.onopen = async(arg) => await this.onOpen(arg);
        this.client.onclose = async(arg) => await this.onClose(arg);
        this.client.onerror = async(arg) => await this.onError(arg);
        this.client.onmessage = async(arg) => await this.onMessage(arg);
    }

    async onClose() {
        console.log(`${this.exchangeName} :: ${this.userName} WS Connection Closed! - ${new Date()}`);
        if(this.client) {
            this.client.terminate();
            if(this.retryCount < 3) {
                const self = this;
                setTimeout(async function() {
                    self.client = new WebSocket(self.endPoint);
                    self.client.onopen = async(arg) => await self.onOpen(arg);
                    self.client.onclose = async(arg) => await self.onClose(arg);
                    self.client.onerror = async(arg) => await self.onError(arg);
                    self.client.onmessage = async(arg) => await self.onMessage(arg);
                }, 3000);
                const now = new Date();
                if(now.getDate() == this.startTime.getDate()) {
                    this.retryCount += 1;
                }
                else {
                    this.retryCount = 0;
                }
            }
            else {
                delete userInfoMap[this.userName];
            }
        }
    }

    async onMessage(msg) {
        const msgMap = JSON.parse(msg.data);
        switch (msgMap.data.e) {
            case 'outboundAccountPosition':
                await this.AccountPosition(msgMap.data);
                break;
            case 'executionReport':
                await this.orderQueue.pushNormal(this.onOrderMessage, this.user, msgMap.data);
        }
    }

    async onOrderMessage(user, msgMapData) {
        try{
            let parserReceiptForm ;
            // if(msgMapData['X'] === 'NEW'){
            //     parserReceiptForm = { clientOrderId: msgMapData['c'], status: msgMapData['X'] }
            // }
            if(msgMapData['X'] === 'CANCELED') {
                if(!msgMapData['c'].startsWith(`x-${exchangeConfig.brokerKey}`)) {
                    parserReceiptForm = { clientOrderId: msgMapData['C'], status: msgMapData['X'] }
                }
                else {
                    return;
                }
            }
            else {
                if(!msgMapData['c'].startsWith(`x-${exchangeConfig.brokerKey}`)) return ;
                if(msgMapData['o'] === 'LIMIT') {
                    const exchangeData = msgMapData;
                    const binanceApi = new BinanceApi();
                    parserReceiptForm = await binanceApi.makeSocketActualOrderReceiptForm(exchangeData);
                }
                else {
                    return;
                }
            }
            const [prefix, uKey] = parserReceiptForm['clientOrderId'].split(`x-${exchangeConfig.brokerKey}-`);
            const [userIdFirst, uuid] = uKey.split('-');
            if(user.id.split('-')[0] != userIdFirst) {
                return;
            }
            const data = {
                packetId: uuidv4(),
                exchangeOrderData: parserReceiptForm
            };
            await retryWrapper(redisCtrl.pushQueue, `socket:parser`, `order||binance||${user.id}||actual||${JSON.stringify(data)}`);
            await retryWrapper(redisCtrl.listenTempQueue, `binance:privateSocket:processQueue:${data.packetId}`, 3);
        }
        catch (e) {
            logger.errorConsole(e);
        }

    }

    async AccountPosition(msgMapData) {
        for(const balanceInfo of msgMapData['B']) {
            const balance = {asset: balanceInfo['a'], free:balanceInfo['f'], locked: balanceInfo['l']};
            await redisCtrl.pushQueue(`socket:parser`, `balance||binance||${this.user.id}||actual||${JSON.stringify(balance)}`);
        }
    }

    async listenKeyPingUpdate(socket, reconectFunction){
        try {
            await socket.exchangeApi.listenKeyUpdate(socket.listenKey);
            this.pingUpdate = setTimeout(await socket.listenKeyPingUpdate,180000, socket, reconectFunction);
        }
        catch (e) {
            logger.errorConsole(e);
            if(e instanceof APIKeyInvalidError) {
                await redisCtrl.pushQueue(`socket:parser`,
                    `privateSocketStatus||binance||${socket.user.id}||actual||${JSON.stringify({status:'InvalidApiKey'})}`);
            }
            else if(e instanceof ExchangeApiError) {
                await logger.sendSlackBot(e.constructor.name, {errorCode: e.code, server: process.env.NODE_ENV}, 'socket-error');
            }
            else {
                await reconectFunction(socket.user)
            }
        }
    }

    terminate() {
        clearTimeout(this.pingUpdate);
        this.client.terminate();
        this.client = undefined;
    }

    static async start(user, retryCount=0) {
        try {
            const binanceApi = new BinanceApi(user);
            const result = await binanceApi.listenKeyCreate();
            const endPoint = 'wss://stream.binance.com:9443/stream?streams=' + result.listenKey;
            return new BinancePrivateSocket(result.listenKey, user, endPoint, binanceApi);
        }
        catch (e) {
            logger.errorConsole(e);
            if(e instanceof APIKeyInvalidError) {
                await redisCtrl.pushQueue(`socket:parser`,
                    `privateSocketStatus||binance||${user.id}||actual||${JSON.stringify({status:'InvalidApiKey'})}`);
                return;
            }
            else if(e instanceof ExchangeApiError) {
                await logger.sendSlackBot(e.constructor.name, {errorCode: e.code, server: process.env.NODE_ENV}, 'socket-error');
            }
            else {
                return;
            }
            if(retryCount < 10) {
                await timeout(5000);
                return await BinancePrivateSocket.start(user, retryCount+1);
            }
            return;
        }
    }

}

exports.PrivateSocket = BinancePrivateSocket;