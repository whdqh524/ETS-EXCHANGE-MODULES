'use strict';

const env = process.env.NODE_ENV || "development";
const { EtsError } = (env == 'product') ? require('@aitraum/ets-spot-common.git').error : require('../../../common/modules/error');


let filterfailureErrorMap = {};
let rejectedErrorMap = {};
let codeErrorMap = {};



class ExchangeApiError extends EtsError{
    constructor (errForm) {
        super(errForm);
        if(this.constructor.name === 'ExchangeApiError') {
            const errClass = getExchangeApiSubErrorCode(errForm.message, errForm.exchangeCode);
            return new errClass(errForm);
        }
    }
}
exports.ExchangeApiError = ExchangeApiError;


function getExchangeApiSubErrorCode(message, code) {
    let errClass;
    const errMsg = message.replace(/ /g,"");
    if (rejectedErrorMap[errMsg]) return getRejectedErrorClass(errMsg);
    if (errMsg.match('Filterfailure:')) return getFilterfailureErrorClass(errMsg);
    errClass = getCodeErrorClass(code);
    if(!errClass) errClass = UnkownExchangeApiError;
    return errClass;
}

function getFilterfailureErrorClass(errMsg) {
    return filterfailureErrorMap[errMsg];
}
function getRejectedErrorClass(errMsg) {
    return rejectedErrorMap[errMsg];
}

function getCodeErrorClass(code) {
    const errCode = String(code);
    return codeErrorMap[errCode];
}



class FilterFailurePriceFilter extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_PRICE_SYMBOL"
    }
}


class FilterFailurePercentPrice extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_PRICE_PERCENT"
    }
}


class FilterFailureLotSizeError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_QUANTITY_SIZE"
    }
}

class FilterFailureMinNotionalError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MIN_NOTIONAL"
    }
}

class FilterFailureMarketLotSizeError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_MARKETPRICE_SYMBOL"
    }
}

class FilterFailureMaxNumOrdersError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_OPENORDER_SYMBOL"
    }
}

class FilterFailureMaxAlgoOrdersError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_CLOSEORDER_SYMBOL"
    }
}


class FilterFailureExchangeMaxNumOrdersError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_OPENORDER_EXCHANGE"
    }
}

class FilterFailureExchangeMaxAlgoOrders extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_CLOSEORDER_EXCHANGE"
    }
}

class FilterFailureMaxNumAlgoOrdersError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OVER_CLOSEORDER_EXCHANGE";
    }
}

class InvalidQuantityError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_QUANTITY_ZERO";

    }
}

class InvalidPriceError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PRICE_ZERO";

    }
}

class StopPriceWouldTriggerImmediatelyError extends  ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = 'EX_NOT_STOPLOSS_TRIGGER';
    }

}


class UnknownOrderSentError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_FOUND_ORDERID";

    }
}

class DuplicateOrderSentError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_DUPLICATE_ORDER";
    }
}

class NotEnoughBalanceError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INSUFFICIENT_BALANCE";
    }
}
exports.NotEnoughBalanceError = NotEnoughBalanceError;




class MarketisClosedError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CLOSED_SYMBOL";

    }
}

class MarketOrderNotSupportedSymbolError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ENABLED_MARKETORDER";

    }
}

class StoplossNotSupportedSymbolError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ENABLED_STOPORDER";

    }
}

class StoplossLimitNotSupportedSymbolError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ENABLED_STOPLIMIT";

    }
}

class TakeProfitNotSupportedSymbolError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ENABLED_PROFITORDER"

    }
}
class TakeProfitLimitNotSupportedSymbolError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ENABLED_PROFITLIMIT"

    }
}

class AmountZeroOfLessError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_LOW_BALANCE";
    }
}
class ActionDisabledAccountError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_BINACEACCOUNT_ERROR";
    }
}

class UnsupportedOrderCombinationError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_SUPPORT_ORDER";
    }
}

class OrderTriggerImmediatelyError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_STOPLOSS_TRIGGER";
    }
}
class CancelOrderInvalidError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NONE_SENT_ORDERID";
    }
}

class ExchangeServerDisconnectedError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_LOST_CONNECTION_1001";
    }
}
class UnauthorizedError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_API_CANNOT_ORDER_1002";
    }
}
class RequestManyError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_REQUEST_LARGE_1003";
    }
}
class ServerBusyError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SERVER_BUSY_1004";
    }
}
class UnknownResponseError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_UNEXPECTED_RESPONSE_1006";
    }
}
class ServerResponseTimeoutError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_REQUEST_TIMEOUT_1007";
    }
}
class UnsupportedOrderCompositionError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_UNSUPPORTED_ORDER_1014";
    }
}
class OrderLimitCountError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_TOO_MANY_ORDER_1015";
    }
}
class ServiceShuttingDownError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NO_LONGER_SERVICE_1016";
    }
}

