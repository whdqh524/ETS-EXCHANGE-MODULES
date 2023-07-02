"use strict";

const qs = require('qs');
const uuidv4 = require('uuid').v4;
const crypto = require('crypto');
const env = process.env.NODE_ENV || "development";
const path = require('path');
const etsSpotCommon = (env === 'product') ? require('@aitraum/ets-spot-common.git') : require(path.resolve('./common'));
const { NeedCheckApiKeyError, NotInputExchangeApiKeyError } = etsSpotCommon.error;
const exchangeConfig = require('./env');
const redisCtrl = etsSpotCommon.redisCtrl;
const { decrypt, defaultSatoshiValue } = etsSpotCommon.utils;
const logger = etsSpotCommon.logger;
const { ApiBase } = require('../base');
const { ExchangeApiError, ExchangeAccessKeyInvalidError, ExchangeOperationNotSupportedAccountModeError, ExchangeBalanceInsufficienntError } = require('./error');

const timeUnits = {
    "1":"1m",
    "5":"5m",
    "15":"15m",
    "30":"30m",
    "60":"1H",
    "240":"4H",
    "1440":"1Dutc",
};

class OkexApi extends ApiBase{
    constructor(user) {
        if(!user) {
            super();
        }
        else {
            if(!user.apiKeyMap['okex']) {
                throw new NotInputExchangeApiKeyError();
            }
            if(user.apiKeyMap['okex'].alive != true) {
                throw new NeedCheckApiKeyError();
            }
            super(user.apiKeyMap['okex'], user.salt);
            this.passphrase = decrypt(user.apiKeyMap.okex.passphrase, user.salt);
        }
        this.exchange = 'okex';
        this.hostUrl = 'https://aws.okex.com';
        this.version = '/api/v5/';
        this.userEndPointList = [
            'trade', 'asset', 'account','users'
        ];
    }

    getSignedHeader(method, endPoint, data) {
        const headers = {};
        headers.timestamp = (new Date().getTime() / 1000).toFixed(3);
        headers.signatureData = method === 'GET' ? data && Object.keys(data).length ? '?'+ qs.stringify(data) : '' : JSON.stringify(data);
        const hmac = crypto.createHmac("sha256", this.secretKey);
        headers.signature = hmac.update(`${headers.timestamp}${method}${this.version}${endPoint}${headers.signatureData}`).digest('base64');

        return {
            'Content-Type': 'application/json',
            'OK-ACCESS-KEY': this.apiKey,
            'OK-ACCESS-TIMESTAMP': headers.timestamp,
            'OK-ACCESS-SIGN': headers.signature,
            'OK-ACCESS-PASSPHRASE': this.passphrase
        };
    }

    makeReqObjPost (url, headers, method = 'POST', data = {}, params = {}) {
        return {
            url: url,
            params: params,
            data: {},
            body: JSON.stringify(data),
            method: method,
            headers: headers
        };
    }

    makeReqObj (url, headers, method = 'GET', params) {
        return {
            url: url,
            params: params,
            data: {},
            method: method,
            headers: headers,
        }
    }

    makeApiOptiosUseApiProxy (endPoint, method, data = {}) {
        const mainEndPoint = endPoint.split('/')[0];
        let headers = {};
        if(this.userEndPointList.includes(mainEndPoint))  headers = this.getSignedHeader(method, endPoint, data);
        let options;
        switch(method) {
            case 'POST':
                options = this.makeReqObjPost(`${this.hostUrl}${this.version}${endPoint}`, headers, method, data);
                break;
            case 'GET':
                options = this.makeReqObj(`${this.hostUrl}${this.version}${endPoint}`, headers, method, data);
                break;
            case 'PUT':
                options = this.makeReqObj(`${this.hostUrl}${this.version}${endPoint}`, method, data);
                break;
            case 'DELETE':
                options = this.makeReqObj(`${this.hostUrl}${this.version}${endPoint}`, method, data);
                break;
        }
        options.uuid = uuidv4();
        return options;
    };

