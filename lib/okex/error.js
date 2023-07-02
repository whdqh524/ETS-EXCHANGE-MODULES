'use strict';

const env = process.env.NODE_ENV || "development";
const { EtsError } = (env == 'product') ? require('@aitraum/ets-spot-common.git').error : require('../../../common/modules/error');


let errorMap = {};

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

function getCodeErrorClass(code) {
    const errCode = String(code);
    return errorMap[errCode];
}

function getExchangeApiSubErrorCode(message, code) {
    let errClass;
    errClass = getCodeErrorClass(code);
    if(!errClass) errClass = UnkownExchangeApiError;
    return errClass;
}


class ExchangeOperationFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OPERATION_FAILED_1";
    }
}

class ExchangeBodyNotEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_BODY_EMPTY_50000";
    }
}

class ExchangeMatchingEngineUpgradingError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MATCHING_ENGINE_UPGRADE_50001";
    }
}

class ExchangeJsonDataFormatError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_JSON_ERROR_50002";
    }
}

class ExchangeEndPointResquestTimeoutError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ENDPOINT_TIMEOUT_50004";
    }
}

class ExchangeApiUnavailableError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_API_UNVAILABLE_50005";
    }
}

class ExchangeContentTypeInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CONTENT_TYPE_INVALID_50006";
    }
}

class ExchangeAccountBlockedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ACCOUNT_BLOCKED_50007";
    }
}

class ExchangeUserNotExistError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_USER_NOT_EXIST_50008";
    }
}

class ExchangeRequestTooManyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_REQUEST_FREQUENT_50011";
    }
}

class ExchangeAccountInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ACCOUNT_INVALID_50012";
    }
}

class ExchangeSystemBusyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SYSTEM_BUSY_50013";
    }
}

class ExchangeParameterEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PARAMETER_EMPTY_50014";
    }
}

class ExchangeParameterRequiredError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PARAMETER_REQUIRED_50015";
    }
}

class ExchangeParameterNotMatchError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PARAMETER_NOTMATCH_50016";
    }
}

class ExchangeParameterDuplicatesError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PARAMETER_DUPLICATES_50024";
    }
}

class ExchangeParameterExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PARAMETER_EXCEEDS_50025";
    }
}

class ExchangeSystemError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SYSTEM_ERROR_50026";
    }
}

class ExchangeAccountRestRictedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ACCOUNT_RESTRICTED_50027";
    }
}

class ExchangeOrderUnableError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ORDER_UNABLE_50028";
    }
}

class ExchangeOrderRiskManagementError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ORDER_RISK_MANAGEMENT_50029";
    }
}

class ExchangeApiFrozenError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_API_FROZEN_50100";
    }
}

class ExchangeBrokerIdApiNotMatchError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_BROKERID_API_NOTMATCH_50101";
    }
}

class ExchangeTimestampExpiredError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_TIMESTAMP_EXPIRED_50102";
    }
}

class ExchangeOkAccessKeyEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OK_ACCESS_KEY_EMPTY_50103";
    }
}

class ExchangeOkAccessPassphraseEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OK_ACCESS_PASSPHRASE_EMPTY_50104";
    }
}
class ExchangeOkAccessPassphraseIncorrectError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OK_ACCESS_PASSPHRASE_INCORRECT_50105";
    }
}

class ExchangeOkAccessSignEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OK_ACCESS_SIGN_EMPTY_50106";
    }
}

class ExchangeOkAccessTimestampEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OK_ACCESS_TIMESTAMP_EMPTY_50107";
    }
}

class ExchangeIdNotExistError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_EXCHANGE_ID_NOT_EXIST_50108";
    }
}
class ExchangeDomainNotExistError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_EXCHANGE_DOMAIN_NOT_EXIST_50109";
    }
}

class ExchangeIpInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_IP_INVALID_50110";
    }
}

class ExchangeAccessKeyInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OK_ACCESS_KEY_INVALID_50111";
    }
}
exports.ExchangeAccessKeyInvalidError = ExchangeAccessKeyInvalidError;

class ExchangeOkAccessTimestampInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OK_ACCESS_TIMESTAMP_INVALID_50112";
    }
}

class ExchangeSignatureInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SIGNATURE_INVALID_50113";
    }
}

class ExchangeAuthorizationInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AUTHORIZATION_INVALID_50114";
    }
}

class ExchangeRequestMethodInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_REQUEST_METHOD_INVALID_50115";
    }
}

class ExchangeParameterError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PARAMETER_ERROR_51000";
    }
}

class ExchangeInstrumentIdNotExistError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INSTRUMENT_ID_NOT_EXIST_51001";
    }
}

class ExchangeInstrumentIdIndexNotMatchError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INSTRUMENT_ID_INDEX_NOT_MATCH_51002";
    }
}

class ExchangeOrderIdRequiredError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = `EX_ORDER_ID_REQUIRED_${lastError.exchangeCode}`;
    }
}

class ExchangeAmountTierExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_AMOUNT_TIER_EXCEEDS_51004";
    }
}

class ExchangeAmountExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AMOUNT_EXCEEDS_51005";
    }
}

class ExchangePriceLimitOutError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PRICE_LIMIT_OUT_51006";
    }
}

class ExchangeBalanceInsufficientError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = `EX_BALANCE_INSUFFICIENT_${lastError.exchangeCode}`;
    }
}

class ExchangeOrderBlockedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ORDER_BLOCKED_51009";
    }
}

class ExchangeOperationNotSupportedAccountModeError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OPERATION_NOT_SUPPORTED_51010";
    }
}
exports.ExchangeOperationNotSupportedAccountModeError = ExchangeOperationNotSupportedAccountModeError;

class ExchangeOrderIdDuplicatedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ORDER_ID_DUPLICATED_51011";
    }
}

class ExchangeTokenNotExistError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_TOKEN_NOT_EXIST_51012";
    }
}

class ExchangeIndexNotExistError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INDEX_NOT_EXIST_51014";
    }
}

class ExchangeInstrumentIdTypeNotMatchError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INSTRUMENT_ID_TYPE_NOT_MATCH_51015";
    }
}

class ExchangeClientOrderIdDuplicatedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CLIENT_ORDER_ID_DUPLICATED_51016";
    }
}

class ExchangeAmountSmallError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AMOUNT_SMALL_51020";
    }
}

class ExchangeUnifiedAccountBlockedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_UNIFIED_ACCOUNT_BLOCKED_51024";
    }
}

class ExchangeCountExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_COUNT_EXCEEDS_51025";
    }
}

class ExchangeInstrumentTypeIndexNotMatchError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_INSTRUMENT_TYPE_INDEX_NOT_MATCH_51026";
    }
}

class ExchangeAmountMinNotMatchError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AMOUNT_MIN_NOT_MATCH_51100";
    }
}

class ExchangeAmountPendingExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AMOUNT_PENDING_EXCEEDS_51102";
    }
}

class ExchangeAmountPendingAssetcountExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AMOUNT_PENDING_ASSETCOUNT_EXCEEDS_51103";
    }
}

class ExchangeOfferUnavailableError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_OFFER_UNAVAILABLE_51109";
    }
}

class ExchangePriceExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PRICE_EXCEEDS_51116";
    }
}

class ExchangeAmountPerMinBelowError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AMOUNT_PER_MIN_BELOW_51118";
    }
}

class ExchangeQtyLessError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_QTY_LESS_51120";
    }
}

class ExchangeOrderCountNotIntegerError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ORDER_COUNT_NOT_INTEGER_51121";
    }
}

class ExchangePriceMinBelowError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PRICE_MIN_BELOW_51122";
    }
}

class ExchangeBalanceZeroError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_BALANCE_ZERO_51127";
    }
}

class ExchangeBalanceInsufficienntError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_BALANCE_INSUFFICIENT_51131";
    }
}
exports.ExchangeBalanceInsufficienntError = ExchangeBalanceInsufficienntError;

class ExchangeMarketOrderValueExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MARKET_ORDER_VALUE_EXCEEDS_51201";
    }
}

class ExchangeOrderAmountExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MARKET_ORDER_AMOUNT_EXCEEDS_51202";
    }
}

class ExchangeAmountLimitExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AMOUNT_LIMIT_EXCEEDS_51203";
    }
}

class ExchangeLimitOrderPriceEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_LIMIT_ORDER_PRICE_EMPTY_51204";
    }
}

class ExchangePendingStopExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PENDING_STOP_EXCEEDS_51261";
    }
}

class ExchangeAmountMinBelowError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_AMOUNT_MIN_BELOW_51273";
    }
}

class ExchangeCancellationExistFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CANCELLATION_NOT_EXIST_FAILED_51400";
    }
}

class ExchangeCancellationDupicateFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CANCELLATION_DUPICATE_FAILED_51401";
    }
}

class ExchangeCancellationCompletedFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CANCELLATION_COMPLETED_FAILED_51402";
    }
}

class ExchangeCancellationNotSupportFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CANCELLATION_NOT_SUPPORT_FAILED_51403";
    }
}

class ExchangeCancellationNoPendingFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CANCELLATION_NO_PENDING_FAILED_51405";
    }
}

class ExchangeExceedsLimitCanceledError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_EXCEEDS_LIMIT_CANCELED_51406";
    }
}

class ExchangePairIdNameNotMatchError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PAIR_ID_NAME_NOT_MATCH_51408";
    }
}

class ExchangePairIdNameRequiredError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PAIR_ID_NAME_REQUIRED_51409";
    }
}

class ExchangeCancellationUnderstatusFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_CANCELLATION_UNDERSTATUS_FAILED_51410";
    }
}

class ExchangePriceAmountRequiredError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_PRICE_AMOUNT_REQUIRED_51500";
    }
}

class ExchangeModificationMaximumExceedsError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MODIFICATION_MAXIMUM_EXCEEDS_51501";
    }
}

class ExchangeModificationNotExistFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MODIFICATION_NOT_EXIST_FAILED_51503";
    }
}

class ExchangeModificationNotSupportFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MODIFICATION_NOT_SUPPORT_FAILED_51506";
    }
}

class ExchangeModificationCanceledFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MODIFICATION_CANCELED_FAILED_51509";
    }
}

class ExchangeModificationCompletedFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_MODIFICATION_COMPLETED_FAILED_51510";
    }
}

class ExchangeStatusNotFoundError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_STATUS_NOT_FOUND_51600";
    }
}

class ExchangeOrderStatusIdDupicatedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ORDER_STATUS_ID_DUPICATED_51601";
    }
}

class ExchangeOrderStatusIdRequiredError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ORDER_STATUS_ID_REQUIRED_51602";
    }
}

class ExchangeOrderNotExistError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_ORDER_NOT_EXIST_51603";
    }
}

class ExchangeUpdateNoneError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_UPDATE_NONE_52000";
    }
}

class ExchangeSocketOkAccessKeyEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_OK_ACCESS_KEY_EMPTY_60001";
    }
}

class ExchangeSocketOkAccessSignEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_OK_ACCESS_SIGN_EMPTY_60002";
    }
}

class ExchangeSocketOkAccessPassphraseEmptyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_OK_ACCESS_PASSPHRASE_EMPTY_60003";
    }
}

class ExchangeSocketOkAccessTimestampInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_OK_ACCESS_TIMESTAMP_INVALID_60004";
    }
}

class ExchangeSocketOkaccessKeyInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_OK_ACCESS_KEY_INVALID_60005";
    }
}

class ExchangeSocketTimestampExpiredError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_TIMESTAMP_EXPIRED_60006";
    }
}

class ExchangeSocketSignInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_SIGN_INVALID_60007";
    }
}

class ExchangeSocketLoginChannelNotSupportedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_LOGIN_CHANNEL_NOT_SUPPORTED_60008";
    }
}

class ExchangeSocketLoginFailedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_LOGIN_FAILED_60009";
    }
}

class ExchangeSocketLoginAlreadyError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_LOGIN_ALREADY_60010";
    }
}

class ExchangeSocketLoginNeededError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_LOGIN_NEEDED_60011";
    }
}

class ExchangeSocketIllegalRequestError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_ILLEGAL_REQUEST_60012";
    }
}

class ExchangeSocketArgsInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_ARGS_INVALID_60013";
    }
}

class ExchangeSocketRequestFrequentError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_REQUEST_FREQUENT_60014";
    }
}

class ExchangeSocketConnectionClosedError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_CONNECTION_CLOSED_60015";
    }
}

class ExchangeSocketBufferFullError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_BUFFER_FULL_60016";
    }
}

class ExchangeSocketUrlInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_URL_INVALID_60017";
    }
}

class ExchangeSocketParameterNotExistError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_PARAMETER_NOT_EXIST_60018";
    }
}

class ExchangeSocketOpInvalidError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_OP_INVALID_60019";
    }
}

class ExchangeSocketInternalSystemError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "EX_SOCKET_INTERNAL_SYSTEM_ERROR_63999";
    }
}


class UnkownExchangeApiError extends ExchangeApiError {
    constructor(lastError) {
        super(lastError);
        this.code = "UNKNOWN_ERROR"
    }
}



