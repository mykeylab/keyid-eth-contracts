pragma solidity ^0.5.4;

import "./utils/MultiOwned.sol";
import "./Account.sol";
import "./AccountProxy.sol";

contract AccountCreator is MultiOwned {

    address public logicManager;
    address public accountStorage;
    address public accountImpl;

    // *************** Events *************************** //
    event AccountCreated(address indexed wallet, address[] keys, address[] backups);
    event AddressesSet(address mgr, address strg, address impl);
    event Closed(address indexed sender);

    // *************** Internal Functions ********************* //

    function initializeAccount(address payable _accountProxy, address[] memory _keys, address[] memory _backups) internal {
        Account(_accountProxy).init(logicManager, accountStorage, LogicManager(logicManager).getAuthorizedLogics(), _keys, _backups);
        emit AccountCreated(_accountProxy, _keys, _backups);
    }

    // *************** External Functions ********************* //

    function createAccount(address[] calldata _keys, address[] calldata _backups) external onlyMultiOwners {
        AccountProxy accountProxy = new AccountProxy(accountImpl);
        initializeAccount(address(accountProxy), _keys, _backups);
    }

    /**
     * @dev method to create an account at a specific address.
     * The account is initialised with a list of keys and backups.
     * The account is created using the CREATE2 opcode.
     * @param _keys The list of keys.
     * @param _backups The list of backups.
     * @param _salt The salt.
     */
    function createCounterfactualAccount(address[] calldata _keys, address[] calldata _backups, bytes32 _salt) external onlyMultiOwners {
        bytes32 newSalt = keccak256(abi.encodePacked(_salt, _keys, _backups));
        bytes memory code = abi.encodePacked(type(AccountProxy).creationCode, uint256(accountImpl));
        address payable accountProxy;
        // solium-disable-next-line security/no-inline-assembly
        assembly {
            // create2(endowment, mem_start, mem_length, salt)
            accountProxy := create2(0, add(code, 0x20), mload(code), newSalt)
            if iszero(extcodesize(accountProxy)) { revert(0, returndatasize) }
        }
        initializeAccount(accountProxy, _keys, _backups);
    }

    function getCounterfactualAccountAddress(address[] calldata _keys, address[] calldata _backups, bytes32 _salt) external view returns(address) {
        bytes32 newSalt = keccak256(abi.encodePacked(_salt, _keys, _backups));
        bytes memory code = abi.encodePacked(type(AccountProxy).creationCode, uint256(accountImpl));
        bytes32 hash = keccak256(abi.encodePacked(bytes1(0xff), address(this), newSalt, keccak256(code)));
        address account = address(uint160(uint256(hash)));
        return account;
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