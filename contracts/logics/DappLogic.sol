pragma solidity ^0.5.4;

import "./base/BaseLogic.sol";

contract DappLogic is BaseLogic {

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

}