(function(){
    errorMap =  {
        '1': ExchangeOperationFailedError,
        '50000': ExchangeBodyNotEmptyError,
        '50001': ExchangeMatchingEngineUpgradingError,
        '50002': ExchangeJsonDataFormatError,
        '50004': ExchangeEndPointResquestTimeoutError,
        '50005': ExchangeApiUnavailableError,
        '50006': ExchangeContentTypeInvalidError,
        '50007': ExchangeAccountBlockedError,
        '50008': ExchangeUserNotExistError,
        '50011': ExchangeRequestTooManyError,
        '50012': ExchangeAccountInvalidError,
        '50013': ExchangeSystemBusyError,
        '50014': ExchangeParameterEmptyError,
        '50015': ExchangeParameterRequiredError,
        '50016': ExchangeParameterNotMatchError,
        '50024': ExchangeParameterDuplicatesError,
        '50025': ExchangeParameterExceedsError,
        '50026': ExchangeSystemError,
        '50027': ExchangeAccountRestRictedError,
        '50028': ExchangeOrderUnableError,
        '50029': ExchangeOrderRiskManagementError,
        '50100': ExchangeApiFrozenError,
        '50101': ExchangeBrokerIdApiNotMatchError,
        '50102': ExchangeTimestampExpiredError,
        '50103': ExchangeOkAccessKeyEmptyError,
        '50104': ExchangeOkAccessPassphraseEmptyError,
        '50105': ExchangeOkAccessPassphraseIncorrectError,
        '50106': ExchangeOkAccessSignEmptyError,
        '50107': ExchangeOkAccessTimestampEmptyError,
        '50108': ExchangeIdNotExistError,
        '50109': ExchangeDomainNotExistError,
        '50110': ExchangeIpInvalidError,
        '50111': ExchangeAccessKeyInvalidError,
        '50112': ExchangeOkAccessTimestampInvalidError,
        '50113': ExchangeSignatureInvalidError,
        '50114': ExchangeAuthorizationInvalidError,
        '50115': ExchangeRequestMethodInvalidError,
        '51000': ExchangeParameterError,
        '51001': ExchangeInstrumentIdNotExistError,
        '51002': ExchangeInstrumentIdIndexNotMatchError,
        '51003': ExchangeOrderIdRequiredError,
        '51004': ExchangeAmountTierExceedsError,
        '51005': ExchangeAmountExceedsError,
        '51006': ExchangePriceLimitOutError,
        '51008': ExchangeBalanceInsufficientError,
        '51009': ExchangeOrderBlockedError,
        '51010': ExchangeOperationNotSupportedAccountModeError,
        '51011': ExchangeOrderIdDuplicatedError,
        '51012': ExchangeTokenNotExistError,
        '51014': ExchangeIndexNotExistError,
        '51015': ExchangeInstrumentIdTypeNotMatchError,
        '51016': ExchangeClientOrderIdDuplicatedError,
        '51020': ExchangeAmountSmallError,
        '51024': ExchangeUnifiedAccountBlockedError,
        '51025': ExchangeCountExceedsError,
        '51026': ExchangeInstrumentTypeIndexNotMatchError,
        '51101': ExchangeAmountMinNotMatchError,
        '51102': ExchangeAmountPendingExceedsError,
        '51103': ExchangeAmountPendingAssetcountExceedsError,
        '51109': ExchangeOfferUnavailableError,
        '51116': ExchangePriceExceedsError,
        '51118': ExchangeAmountPerMinBelowError,
        '51119': ExchangeBalanceInsufficientError,
        '51120': ExchangeQtyLessError,
        '51121': ExchangeOrderCountNotIntegerError,
        '51122': ExchangePriceMinBelowError,
        '51127': ExchangeBalanceZeroError,
        '51131': ExchangeBalanceInsufficienntError,
        '51201': ExchangeMarketOrderValueExceedsError,
        '51203': ExchangeAmountLimitExceedsError,
        '51204': ExchangeLimitOrderPriceEmptyError,
        '51261': ExchangePendingStopExceedsError,
        '51273': ExchangeAmountMinBelowError,
        '51400': ExchangeCancellationExistFailedError,
        '51401': ExchangeCancellationDupicateFailedError,
        '51402': ExchangeCancellationCompletedFailedError,
        '51403': ExchangeCancellationNotSupportFailedError,
        '51405': ExchangeCancellationNoPendingFailedError,
        '51406': ExchangeExceedsLimitCanceledError,
        '51407': ExchangeOrderIdRequiredError,
        '51408': ExchangePairIdNameNotMatchError,
        '51409': ExchangePairIdNameRequiredError,
        '51410': ExchangeCancellationUnderstatusFailedError,
        '51500': ExchangePriceAmountRequiredError,
        '51501': ExchangeModificationMaximumExceedsError,
        '51503': ExchangeModificationNotExistFailedError,
        '51506': ExchangeModificationNotSupportFailedError,
        '51509': ExchangeModificationCanceledFailedError,
        '51510': ExchangeModificationCompletedFailedError,
        '51600': ExchangeStatusNotFoundError,
        '51601': ExchangeOrderStatusIdDupicatedError,
        '51602': ExchangeOrderStatusIdRequiredError,
        '51603': ExchangeOrderNotExistError,
        '52000': ExchangeUpdateNoneError,
        '60001': ExchangeSocketOkAccessKeyEmptyError,
        '60002': ExchangeSocketOkAccessSignEmptyError,
        '60003': ExchangeSocketOkAccessPassphraseEmptyError,
        '60004': ExchangeSocketOkAccessTimestampInvalidError,
        '60005': ExchangeSocketOkaccessKeyInvalidError,
        '60006': ExchangeSocketTimestampExpiredError,
        '60007': ExchangeSocketSignInvalidError,
        '60008': ExchangeSocketLoginChannelNotSupportedError,
        '60009': ExchangeSocketLoginFailedError,
        '60010': ExchangeSocketLoginAlreadyError,
        '60011': ExchangeSocketLoginNeededError,
        '60012': ExchangeSocketIllegalRequestError,
        '60013': ExchangeSocketArgsInvalidError,
        '60014': ExchangeSocketRequestFrequentError,
        '60015': ExchangeSocketConnectionClosedError,
        '60016': ExchangeSocketBufferFullError,
        '60017': ExchangeSocketUrlInvalidError,
        '60018': ExchangeSocketParameterNotExistError,
        '60019': ExchangeSocketOpInvalidError,
        '63999': ExchangeSocketInternalSystemError,
    };
}());