class UnsupportedOperationError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_SUPPRT_OPERATION_1020";
    }
}

class InvalidTimestampError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_TIMESTAMP_1021";
    }
}

class InvalidSignatureError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_SIGNATURE_1022";
    }
}

class InvalidAuthorizedError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_AUTHORUZED_1099";
    }
}

class IllegalCharactersParameterError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ILLEGAL_PARAMETERS_1100";
    }
}

class ManyParameterError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_TOO_MANY_PARAMETERS_1101";
    }
}

class MandatoryParamEmptyOrMalformedError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NULL_PARAMETERS_1102";
    }
}

class UnknownParamError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_UNKNOWN_PARAMETERS_1103";
    }
}

class UnreadParametersError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_READ_PARAMETERS_1104";
    }
}

class ParamEmptyError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_EMPTY_PARAMETERS_1105";
    }
}

class ParamNotRequiredError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_REQUIRED_PARAMETERS_1106";
    }
}

class MyBalanceMaximumError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_DEFIMED_BALANCE_1111";
    }
}

class OrderBookNotSymbolError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NO_ORDERS_BOOK_1112";
    }
}

class TimeInForceParameterSentError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_REQUIRED_TIMEINFORCE_1114";
    }
}

class InvalidTimeInForceError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_TIMEINFORCE_1115";
    }
}

class InvalidOrderTypeError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_ORDERTYPE_1116";
    }
}

class InvalidSideError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALIDE_SIDE_1117";
    }
}

class EmptyNewClientOrderIdError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_EMPTY_NEW_ORDERID_1118";
    }
}

class EmptyOriginalClientOrderIdError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_EMPTY_ORI_ORDERID_1119";
    }
}

class InvalidIntervalError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_INTERVAL_1120";
    }
}
class InvalidSymbolError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_SYMBOL_1121";
    }
}
class ListenKeyNotExistError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_EXIST_LISTENKEY_1125";
    }
}
class LookupIntervalisTooBigError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INTERVAL_TOO_BIG_1127";
    }
}
class OptionalParametersInvalidError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_COMBINATION_PARAMETERS_1128";
    }
}
class InvalidDataSentParameterError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_DATA_PARAMETERS_1130";
    }
}
class RecvWindowSmallError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_RECWINDOW_60000_1131";
    }
}
class NewOrderRejectedError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_REJECTED_NEWORDER_2010"
    }
}
class CancelOrderRejectedError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_REJECTED_CANCEL_2011"
    }
}
class OrderPlanNotExistError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_EXIST_ORDERS_2013";
    }
}
class APIKeyFormatInvalidError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_APIKEY_FORMAT_2014";
    }
}
class APIKeyInvalidError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALID_APIKEY_2015";
    }
}
exports.APIKeyInvalidError = APIKeyInvalidError;

class SymbolTradingWindowError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_FOUND_SYMBOL_2016";
    }
}
class InternetServerError extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INTERNAL_SERVER_3000";
    }
}

class Enable2FAError  extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ENABLE_2FA_3001";
    }
}

class AssetDeficencyError  extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_EXCHANGE_ASSET_3002";
    }
}

class TradeNotAllowedError  extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_ALLOWED_ORDER_3004";
    }
}

class TransferOutNotAllowedError  extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_NOT_ALLOWED_TRANSFERRING_3005";
    }
}

class PendingOrderTransactionError  extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ON_PENDING_ORDER_3007";
    }
}

class InputDateInvalidError  extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INVALIDE_INPUT_DATE_3011";
    }
}

class AccountBanTradeError  extends ExchangeApiError{
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SUSPENDED_EXCHANGE_ACCOUNT_3022";
    }
}


class UnkownExchangeApiError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "UNKNOWN_ERROR"
    }
}



;

