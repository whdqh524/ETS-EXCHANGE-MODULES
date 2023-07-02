"use strict";

const qs = require('qs');
const uuidv4 = require('uuid').v4;
const crypto = require('crypto');
const env = process.env.NODE_ENV || "development";
const path = require('path');
const etsSpotCommon = (env === 'product') ? require('@aitraum/ets-spot-common.git') : require(path.resolve('./common'));
const { NotInputExchangeApiKeyError, NeedCheckApiKeyError } = etsSpotCommon.error;
const exchangeConfig = require('./env');
const redisCtrl = etsSpotCommon.redisCtrl;
const { symbolChange } = etsSpotCommon.utils;
const { ExchangeApiError, APIKeyInvalidError, NotEnoughBalanceError } = require('./error');
const logger = etsSpotCommon.logger;
const { ApiBase } = require('../base');



const timeUnits = {
    "1":"1m",
    "5":"5m",
    "15":"15m",
    "30":"30m",
    "60":"1h",
    "240":"4h",
    "1440":"1d",
};

class BinanceApi extends ApiBase {
    constructor (user) {
        if(!user) {
            super();
        }
        else {
            if(!user.apiKeyMap['binance']) {
                throw new NotInputExchangeApiKeyError();
            }
            if(user.apiKeyMap['binance'].alive != true) {
                throw new NeedCheckApiKeyError();
            }
            super(user.apiKeyMap['binance'], user.salt);
        }
        this.hostUrl = 'https://api.binance.com/api/v3/';
        this.userEndPointList = [
            'order', 'account', 'myTrades', 'allOrders','openOrders'
        ];
    }

    static changeCoin (symbol) {
        let str = symbol;
        let data = {};
        let strcmp = str.slice(str.length-4, str.length);
        if(strcmp.match('BTC')){
            const strcmp2 = str.slice(str.length-3, str.length);
            const results = str.replace(strcmp2,'');
            data = {quote:'BTC',base:results,symbol:results+'-BTC'};
        }else if(strcmp.match('BNB')) {
            const strcmp2 = str.slice(str.length-3, str.length);
            const results = str.replace(strcmp2,'');
            data = {quote:'BNB',base:results,symbol:results+'-BNB'};
        }
        else if(strcmp.match('USDT')){
            const strcmp2 = str.slice(str.length-4, str.length);
            const results = str.replace(strcmp2,'');
            data = {quote:'USDT',base:results,symbol: results+'-USDT'};
        }else{
            data = null;
        }
        return data;
    }

    makeReqObjPost (url, method = 'POST', data = {}, params = {}) {
        return {
            url: url,
            params: params,
            data: data,
            method: method,
            headers: {
                'X-MBX-APIKEY': this.apiKey
            }
        };
    }

    makeReqObj (url, method = 'GET', params) {
        return {
            url: url,
            params: params,
            data: {},
            method: method,
            headers: {
                'X-MBX-APIKEY': this.apiKey
            }
        }
    }

    makeApiOptiosUseApiProxy (endPoint, method, data = {}) {
        if(this.userEndPointList.includes(endPoint)) {
            data.timestamp = Date.now();
            data.recvWindow = 19999;
            const dataQueryString = qs.stringify(data);
            data.signature = crypto.createHmac('sha256', this.secretKey).update(dataQueryString).digest('hex');
        }

        let options;
        switch(method) {
            case 'POST':
                options = this.makeReqObjPost(`${this.hostUrl}${endPoint}`, method, data);
                break;
            case 'GET':
                options = this.makeReqObj(`${this.hostUrl}${endPoint}`, method, data);
                break;
            case 'PUT':
                options = this.makeReqObj(`${this.hostUrl}${endPoint}`, method, data);
                break;
            case 'DELETE':
                options = this.makeReqObj(`${this.hostUrl}${endPoint}`, method, data);
                break;
        }
        options.uuid = uuidv4();
        return options;
    };