    async sendApiToExchange(options, retryCount=1) {
        try {
            const response = await super.sendApiToExchange(options, retryCount);
            const responseBody = JSON.parse(response.body);
            if(parseInt(responseBody.code) >= 1){
                const errorMessageForm = {
                    exchangeCode : responseBody.data && responseBody.data.length > 0 ? responseBody.data[0].sCode : responseBody.code,
                    message: responseBody.data && responseBody.data.length > 0 ? responseBody.data[0].sMsg : responseBody.msg,
                };
                throw new ExchangeApiError(errorMessageForm);
            }

            await logger.infoConsole(`ExchangeAPI - sendApiToExchange 200 Response:`, responseBody);
            return responseBody;
        }
        catch (e) {
            throw e;
        }
    }

    async executeOrder(form){
        const [symbol, side, tradeType, indicator, uKey, qty, orderOptions] = form;
        const command = this.getExecuteCommand(side, tradeType);
        const clientOrderId = OkexApi.makeClientOrderIdByUKey(uKey);
        return await this.executeCommand(command, symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions);
    }

    async executeCancelBulk(forms){
        await Promise.all(forms.map(async form =>{
            const [uKey, symobol] = form;
            const clientOrderId = OkexApi.makeClientOrderIdByUKey(uKey);
            return await this.executeCommand('cancelOrder', clientOrderId, symobol);
        }))
    }

    async executeOrderBulk(forms) {
        await Promise.all(forms.map(form => {
            return this.executeOrder(form);
        }));
    }

    async executeCommand(command, ...args) {
        let [endPoint, method, data] = [null, null, null];
        [endPoint, method, data] = this[command](...args);
        const execution = this.makeApiOptiosUseApiProxy(endPoint, method, data);
        await this.sendApiToExchange(execution);
    }
    async initVirtualBalances (userId) {
        for(const asset in exchangeConfig.virtualInitBalance) {
            const balance = exchangeConfig.virtualInitBalance[asset];
            await redisCtrl.setUserBalance(userId, 'okex', asset, balance, true);
        }
    }



    getExecuteCommand(side, tradeType) {
        let command;
        switch (tradeType) {
            case "Limit":
                command = side === 'BUY' ? 'limitBuy' : 'limitSell';
                break;
            case "Market":
                command = side === 'BUY' ? 'marketBuy' : 'marketSell';
                break;
            case "TakeProfitLimit":
                command = side === 'BUY' ? 'limitBuy' : 'limitSell';
                break;
            case "Stop":
                command = 'stopLossLimit';
                break;
            case "Trail":
                command = 'trailing';
                break;
        }
        return command;
    }


    makeVirtualOrderCancelForm(order) {
        return {
            symbol: order.symbol,
            orderId: order.id,
            clientOrderId: OkexApi.makeClientOrderIdByUKey(order.uKey),
            transactTime: Date.now(),
            amount: 0,
            price: 0,
            origQty: order.origQty,
            executedQty: 0,
            status: 'CANCELED',
            timeInForce: order.orderOptions.hasOwnProperty('timeInForce') ? order.orderOptions.timeInForce : 'GTC',
            type: order.tradeType,
            side: order.side,
            commission: {},
            fills: [],
        }
    }

    makeOrderEndForm(order) {
        return {
            symbol: order.symbol,
            orderId: order.id,
            clientOrderId: OkexApi.makeClientOrderIdByUKey(order.uKey),
            transactTime: Date.now(),
            amount: 0,
            price: 0,
            origQty: order.origQty,
            executedQty: 0,
            status: 'END',
            timeInForce: order.orderOptions.hasOwnProperty('timeInForce') ? order.orderOptions.timeInForce : 'GTC',
            type: order.tradeType,
            side: order.side,
            commission: {},
            fills: [],
        }
    }

    makeVirtualOrderReceiptForm(order, price) {
        if(order.price === 0 && order.tradeType === 'Limit')throw new ExchangeApiError({message: 'Invalid price.'});
        if(order.execQty === 0) throw new ExchangeApiError({message: 'Invalid quantity.'});
        return {
            symbol: order.symbol,
            orderId: order.id,
            clientOrderId: OkexApi.makeClientOrderIdByUKey(order.uKey),
            transactTime: Date.now(),
            amount: order.execQty * price,
            price: price,
            origQty: order.execQty,
            executedQty: order.execQty,
            status: order.status,
            timeInForce: order.orderOptions.hasOwnProperty('timeInForce') ? order.orderOptions.timeInForce : 'GTC',
            type: order.tradeType,
            side: order.side,
            commission: {},
            fills: [],
        }
    }

