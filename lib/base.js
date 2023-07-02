"use strict";

const env = process.env.NODE_ENV || "development";
const path = require('path');
const etsSpotCommon = (env === 'product') ? require('@aitraum/ets-spot-common.git') : require(path.resolve('./common'));
const redisCtrl = etsSpotCommon.redisCtrl;
const config = etsSpotCommon.config;
const { timeout, retryWrapper, decipherAPIkey } = etsSpotCommon.utils;
const { ExchangeServerRequestTimeOutError, ExchangeServerInternalError } = etsSpotCommon.error;
const logger = etsSpotCommon.logger;
const util = require('util');
const WebSocket = require('ws');

async function sendApiProxy(options, retryCount) {
    await logger.infoConsole(`ExchangeAPI - Response Options:${options.uuid}`, options);
    await retryWrapper(redisCtrl.pushApiProxyQueue, JSON.stringify(options));
    const response = await retryWrapper(redisCtrl.listenApiProxyResponse, options.uuid, 5);
    if(!response) throw new ExchangeServerRequestTimeOutError();
    const [key, value] = response;
    const responseValue = JSON.parse(value);
    await logger.infoConsole(`ExchangeAPI - Response Value:${options.uuid}`, responseValue);
    if(!responseValue.body || responseValue.status_code >= 500) {
        if (retryCount > 3){
            throw new ExchangeServerInternalError();
        }
        await timeout(500);
        return await sendApiProxy(options, retryCount+1);
    }else{
        return responseValue;
    }
};

class ApiBase {
    constructor (cipherKeys, salt) {
        if(!cipherKeys) {
            this.apiKey = '';
            this.secretKey = '';
        }
        else {
            const decApi = decipherAPIkey(cipherKeys.apiKey, cipherKeys.secretKey, salt);
            this.apiKey = decApi.apiKey;
            this.secretKey = decApi.secretKey;
        }
    }

    async sendApiToExchange (options, retryCount) {
        try {
            return await sendApiProxy(options, retryCount);
        }
        catch (e) {
            throw e;
        }
    }
}

class SocketBase {
    constructor(exchangeName, userName, endPoint) {
        this.exchangeName = exchangeName.toUpperCase();
        this.endPoint = endPoint;
        this.userName = userName;
        this.flags = true;
        this.client = new WebSocket(endPoint);
        this.client.binaryType = 'arraybuffer';
        this.startTime = new Date();
    }

    async onOpen(arg) {
        console.log(`${this.exchangeName} :: ${this.userName} WS Connection Success! - ${new Date()}`);
    }

    async onClose(arg) {
        console.log(`${this.exchangeName} :: ${this.userName} WS Connection Closed! - ${new Date()}`);
        this.flags = false;
    }

    async onError(arg) {
        console.log(`${this.exchangeName} :: ${this.userName} :: Error - ${util.inspect(arg.message, false, null, true)}`);
        this.flags = false;
    }
}

exports.ApiBase = ApiBase;
exports.SocketBase = SocketBase;