    async sendApiToExchange(options, retryCount=1) {
        try {
            // console.log('options : ',options);
            const response = await super.sendApiToExchange(options, retryCount);
            const responseBody = JSON.parse(response.body);
            if(!(200 <= response.status_code && response.status_code < 300)) {
                const options = {
                    exchangeCode : responseBody.code,
                    status_code: response.status_code,
                    message: responseBody.msg,
                };
                throw new ExchangeApiError(options);
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
        const command = await this.getExecuteCommand(side, tradeType);
        const clientOrderId = BinanceApi.makeClientOrderIdByUKey(uKey);
        return await this.executeCommand(command, symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions);
    }

    async executeCancelBulk(forms){
        return await Promise.all(forms.map(async form =>{
            const [uKey, symobol] = form;
            const clientOrderId = BinanceApi.makeClientOrderIdByUKey(uKey);
            return await this.executeCommand('cancelOrder', clientOrderId, symobol);
        }))
    }

    async executeOrderBulk(forms) {
        await Promise.all(forms.map(form => {
            return this.executeOrder(form);
        }));
    }

    async getExecuteCommand(side, tradeType) {
        let command;
        switch (tradeType) {
            case "Limit":
                command = side == 'BUY' ? 'limitBuy' : 'limitSell';
                break;
            case "Market":
                command = side == 'BUY' ? 'marketBuy' : 'marketSell';
                break;
            case "TakeProfitLimit":
                command = side == 'BUY' ? 'limitBuy' : 'limitSell';
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

    async executeCommand (command, ...args) {
        let [endPoint, method, data] = [null, null, null];
        [endPoint, method, data] = await this[command](...args);
        const execution = await this.makeApiOptiosUseApiProxy(endPoint, method, data);
        const response = await this.sendApiToExchange(execution);
        return this.makeReturnForm(response)
    }

    makeReturnForm(response) {
        if(response.status !== 'REJECTED') {
            return this.makeRestApiActualOrderReceiptForm(response);
        }
        return response;
    }

    async makeSocketActualOrderReceiptForm (response) {
        const commissions = {};
        const symbolInfo = BinanceApi.changeCoin(response['s']);
        const commission = response['n'];
        const filledPrice = response['L'];
        let executedQty = response['l'];
        commissions[response['N']] = commission;
        const amount = (response['N'] == symbolInfo.base) ? (filledPrice * (executedQty - commission)) :
            (response['N'] == symbolInfo.quote) ? (filledPrice * executedQty) - commission : filledPrice * executedQty;

        if(commissions[symbolInfo.base])  executedQty -= commissions[symbolInfo.base];

        return {
            symbol: response['s'],
            orderId: response['i'],
            clientOrderId: response['c'],
            transactTime: response['E'],
            status: response['X'],
            timeInForce: response['f'],
            type: response['o'],
            side: response['S'],
            origQty: response['q'],
            price: filledPrice,
            executedQty: executedQty,
            amount: amount,
            commission: commissions
        }
    }

    async makeRestApiActualOrderReceiptForm (response) {
        const symbolInfo = BinanceApi.changeCoin(response['symbol']);
        const commissions = {};
        let totalAmount = 0;
        let totalExecutedQty = 0;
        if(response.fills && response.fills.length > 0) {
            for(const fill of response.fills) {
                let commission = parseFloat(fill['commission']);
                const filledPrice = parseFloat(fill['price']);
                let executedQty = parseFloat(fill['qty']);
                if(!commissions[fill['commissionAsset']]) {
                    commissions[fill['commissionAsset']] = commission;
                }
                else {
                    commissions[fill['commissionAsset']] += commission;
                }
                const amount = (fill['commissionAsset'] == symbolInfo.base) ? (filledPrice * (executedQty - commission)) :
                    (fill['commissionAsset'] == symbolInfo.quote) ? (filledPrice * executedQty) - commission : filledPrice * executedQty;
                if(commissions[symbolInfo.base])  executedQty -= commissions[symbolInfo.base];
                totalAmount += amount;
                totalExecutedQty += executedQty
            }
        }
        const filledPrice = totalAmount / totalExecutedQty;
        return {
            symbol: response['symbol'],
            orderId: response['orderId'],
            clientOrderId: (response['status'] === 'CANCELED') ? response['origClientOrderId'] : response['clientOrderId'],
            transactTime: response['transactTime'],
            status: response['status'],
            timeInForce: response['timeInForce'],
            type: response['type'],
            side: response['side'],
            origQty: response['origQty'],
            price: filledPrice,
            executedQty: totalExecutedQty,
            amount: totalAmount,
            commission: commissions,
            fills: response['fills']
        }
    }


    makeVirtualOrderReceiptForm(order, price) {
        if(order.price === 0 && order.tradeType === 'Limit')throw new ExchangeApiError({message: 'Invalid price.'});
        if(order.execQty === 0)throw new ExchangeApiError({message: 'Invalid quantity.'});
        return {
            symbol: order.symbol,
            orderId: order.id,
            clientOrderId: BinanceApi.makeClientOrderIdByUKey(order.uKey),
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

    makeVirtualOrderCancelForm(order) {
        return {
            symbol: order.symbol,
            orderId: order.id,
            clientOrderId: BinanceApi.makeClientOrderIdByUKey(order.uKey),
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
            clientOrderId: BinanceApi.makeClientOrderIdByUKey(order.uKey),
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

    async initVirtualBalances (userId) {
        for(const asset in exchangeConfig.virtualInitBalance) {
            const balance = exchangeConfig.virtualInitBalance[asset];
            await redisCtrl.setUserBalance(userId, 'binance', asset, balance, true);
        }
    }


    async limitBuy(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'order',
            'POST',
            {
                newClientOrderId: clientOrderId,
                symbol: symbolChange(symbol),
                side: 'BUY',
                type: 'LIMIT',
                quantity: `${qty}`,
                price: `${indicator['enterPrice']}`,
                timeInForce: orderOptions.hasOwnProperty('timeInForce') ? orderOptions.timeInForce : 'GTC',
                timestamp: new Date().getTime()
            }];
    }
    async limitSell(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'order',
            'POST',
            {
                newClientOrderId: clientOrderId,
                symbol: symbolChange(symbol),
                side: 'SELL',
                type: 'LIMIT',
                quantity: `${qty}`,
                price: `${indicator['enterPrice']}`,
                timeInForce: 'GTC',
                timestamp: new Date().getTime()
            }];
    }
    async marketBuy(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'order',
            'POST',
            {
                newClientOrderId: clientOrderId,
                symbol: symbolChange(symbol),
                side: 'BUY',
                type: 'MARKET',
                quantity: `${qty}`,
                timestamp: new Date().getTime()
            }];
    }
    async marketSell(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'order',
            'POST',
            {
                newClientOrderId: clientOrderId,
                symbol: symbolChange(symbol),
                side: 'SELL',
                type: 'MARKET',
                quantity: `${qty}`,
                timestamp: new Date().getTime()
            }];
    }

    async takeProfitLimit(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'order',
            'POST',
            {
                newClientOrderId: clientOrderId,
                symbol: symbolChange(symbol),
                side: side,
                type: 'TAKE_PROFIT_LIMIT',
                price: `${indicator['enterPrice']}`,
                stopPrice: `${indicator['triggerPrice']}`,
                quantity: `${qty}`,
                timeInForce: orderOptions.hasOwnProperty('timeInForce') ? orderOptions.timeInForce : 'GTC',
                timestamp: new Date().getTime()
            }];
    }

    async takeProfitMarket(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'order',
            'POST',
            {
                newClientOrderId: clientOrderId,
                symbol: symbolChange(symbol),
                side: side,
                type: 'TAKE_PROFIT',
                stopPrice: `${indicator['enterPrice']}`,
                quantity: `${qty}`,
                timestamp: new Date().getTime()
            }];
    }

    async stopLossLimit(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'order',
            'POST',
            {
                newClientOrderId: clientOrderId,
                symbol: symbolChange(symbol),
                side: side,
                type: 'STOP_LOSS_LIMIT',
                price: `${indicator['enterPrice']}`,
                stopPrice: `${indicator['triggerPrice']}`,
                quantity: qty,
                timeInForce: orderOptions.hasOwnProperty('timeInForce') ? orderOptions.timeInForce : 'GTC',
                timestamp: new Date().getTime()
            }];
    }

    async stopLossMarket(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions) {
        return [
            'order',
            'POST',
            {
                newClientOrderId: clientOrderId,
                symbol: symbolChange(symbol),
                side: side,
                type: 'STOP_LOSS',
                stopPrice: `${indicator['triggerPrice']}`,
                quantity: qty,
                timestamp: new Date().getTime()
            }];
    }

    async cancelOrder(clientOrderId, symbol){
        const uuid = uuidv4();
        const randomStr = uuid.slice(0,13);
        return [
            'order',
            'DELETE',
            {
                symbol: symbolChange(symbol),
                origClientOrderId: clientOrderId,
                newClientOrderId: BinanceApi.makeClientOrderIdByUKey(randomStr),
            }];
    }

    async cancelOpenOrders(symbol, side, tradeType, indicator, clientOrderId, qty, orderOptions){
        return [
            'openOrders',
            'DELETE',
            {
                symbol: symbolChange(symbol),
            }];
    }

    async modify(){

    }

    async getAssets() {
        const options = this.makeApiOptiosUseApiProxy('account', 'GET');
        const response = await this.sendApiToExchange(options);

        let balances = [];
        for(let balance of response.balances) {
            if(parseFloat(balance.free) <= 0 && parseFloat(balance.locked) <= 0) {
                continue;
            }
            // const myBlance = roundTicker(0.000001,7,parseFloat(balance.free));
            // const myLocked = roundTicker(0.000001,7,parseFloat(balance.locked));
            const myBlance = parseFloat(balance.free);
            const myLocked = parseFloat(balance.locked);
            balances.push({asset: balance.asset, free:myBlance,locked: myLocked});
        }
        return balances;
    }

    async getOrderStatus(symbol, exchangeOrderId) {
        const options = this.makeApiOptiosUseApiProxy('order', 'GET', );
        const result = await this.sendApiToExchange(options);
        result.transactTime = result.updateTime;
        return result;
    }

    async getMyTradeRecent(symbol) {
        return ['myTrades', 'GET', {symbol: symbolChange(symbol), limit: 50}];
    }

    async getAllMarket() {
        const result = await redisCtrl.getAllMarketData('binance');
        return Object.values(result).map(market => {return JSON.parse(market)});
        // const options = this.makeApiOptiosUseApiProxy('exchangeInfo', 'GET', );
        // return await this.sendApiToExchange(options);
    }

    async getAllPrice() {
        const options = this.makeApiOptiosUseApiProxy('ticker/price', 'GET');
        const result = await this.sendApiToExchange(options);
        return result;
    }

    async getExchangeInfos() {
        const options = this.makeApiOptiosUseApiProxy('exchangeInfo', 'GET');
        const results = await this.sendApiToExchange(options);
        let marketList = [];
        let symbolList = [];
        for ( let obj of results.symbols ) {
            if(obj.status != 'TRADING') {
                continue;
            }
            const symbol = `${obj.baseAsset}-${obj.quoteAsset}`;
            if(!exchangeConfig.availableMarketList.includes(obj.quoteAsset)) {
                continue;
            }
            let market = {status: obj.status, symbol: symbol};
            for ( let filter of obj.filters ) {
                if ( filter.filterType == "MIN_NOTIONAL" ) {
                    market.minNotional = filter.minNotional;
                } else if ( filter.filterType == "PRICE_FILTER" ) {
                    market.minPrice = filter.minPrice;
                    market.maxPrice = filter.maxPrice;
                    market.tickSize = filter.tickSize;
                } else if ( filter.filterType == "LOT_SIZE" ) {
                    market.stepSize = filter.stepSize;
                    market.minQty = filter.minQty;
                    market.maxQty = filter.maxQty;
                }
            }
            marketList.push(market);
            symbolList.push(symbol);
        }
        return {exchangeMarketList: marketList, exchangeSymbolList: symbolList};
    }

    async getTicker(symbol) {
        const data = {};
        let availbleTradingSymbols;
        if(symbol) {
            data.symbol = symbolChange(symbol);
        }
        else {
            availbleTradingSymbols = await redisCtrl.getMarketListKeys('binance');
        }
        const options = this.makeApiOptiosUseApiProxy('ticker/24hr', 'GET', data);
        const tickers = await this.sendApiToExchange(options);
        if(!availbleTradingSymbols) {
            return tickers;
        }
        // (ticker.symbol.match('BTC') || ticker.symbol.match('USDT'))
        const result = tickers.filter(ticker => {
            return ( Binance.changeCoin(ticker.symbol) && availbleTradingSymbols.includes(Binance.changeCoin(ticker.symbol).symbol));
        }).map(ticker => {
            return this.makeTickerForm(ticker);
        });
        return result;
    }

    async getRecentTrades(symbol, count=40) {
        const options = this.makeApiOptiosUseApiProxy('trades', 'GET', {symbol:symbolChange(symbol), limit:count});
        const response = await this.sendApiToExchange(options);
        const result = response.map((trade) => {
            return this.makeTradeForm(trade);
        });
        return result;
    }

    async getOrderBook(symbol, limit=20) {
        const options = this.makeApiOptiosUseApiProxy('depth', 'GET', {symbol:symbolChange(symbol),limit: limit});
        const result = await this.sendApiToExchange(options);
        return [result.bids, result.asks];
    }

    async getOhlc(symbol, period, count=500) {
        const options = this.makeApiOptiosUseApiProxy('klines', 'GET', {symbol:symbolChange(symbol), interval:timeUnits[period], limit: count});
        const result = await this.sendApiToExchange(options);
        return result;
    }

    async getOhlcHistory(symbol, period, from, to, count=500) {
        const ohlcData = {symbol: symbolChange(symbol), interval: timeUnits[period], limit:count};
        if(from) {
            ohlcData['startTime'] = new Date(from).getTime();
        }
        if(to) {
            ohlcData['endTime'] = new Date(to).getTime();
        }
        const options = this.makeApiOptiosUseApiProxy('klines', 'GET', ohlcData);
        return await this.sendApiToExchange(options);
    }

    async getOrderHistory(symbol, count, startTime, endTime) {
        const data = {
            symbol: symbolChange(symbol),
            limit: (count && count > 0) ? count : 500
        };
        if(startTime && startTime > 0) {
            data['startTime'] = startTime;
        }
        if(endTime && endTime > 0) {
            data['endTime'] = endTime;
        }

        const options = this.makeApiOptiosUseApiProxy('allOrders', 'GET', data);
        const allOrders = await this.sendApiToExchange(options);
        const orderhistory = [];
        allOrders.filter(order =>{
            return order.status !== 'NEW'
        }).map(order =>{
            if(order.type == 'MARKET' && order.price == 0) order.price = order.cummulativeQuoteQty / order.executedQty;
            orderhistory.push({
                timestamp: order['time'],
                symbol: order.symbol,
                tradeType: order.type,
                side: order.side,
                average: `${order.price}`,
                price: `${order.price}`,
                excuteQty: `${order.executedQty}`,
                amount: `${order.executedQty}`,
                total: `${order.cummulativeQuoteQty}`,
                status: order.status,
            })
        });
        return orderhistory;
    }

    async calcReceipt (receipt, fill) {
        const symbolInfo = Binance.changeCoin(receipt.symbol);
        const commissions = {};
        let qty = parseFloat(Math.abs(fill.qty));
        if(fill.commissionAsset == "BNB") {
            if(!commissions["BNB"]) {
                commissions["BNB"] = 0;
            }
            commissions["BNB"] += parseFloat(fill.commission);
        }
        else {
            if(receipt.side == "BUY") {
                if(fill.commissionAsset == symbolInfo.base) {
                    if(!commissions[symbolInfo.base]) {
                        commissions[symbolInfo.base] = 0;
                    }
                    commissions[symbolInfo.base] += parseFloat(fill.commission);
                }
            }
            else {
                if(fill.commissionAsset == symbolInfo.quote) {
                    if(!commissions[symbolInfo.quote]) {
                        commissions[symbolInfo.quote] = 0;
                    }
                    commissions[symbolInfo.quote] += parseFloat(fill.commission);
                }
            }
        }


        const totalQty = qty;
        const totalAmount = ((fill.price) ? parseFloat(fill.price) : parseFloat(receipt.price)) * totalQty;
        return {amount: totalAmount, qty:totalQty, commissions:commissions}
    }

    async getOrderReceiptPrice(receipt) {
        let totalAmount = 0;
        let totalQty = 0;
        let totalCommission = {};

        if(receipt.status == "NEW") {
            return {
                totalAmount:totalAmount.toFixed(8),
                totalQty:totalQty.toFixed(8),
                totalCommission:totalCommission
            };
        }
        if(!receipt.fills || receipt.fills.length == 0) {
            const recentTrades = await this.getMyTradeRecent(Binance.changeCoin(receipt.symbol).symbol);
            const myTrades = recentTrades.filter(trade => {
                return (trade.orderId == receipt.orderId);
            });

            if(myTrades.length > 0) {
                for (let myTrade of myTrades) {
                    const {amount, qty, commissions} = await this.calcReceipt(receipt, myTrade);
                    totalAmount += amount;
                    totalQty += qty;
                    for(const asset in commissions) {
                        if(!totalCommission[asset]) {
                            totalCommission[asset] = 0;
                        }
                        totalCommission[asset] += commissions[asset];
                    }
                }
            }
            else {
                totalAmount = parseFloat(receipt.price) * parseFloat(receipt.executedQty);
                totalQty = parseFloat(receipt.executedQty);
                totalCommission = {};
            }
        }
        else {
            for (let fill of receipt.fills) {
                const {amount, qty, commissions} = await this.calcReceipt(receipt, fill);
                totalAmount += amount;
                totalQty += qty;
                for(const asset in commissions) {
                    if(!totalCommission[asset]) {
                        totalCommission[asset] = 0;
                    }
                    totalCommission[asset] += commissions[asset];
                }
            }
        }
        console.log(`totalAmount: ${totalAmount}, totalQty: ${totalQty}, totalCommission:${totalCommission}`);
        return {totalAmount:totalAmount.toFixed(8), totalQty:totalQty.toFixed(8), totalCommission:totalCommission};
    }

    calcBuyCommission (symbol, commissionInfo) {
        const base = symbol.split('-')[0];
        return (commissionInfo[base]) ? commissionInfo[base] : 0
    }

    calcSellCommission (symbol, commissionInfo) {
        const quote = symbol.split('-')[1];
        return (commissionInfo[quote]) ? commissionInfo[quote] : 0
    }

    async marketDataRefresh () {
        const {exchangeMarketList, exchangeSymbolList} = await this.getExchangeInfos();
        const savedMarketKeyList = await redisCtrl.getMarketListKeys('binance');
        const promises = [];
        const newSymbolList = [];
        for(const symbol of exchangeSymbolList) {
            if(!savedMarketKeyList.includes(symbol)) {
                promises.push(redisCtrl.setMarketListKey('binance', symbol));
                newSymbolList.push(symbol);
            }
        }
        for(const symbol of savedMarketKeyList) {
            if(!exchangeSymbolList.includes(symbol)) {
                promises.push(redisCtrl.deleteMarketListKey('binance', symbol));
                promises.push(redisCtrl.deleteMarketData('binance', symbol));
            }
        }
        promises.push(redisCtrl.setAllMarketData('binance', exchangeMarketList));
        await Promise.all(promises);
        return newSymbolList;
    }

    async listenKeyCreate(){
        const options = this.makeApiOptiosUseApiProxy('userDataStream', 'POST');
        const listenKey = await this.sendApiToExchange(options);
        return listenKey;
    }
    async listenKeyUpdate(listenKey){
        const options = this.makeApiOptiosUseApiProxy('userDataStream', 'PUT',{listenKey:listenKey});
        await this.sendApiToExchange(options);
        return {message : 'listenKey Update Success'};
    }
    async listenKeyDelete(listenKey){
        const options = this.makeApiOptiosUseApiProxy('userDataStream', 'DELETE',{listenKey:listenKey});
        await this.sendApiToExchange(options);
        return {message : 'listenKey Update Success'};
    }

    async checkApi(){
        try {
            await this.getAssets();
        }catch (e) {
            throw new APIKeyInvalidError();
        }
    }

    static async checkBalance(userId, direction, isVirtual, exchange, symbol, qty, enterPirce){
        const [base, quote] = symbol.split('-');
        let asset = ['B2S', 'BUY'].includes(direction) ? quote : base;
        const userBalance = await redisCtrl.getUserBalance(userId, exchange, asset, isVirtual);
        if (!userBalance || userBalance.free <= 0) throw new NotEnoughBalanceError('No Userbalance or less than zero');
        let decreaseValue = 0;
        if(enterPirce && qty) {
            decreaseValue = ['B2S', 'BUY'].includes(direction) ? enterPirce * qty : qty
        }
        if(decreaseValue > userBalance.free) throw new NotEnoughBalanceError('The order amount is larger than the Userbalance.');
    }


    static makeClientOrderIdByUKey(uKey) {
        return `x-${exchangeConfig.brokerKey}-${uKey}`;
    }

    static getUKeyByClientOrderId(clientOrderId){
        return clientOrderId.split(`x-${exchangeConfig.brokerKey}-`)[1];
    }

}

module.exports = BinanceApi;