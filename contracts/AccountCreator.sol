pragma solidity ^0.5.4;

import "./utils/MultiOwned.sol";
import "./Account.sol";
import "./AccountProxy.sol";

contract AccountCreator is MultiOwned {

    address public logicManager;
    address public accountStorage;
    address public accountImpl;
    // address[] public logics;

    // *************** Events *************************** //
    event AccountCreated(address indexed wallet, address[] keys, address[] backups);
    event AddressesSet(address mgr, address strg, address impl);
    event Closed(address indexed sender);

    // *************** Constructor ********************** //
    // constructor(address _mgr, address _storage, address _accountImpl) public {
    //     logicManager = _mgr;
    //     accountStorage = _storage;
    //     accountImpl = _accountImpl;
    //     // logics = _logics;
    // }

    // *************** External Functions ********************* //

    function createAccount(address[] calldata _keys, address[] calldata _backups) external onlyMultiOwners {
        AccountProxy accountProxy = new AccountProxy(accountImpl);
        Account(address(accountProxy)).init(logicManager, accountStorage, LogicManager(logicManager).getAuthorizedLogics(), _keys, _backups);

        emit AccountCreated(address(accountProxy), _keys, _backups);
    }

    function setAddresses(address _mgr, address _storage, address _accountImpl) external onlyMultiOwners {
        logicManager = _mgr;
        accountStorage = _storage;
        accountImpl = _accountImpl;
        emit AddressesSet(_mgr, _storage, _accountImpl);
    }

    // *************** Suicide ********************* //
    
    function close() external onlyMultiOwners {
        selfdestruct(msg.sender);
        emit Closed(msg.sender);
    }
}