    limitBuy(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'trade/order',
            'POST',
            {
                instId: symbol,
                clOrdId: clientOrderId,
                tdMode: 'cash',
                side: 'buy',
                ordType: 'limit',
                sz: `${qty}`,
                px: `${indicator['enterPrice']}`,
                tgtCcy : 'base_ccy',

            }];
    }

    limitSell(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'trade/order',
            'POST',
            {
                instId: symbol,
                clOrdId: clientOrderId,
                tdMode: 'cash',
                side: 'sell',
                ordType: 'limit',
                sz: `${qty}`,
                px: `${indicator['enterPrice']}`,
                tgtCcy : 'base_ccy',

            }];
    }
    marketBuy(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'trade/order',
            'POST',
            {
                instId: symbol,
                clOrdId: clientOrderId,
                tdMode: 'cash',
                side: 'buy',
                ordType: 'market',
                sz: `${qty}`,
                tgtCcy : 'base_ccy',

            }];
    }
    marketSell(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'trade/order',
            'POST',
            {
                instId: symbol,
                clOrdId: clientOrderId,
                tdMode: 'cash',
                side: 'sell',
                ordType: 'market',
                sz: `${qty}`,
                tgtCcy : 'base_ccy',
            }];
    }

    cancelOrder(clientOrderId, symbol){
        return [
            'trade/cancel-order',
            'POST',
            {
                instId: symbol,
                clOrdId: clientOrderId,
            }];
    }

    async getOrderHistory(symbol, count, startTime, endTime) {
        const data = {
            instType: 'SPOT',
            instId: symbol,
            limit: (count && count > 0 && count < 100) ? `${count}` : `100`
        };
        if(startTime && startTime > 0) {
            data['after'] = startTime;
        }
        if(endTime && endTime > 0) {
            data['before'] = endTime;
        }

        const options = this.makeApiOptiosUseApiProxy('trade/orders-history-archive', 'GET', data);
        const allOrders = await this.sendApiToExchange(options);
        const orderhistory = [];
        allOrders.data.map(order =>{
            orderhistory.push({
                timestamp: parseInt(order['uTime']),
                symbol: order.instId,
                tradeType: order.ordType.toUpperCase(),
                side: order.side.toUpperCase(),
                average: `${order['avgPx'] || 0}`,
                price: `${order['fillPx'] || 0}`,
                excuteQty: `${order['fillSz'] || 0}`,
                amount: `${order['fillSz'] || 0}`,
                total: `${order['fillPx'] *  order['fillSz'] || 0}`,
                status: order['state'].toUpperCase(),
            })
        });
        return orderhistory;
    }
    async getAssets() {
        const options = this.makeApiOptiosUseApiProxy('account/balance', 'GET');
        const response = await this.sendApiToExchange(options);
        let balances = [];
        for(let balance of response.data[0].details) {
            const myBlance = parseFloat(balance['availBal']);
            const myLocked = parseFloat(balance['frozenBal']);
            balances.push({asset: balance.ccy, free:myBlance, locked: myLocked});
        }
        return balances;
    }

    async marketDataRefresh () {
        const {exchangeMarketList, exchangeSymbolList} = await this.getExchangeInfos();
        const savedMarketKeyList = await redisCtrl.getMarketListKeys('okex');
        const promises = [];
        const newSymbolList = [];
        for(const symbol of exchangeSymbolList) {
            if(!savedMarketKeyList.includes(symbol)) {
                promises.push(redisCtrl.setMarketListKey('okex', symbol));
                newSymbolList.push(symbol);
            }
        }
        for(const symbol of savedMarketKeyList) {
            if(!exchangeSymbolList.includes(symbol)) {
                promises.push(redisCtrl.deleteMarketListKey('okex', symbol));
                promises.push(redisCtrl.deleteMarketData('okex', symbol));
            }
        }
        promises.push(redisCtrl.setAllMarketData('okex', exchangeMarketList));
        await Promise.all(promises);
        return newSymbolList;
    }

    async getAllMarket() {
        const result = await redisCtrl.getAllMarketData(this.exchange);
        return Object.values(result).map(marketData => {
            const data = JSON.parse(marketData);
            const [base, quote] = data.symbol.split('-');
            data['base'] = base;
            data['quote'] = quote;
            return data;
        });
    }

    async getAllPrice() {
        const options = this.makeApiOptiosUseApiProxy('market/tickers', 'GET', {instType:'SPOT'});
        const result = await this.sendApiToExchange(options);
        return result.data.filter(obj => exchangeConfig.availableMarketList.includes(obj.instId.split('-').slice(-1)[0]));
    }

    async getExchangeInfos() {
        const options = this.makeApiOptiosUseApiProxy('public/instruments', 'GET', {instType:'SPOT'});
        const results = await this.sendApiToExchange(options);
        let marketList = [];
        let symbolList = [];
        for ( let obj of results.data ) {
            if(obj.state != 'live' || !exchangeConfig.availableMarketList.includes(obj.quoteCcy)) {
                continue;
            }
            marketList.push({
                status: 'TRADING',
                symbol: obj.instId,
                // minNotional,
                // minPrice,
                // maxPrice,
                tickSize: defaultSatoshiValue(obj.tickSz),
                stepSize: defaultSatoshiValue(obj.lotSz),
                minQty: defaultSatoshiValue(obj.minSz),
                //maxQty
            });
            symbolList.push(obj.instId);
        }
        return {exchangeMarketList: marketList, exchangeSymbolList: symbolList};
    }

    async getOhlcHistory(symbol, period, from, to, count=100) {
        const ohlcData = {instId: symbol, bar: timeUnits[period], limit:count};
        if(from) {
            ohlcData['before'] = new Date(from).getTime();
        }
        if(to) {
            ohlcData['after'] = new Date(to).getTime();
        }
        const options = this.makeApiOptiosUseApiProxy('market/candles', 'GET', ohlcData);
        const result = await this.sendApiToExchange(options);
        return result.data;
    }

    async makeSocketActualOrderReceiptForm (response) {
        const commissions = {};
        const [base, quote] = response.instId.split('-');
        const commission = response['fillFee'] * -1;
        const filledPrice = response['fillPx'];
        let executedQty = response['fillSz'];
        commissions[response['fillFeeCcy']] = commission;
        const amount = (response['fillFeeCcy'] == base) ? (filledPrice * (executedQty - commission)) :
            (response['fillFeeCcy'] == quote) ? (filledPrice * executedQty) - commission : filledPrice * executedQty;

        if(commissions[base]) executedQty -= commissions[base];

        return {
            symbol: response.instId,
            orderId: response['ordId'],
            clientOrderId: response['clOrdId'],
            transactTime: response['uTime'],
            status: response['state'] === 'live' ? 'NEW' : response['state'].toUpperCase(),
            // timeInForce: response['f'],
            type: response['ordType'].toUpperCase(),
            side: response['side'].toUpperCase(),
            origQty: response['sz'],
            price: filledPrice,
            executedQty: executedQty,
            amount: amount,
            commission: commissions
        }
    }

    async checkApi(){
        try {
            const options = this.makeApiOptiosUseApiProxy('account/config', 'GET');
            const result = await this.sendApiToExchange(options);
            if(parseInt(result.data[0].acctLv) !== 1){
                throw new ExchangeOperationNotSupportedAccountModeError();
            }
        }catch (e) {
            if(e.constructor.name === 'ExchangeOperationNotSupportedAccountModeError') {
                throw e;
            }
            throw new ExchangeAccessKeyInvalidError();
        }
    }

    static async checkBalance(userId, direction, isVirtual, exchange, symbol, qty, enterPirce){
        const [base, quote] = symbol.split('-');
        let asset = ['B2S', 'BUY'].includes(direction) ? quote : base;
        const userBalance = await redisCtrl.getUserBalance(userId, exchange, asset, isVirtual);
        if (!userBalance || userBalance.free <= 0) throw new ExchangeBalanceInsufficienntError('No Userbalance or less than zero');
        let decreaseValue = 0;
        if(enterPirce && qty) {
            decreaseValue = ['B2S', 'BUY'].includes(direction) ? enterPirce * qty : qty
        }
        if(decreaseValue > userBalance.free) throw new ExchangeBalanceInsufficienntError('The order amount is larger than the Userbalance.');
    }

    static makeClientOrderIdByUKey(uKey) {
        return `${exchangeConfig.brokerKey}${uKey.replace('-', '')}`
    }

    static getUKeyByClientOrderId(clientOrderId){
        return `${clientOrderId.substr(16,8)}-${clientOrderId.substr(24)}`;
    }
}

module.exports = OkexApi;