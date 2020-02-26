pragma solidity ^0.5.4;

import "./base/BaseLogic.sol";
import "../utils/RLPReader.sol";

contract DappLogic is BaseLogic {

    using RLPReader for RLPReader.RLPItem;
    using RLPReader for bytes;
    /*
    index 0: admin key
          1: asset(transfer)
          2: adding
          3: reserved(dapp)
          4: assist
     */
    uint constant internal DAPP_KEY_INDEX = 3;

    // *************** Events *************************** //

    event DappLogicInitialised(address indexed account);
    event DappLogicEntered(bytes data, uint256 indexed nonce);

    // *************** Constructor ********************** //
    constructor(AccountStorage _accountStorage)
        BaseLogic(_accountStorage)
        public
    {
    }

    // *************** Initialization ********************* //

    function initAccount(Account _account) external allowAccountCallsOnly(_account){
        emit DappLogicInitialised(address(_account));
    }

    // *************** action entry ********************* //

    function enter(bytes calldata _data, bytes calldata _signature, uint256 _nonce) external {
        address account = getSignerAddress(_data);
        checkKeyStatus(account, DAPP_KEY_INDEX);

        address dappKey = accountStorage.getKeyData(account, DAPP_KEY_INDEX);
        checkAndUpdateNonce(dappKey, _nonce);
        bytes32 signHash = getSignHash(_data, _nonce);
        verifySig(dappKey, _signature, signHash);

        // solium-disable-next-line security/no-low-level-calls
        (bool success,) = address(this).call(_data);
        require(success, "calling self failed");
        emit DappLogicEntered(_data, _nonce);
    }

    // *************** call Dapp ********************* //

    // called from 'enter'
    // call other contract from base account
    function callContract(address payable _account, address payable _target, uint256 _value, bytes calldata _methodData) external allowSelfCallsOnly {
        // Account(_account).invoke(_target, _value, _methodData);
        bool success;
        // solium-disable-next-line security/no-low-level-calls
        (success,) = _account.call(abi.encodeWithSignature("invoke(address,uint256,bytes)", _target, _value, _methodData));
        require(success, "calling invoke failed");
    }

    // called from 'enter'
    // call serveral other contracts at a time
    // rlp encode _methodData array into rlpBytes
    function callMultiContract(address payable _account, address[] calldata _targets, uint256[] calldata _values, bytes calldata _rlpBytes) external allowSelfCallsOnly {
        RLPReader.RLPItem[] memory ls = _rlpBytes.toRlpItem().toList();

        uint256 len = _targets.length;
        require(len == _values.length && len == ls.length, "length mismatch");
        for (uint256 i = 0; i < len; i++) {
            bool success;
            RLPReader.RLPItem memory item = ls[i];
            // solium-disable-next-line security/no-low-level-calls
            (success,) = _account.call(abi.encodeWithSignature("invoke(address,uint256,bytes)", _targets[i], _values[i], bytes(item.toBytes())));
            require(success, "calling invoke failed");
        }
    }

}