(function(){
    filterfailureErrorMap =  {
        'Filterfailure:PRICE_FILTER': FilterFailurePriceFilter,
        'Filterfailure:PERCENT_PRICE': FilterFailurePercentPrice,
        'Filterfailure:LOT_SIZE': FilterFailureLotSizeError,
        'Filterfailure:MIN_NOTIONAL': FilterFailureMinNotionalError,
        'Filterfailure:MARKET_LOT_SIZE': FilterFailureMarketLotSizeError,
        'Filterfailure:MAX_NUM_ORDERS': FilterFailureMaxNumOrdersError,
        'Filterfailure:MAX_ALGO_ORDERS': FilterFailureMaxAlgoOrdersError,
        'Filterfailure:MAX_NUM_ALGO_ORDERS': FilterFailureMaxNumAlgoOrdersError,
        'Filterfailure:EXCHANGE_MAX_NUM_ORDERS': FilterFailureExchangeMaxNumOrdersError,
        'Filterfailure:EXCHANGE_MAX_ALGO_ORDERS': FilterFailureExchangeMaxAlgoOrders,
    };

    rejectedErrorMap = {
        "Invalidquantity.": InvalidQuantityError,
        "Invalidprice.": InvalidPriceError,
        "Stoppricewouldtriggerimmediately.": StopPriceWouldTriggerImmediatelyError,
        "Unknownordersent.": UnknownOrderSentError,
        "Duplicateordersent.": DuplicateOrderSentError,
        "Accounthasinsufficientbalanceforrequestedaction.": NotEnoughBalanceError,
        "Marketisclosed.": MarketisClosedError,
        "Marketordersarenotsupportedforthissymbol.": MarketOrderNotSupportedSymbolError,
        "Stoplossordersarenotsupportedforthissymbol.": StoplossNotSupportedSymbolError,
        "Stoplosslimitordersarenotsupportedforthissymbol.": StoplossLimitNotSupportedSymbolError,
        "Takeprofitordersarenotsupportedforthissymbol.": TakeProfitNotSupportedSymbolError,
        "Takeprofitlimitordersarenotsupportedforthissymbol.": TakeProfitLimitNotSupportedSymbolError,
        "Price*QTYiszeroorless.": AmountZeroOfLessError,
        "Thisactiondisabledisonthisaccount.": ActionDisabledAccountError,
        "Unsupportedordercombination": UnsupportedOrderCombinationError,
        "Orderwouldtriggerimmediately.": OrderTriggerImmediatelyError,
        "Cancelorderisinvalid.CheckorigClientOrderIdandorderId.": CancelOrderInvalidError,
    };

    codeErrorMap = {
        '-1001' : ExchangeServerDisconnectedError,
        '-1002' : UnauthorizedError,
        '-1003' : RequestManyError,
        '-1004' : ServerBusyError,
        '-1006' : UnknownResponseError,
        '-1007' : ServerResponseTimeoutError,
        '-1014' : UnsupportedOrderCompositionError,
        '-1015' : OrderLimitCountError,
        '-1016' : ServiceShuttingDownError,
        '-1020' : UnsupportedOperationError,
        '-1021' : InvalidTimestampError,
        '-1022' : InvalidSignatureError,
        '-1099' : InvalidAuthorizedError,
        '-1100' : IllegalCharactersParameterError,
        '-1101' : ManyParameterError,
        '-1102' : MandatoryParamEmptyOrMalformedError,
        '-1103' : UnknownParamError,
        '-1104' : UnreadParametersError,
        '-1105' : ParamEmptyError,
        '-1106' : ParamNotRequiredError,
        '-1111' : MyBalanceMaximumError,
        '-1112' : OrderBookNotSymbolError,
        '-1114' : TimeInForceParameterSentError,
        '-1115' : InvalidTimeInForceError,
        '-1116' : InvalidOrderTypeError,
        '-1117' : InvalidSideError,
        '-1118' : EmptyNewClientOrderIdError,
        '-1119' : EmptyOriginalClientOrderIdError,
        '-1120' : InvalidIntervalError,
        '-1121' : InvalidSymbolError,
        '-1125' : ListenKeyNotExistError,
        '-1127' : LookupIntervalisTooBigError,
        '-1128' : OptionalParametersInvalidError,
        '-1130' : InvalidDataSentParameterError,
        '-1131' : RecvWindowSmallError,
        '-2010' : NewOrderRejectedError,
        '-2011' : CancelOrderRejectedError,
        '-2013' : OrderPlanNotExistError,
        '-2014' : APIKeyFormatInvalidError,
        '-2015' : APIKeyInvalidError,
        '-2016' : SymbolTradingWindowError,
        '-3000' : InternetServerError,
        '-3001' : Enable2FAError,
        '-3002' : AssetDeficencyError,
        '-3004' : TradeNotAllowedError,
        '-3005' : TransferOutNotAllowedError,
        '-3007' : PendingOrderTransactionError,
        '-3011' : InputDateInvalidError,
        '-3022' : AccountBanTradeError,
    };
}());



