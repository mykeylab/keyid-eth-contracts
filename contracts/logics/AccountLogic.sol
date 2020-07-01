pragma solidity ^0.5.4;

import "./base/AccountBaseLogic.sol";

/**
* @title AccountLogic
*/
contract AccountLogic is AccountBaseLogic {

	// Equals to bytes4(keccak256("addOperationKey(address,address)"))
	bytes4 private constant ADD_OPERATION_KEY = 0x9a7f6101;
	// Equals to bytes4(keccak256("proposeAsBackup(address,address,bytes)"))
	bytes4 private constant PROPOSE_AS_BACKUP = 0xd470470f;
	// Equals to bytes4(keccak256("approveProposal(address,address,address,bytes)"))
	bytes4 private constant APPROVE_PROPOSAL = 0x3713f742;


    event AccountLogicEntered(bytes data, uint256 indexed nonce);
	event AccountLogicInitialised(address indexed account);
	event ChangeAdminKeyTriggered(address indexed account, address pkNew);
	event ChangeAllOperationKeysTriggered(address indexed account, address[] pks);
	event UnfreezeTriggered(address indexed account);

	event ChangeAdminKey(address indexed account, address indexed pkNew);
	event AddOperationKey(address indexed account, address indexed pkNew);
	event ChangeAllOperationKeys(address indexed account, address[] pks);
	event Freeze(address indexed account);
	event Unfreeze(address indexed account);
	event RemoveBackup(address indexed account, address indexed backup);
	event CancelDelay(address indexed account, bytes4 actionId);
	event CancelAddBackup(address indexed account, address indexed backup);
	event CancelRemoveBackup(address indexed account, address indexed backup);
	event ProposeAsBackup(address indexed backup, address indexed client, bytes data);
	event ApproveProposal(address indexed backup, address indexed client, address indexed proposer, bytes data);
	event CancelProposal(address indexed client, address indexed proposer, bytes4 proposedActionId);

	// *************** Constructor ********************** //

	constructor(AccountStorage _accountStorage)
		AccountBaseLogic(_accountStorage)
		public
	{
	}

    // *************** Initialization ********************* //

	function initAccount(Account _account) external allowAccountCallsOnly(_account){
        emit AccountLogicInitialised(address(_account));
    }

	// *************** action entry ********************** //

    /* AccountLogic has 12 actions called from 'enter':
        changeAdminKey, addOperationKey, changeAllOperationKeys, freeze, unfreeze,
		removeBackup, cancelDelay, cancelAddBackup, cancelRemoveBackup,
		proposeAsBackup, approveProposal, cancelProposal
	*/
	function enter(bytes calldata _data, bytes calldata _signature, uint256 _nonce) external {
		address account = getSignerAddress(_data);
		uint256 keyIndex = getKeyIndex(_data);
		checkKeyStatus(account, keyIndex);
		address signingKey = accountStorage.getKeyData(account, keyIndex);
		checkAndUpdateNonce(signingKey, _nonce);
		bytes32 signHash = getSignHash(_data, _nonce);
		verifySig(signingKey, _signature, signHash);

		// solium-disable-next-line security/no-low-level-calls
		(bool success,) = address(this).call(_data);
		require(success, "calling self failed");
		emit AccountLogicEntered(_data, _nonce);
	}

	// *************** change admin key ********************** //

    // called from 'enter'
	function changeAdminKey(address payable _account, address _pkNew) external allowSelfCallsOnly {
		require(_pkNew != address(0), "0x0 is invalid");
		address pk = accountStorage.getKeyData(_account, 0);
		require(pk != _pkNew, "identical admin key exists");
		require(accountStorage.getDelayDataHash(_account, CHANGE_ADMIN_KEY) == 0, "delay data already exists");
		bytes32 hash = keccak256(abi.encodePacked('changeAdminKey', _account, _pkNew));
		accountStorage.setDelayData(_account, CHANGE_ADMIN_KEY, hash, now + DELAY_CHANGE_ADMIN_KEY);
		emit ChangeAdminKey(_account, _pkNew);
	}

    // called from external
	function triggerChangeAdminKey(address payable _account, address _pkNew) external {
		bytes32 hash = keccak256(abi.encodePacked('changeAdminKey', _account, _pkNew));
		require(hash == accountStorage.getDelayDataHash(_account, CHANGE_ADMIN_KEY), "delay hash unmatch");

		uint256 due = accountStorage.getDelayDataDueTime(_account, CHANGE_ADMIN_KEY);
		require(due > 0, "delay data not found");
		require(due <= now, "too early to trigger changeAdminKey");
		accountStorage.setKeyData(_account, 0, _pkNew);
		//clear any existing related delay data and proposal
		accountStorage.clearDelayData(_account, CHANGE_ADMIN_KEY);
		accountStorage.clearDelayData(_account, CHANGE_ADMIN_KEY_BY_BACKUP);
		clearRelatedProposalAfterAdminKeyChanged(_account);
		emit ChangeAdminKeyTriggered(_account, _pkNew);
	}

	// *************** add operation key ********************** //

    // called from 'enter'
	function addOperationKey(address payable _account, address _pkNew) external allowSelfCallsOnly {
		uint256 index = accountStorage.getOperationKeyCount(_account) + 1;
		require(index > 0, "invalid operation key index");
		// set a limit to prevent unnecessary trouble
		require(index < 20, "index exceeds limit");
		require(_pkNew != address(0), "0x0 is invalid");
		address pk = accountStorage.getKeyData(_account, index);
		require(pk == address(0), "operation key already exists");
		accountStorage.setKeyData(_account, index, _pkNew);
		accountStorage.increaseKeyCount(_account);
		emit AddOperationKey(_account, _pkNew);
	}

	// *************** change all operation keys ********************** //

    // called from 'enter'
	function changeAllOperationKeys(address payable _account, address[] calldata _pks) external allowSelfCallsOnly {
		uint256 keyCount = accountStorage.getOperationKeyCount(_account);
		require(_pks.length == keyCount, "invalid number of keys");
		require(accountStorage.getDelayDataHash(_account, CHANGE_ALL_OPERATION_KEYS) == 0, "delay data already exists");
		address pk;
		for (uint256 i = 0; i < keyCount; i++) {
			pk = _pks[i];
			require(pk != address(0), "0x0 is invalid");
		}
		bytes32 hash = keccak256(abi.encodePacked('changeAllOperationKeys', _account, _pks));
		accountStorage.setDelayData(_account, CHANGE_ALL_OPERATION_KEYS, hash, now + DELAY_CHANGE_OPERATION_KEY);
		emit ChangeAllOperationKeys(_account, _pks);
	}

    // called from external
	function triggerChangeAllOperationKeys(address payable _account, address[] calldata _pks) external {
		bytes32 hash = keccak256(abi.encodePacked('changeAllOperationKeys', _account, _pks));
		require(hash == accountStorage.getDelayDataHash(_account, CHANGE_ALL_OPERATION_KEYS), "delay hash unmatch");

		uint256 due = accountStorage.getDelayDataDueTime(_account, CHANGE_ALL_OPERATION_KEYS);
		require(due > 0, "delay data not found");
		require(due <= now, "too early to trigger changeAllOperationKeys");
		address pk;
		for (uint256 i = 0; i < accountStorage.getOperationKeyCount(_account); i++) {
			pk = _pks[i];
			accountStorage.setKeyData(_account, i+1, pk);
			accountStorage.setKeyStatus(_account, i+1, 0);
		}
		accountStorage.clearDelayData(_account, CHANGE_ALL_OPERATION_KEYS);
		emit ChangeAllOperationKeysTriggered(_account, _pks);
	}

	// *************** freeze/unfreeze all operation keys ********************** //

    // called from 'enter'
	function freeze(address payable _account) external allowSelfCallsOnly {
		for (uint256 i = 1; i <= accountStorage.getOperationKeyCount(_account); i++) {
			if (accountStorage.getKeyStatus(_account, i) == 0) {
				accountStorage.setKeyStatus(_account, i, 1);
			}
		}
		emit Freeze(_account);
	}

    // called from 'enter'
	function unfreeze(address payable _account) external allowSelfCallsOnly {
		require(accountStorage.getDelayDataHash(_account, UNFREEZE) == 0, "delay data already exists");
		bytes32 hash = keccak256(abi.encodePacked('unfreeze', _account));
		accountStorage.setDelayData(_account, UNFREEZE, hash, now + DELAY_UNFREEZE_KEY);
		emit Unfreeze(_account);
	}

    // called from external
	function triggerUnfreeze(address payable _account) external {
		bytes32 hash = keccak256(abi.encodePacked('unfreeze', _account));
		require(hash == accountStorage.getDelayDataHash(_account, UNFREEZE), "delay hash unmatch");

		uint256 due = accountStorage.getDelayDataDueTime(_account, UNFREEZE);
		require(due > 0, "delay data not found");
		require(due <= now, "too early to trigger unfreeze");

		for (uint256 i = 1; i <= accountStorage.getOperationKeyCount(_account); i++) {
			if (accountStorage.getKeyStatus(_account, i) == 1) {
				accountStorage.setKeyStatus(_account, i, 0);
			}
		}
		accountStorage.clearDelayData(_account, UNFREEZE);
		emit UnfreezeTriggered(_account);
	}

	// *************** remove backup ********************** //

    // called from 'enter'
	function removeBackup(address payable _account, address _backup) external allowSelfCallsOnly {
		uint256 index = findBackup(_account, _backup);
		require(index <= MAX_DEFINED_BACKUP_INDEX, "backup invalid or not exist");

		accountStorage.setBackupExpiryDate(_account, index, now + DELAY_CHANGE_BACKUP);
		emit RemoveBackup(_account, _backup);
	}

    // return backupData index(0~5), 6 means not found
    // do make sure _backup is not 0x0
	function findBackup(address _account, address _backup) public view returns(uint) {
		uint index = MAX_DEFINED_BACKUP_INDEX + 1;
		if (_backup == address(0)) {
			return index;
		}
		address b;
		for (uint256 i = 0; i <= MAX_DEFINED_BACKUP_INDEX; i++) {
			b = accountStorage.getBackupAddress(_account, i);
			if (b == _backup) {
				index = i;
				break;
			}
		}
		return index;
	}

	// *************** cancel delay action ********************** //

    // called from 'enter'
	function cancelDelay(address payable _account, bytes4 _actionId) external allowSelfCallsOnly {
		accountStorage.clearDelayData(_account, _actionId);
		emit CancelDelay(_account, _actionId);
	}

    // called from 'enter'
	function cancelAddBackup(address payable _account, address _backup) external allowSelfCallsOnly {
		uint256 index = findBackup(_account, _backup);
		require(index <= MAX_DEFINED_BACKUP_INDEX, "backup invalid or not exist");
		uint256 effectiveDate = accountStorage.getBackupEffectiveDate(_account, index);
		require(effectiveDate > now, "already effective");
		accountStorage.clearBackupData(_account, index);
		emit CancelAddBackup(_account, _backup);
	}

    // called from 'enter'
	function cancelRemoveBackup(address payable _account, address _backup) external allowSelfCallsOnly {
		uint256 index = findBackup(_account, _backup);
		require(index <= MAX_DEFINED_BACKUP_INDEX, "backup invalid or not exist");
		uint256 expiryDate = accountStorage.getBackupExpiryDate(_account, index);
		require(expiryDate > now, "already expired");
		accountStorage.setBackupExpiryDate(_account, index, uint256(-1));
		emit CancelRemoveBackup(_account, _backup);
	}

	// *************** propose a proposal by one of the backups ********************** //

    // called from 'enter'
	// proposer is backup in the case of 'proposeAsBackup'
	function proposeAsBackup(address _backup, address payable _client, bytes calldata _functionData) external allowSelfCallsOnly {
		require(getSignerAddress(_functionData) == _client, "invalid _client");

		bytes4 proposedActionId = getMethodId(_functionData);
		require(proposedActionId == CHANGE_ADMIN_KEY_BY_BACKUP, "invalid proposal by backup");
		checkRelation(_client, _backup);
		bytes32 functionHash = keccak256(_functionData);
		accountStorage.setProposalData(_client, _backup, proposedActionId, functionHash, _backup);
		emit ProposeAsBackup(_backup, _client, _functionData);
	}

	// *************** approve/cancel proposal ********************** //

    // called from 'enter'
	function approveProposal(address _backup, address payable _client, address _proposer, bytes calldata _functionData) external allowSelfCallsOnly {
		require(getSignerAddress(_functionData) == _client, "invalid _client");

		bytes32 functionHash = keccak256(_functionData);
		require(functionHash != 0, "invalid hash");
		checkRelation(_client, _backup);
		if (_proposer != _client) {
			checkRelation(_client, _proposer);
		}

		bytes4 proposedActionId = getMethodId(_functionData);
		bytes32 hash = accountStorage.getProposalDataHash(_client, _proposer, proposedActionId);
		require(hash == functionHash, "proposal unmatch");
		accountStorage.setProposalData(_client, _proposer, proposedActionId, functionHash, _backup);
		emit ApproveProposal(_backup, _client, _proposer, _functionData);
	}

    // called from 'enter'
	function cancelProposal(address payable _client, address _proposer, bytes4 _proposedActionId) external allowSelfCallsOnly {
		require(_client != _proposer, "cannot cancel dual signed proposal");
		accountStorage.clearProposalData(_client, _proposer, _proposedActionId);
		emit CancelProposal(_client, _proposer, _proposedActionId);
	}

	// *************** internal functions ********************** //

    /*
    index 0: admin key
          1: asset(transfer)
          2: adding
          3: reserved(dapp)
          4: assist
     */
	function getKeyIndex(bytes memory _data) internal pure returns (uint256) {
		uint256 index; //index default value is 0, admin key
		bytes4 methodId = getMethodId(_data);
		if (methodId == ADD_OPERATION_KEY) {
  			index = 2; //adding key
		} else if (methodId == PROPOSE_AS_BACKUP || methodId == APPROVE_PROPOSAL) {
  			index = 4; //assist key
		}
		return index;
	}

}
