pragma solidity ^0.5.4;

import "./base/AccountBaseLogic.sol";

contract ProposalLogic is AccountBaseLogic {

    event ProposalLogicInitialised(address indexed account);
    event ProposalExecuted(address indexed client, address indexed proposer, bytes functionData);
	event ChangeAdminKeyByBackup(address indexed account, address indexed pkNew);
	event ChangeAdminKeyByBackupTriggered(address indexed account, address pkNew);
    event ChangeAdminKeyWithoutDelay(address indexed account, address pkNew);
    event ChangeAllOperationKeysWithoutDelay(address indexed account, address[] pks);
    event UnfreezeWithoutDelay(address indexed account);

    // *************** Constructor ********************** //
    constructor(AccountStorage _accountStorage)
        public
        AccountBaseLogic(_accountStorage)
    {
    }

    // *************** Initialization ********************* //
    function initAccount(Account _account)
        external
        allowAccountCallsOnly(_account)
    {
        emit ProposalLogicInitialised(address(_account));
    }

    // *************** Proposal ********************** //

    /**
    * @dev Execute a proposal. No sig check is required.
	* There are 4 proposed actions called from 'executeProposal':
         AccountLogic: changeAdminKeyByBackup
         DualsigsLogic: changeAdminKeyWithoutDelay, changeAllOperationKeysWithoutDelay, unfreezeWithoutDelay
    * @param _client client address
    * @param _proposer If 'proposeAsBackup', proposer is backup; if 'proposeByBoth', proposer is client.
	* @param _functionData The proposed action data.
    */
    function executeProposal(address payable _client, address _proposer, bytes calldata _functionData) external {
        //make sure the proposed action data is client's
        require(getSignerAddress(_functionData) == _client, "invalid _client");
        
        bytes4 proposedActionId = getMethodId(_functionData);
        checkProposedAction(proposedActionId);
        bytes32 functionHash = keccak256(_functionData);

        checkApproval(_client, _proposer, proposedActionId, functionHash);

        // call functions with/without delay
        // solium-disable-next-line security/no-low-level-calls
        (bool success,) = address(this).call(_functionData);
        require(success, "executeProposal failed");

        accountStorage.clearProposalData(_client, _proposer, proposedActionId);
        emit ProposalExecuted(_client, _proposer, _functionData);
    }

    function checkProposedAction(bytes4 actionId) internal pure {
        require(actionId == CHANGE_ADMIN_KEY_BY_BACKUP || 
                actionId == CHANGE_ADMIN_KEY_WITHOUT_DELAY || 
                actionId == CHANGE_ALL_OPERATION_KEYS_WITHOUT_DELAY || 
                actionId == UNFREEZE_WITHOUT_DELAY, "invalid proposed action");
    }

    /**
    * @dev Check if a proposal is approved by majority.
    * @param _client client address
    * @param _proposer If 'proposeAsBackup', proposer is backup; if 'proposeByBoth', proposer is client.
    * @param _proposedActionId The Proposed action method id.
	* @param _functionHash The proposed action data.
    */
    function checkApproval(address _client, address _proposer, bytes4 _proposedActionId, bytes32 _functionHash) internal view {
        if (_proposer != _client) {
			checkRelation(_client, _proposer);
		}
        bytes32 hash = accountStorage.getProposalDataHash(_client, _proposer, _proposedActionId);
        require(hash == _functionHash, "proposal hash unmatch");

        uint256 backupCount;
        uint256 approvedCount;
        address[] memory approved = accountStorage.getProposalDataApproval(_client, _proposer, _proposedActionId);
        require(approved.length > 0, "no approval");

        // iterate backup list
        for (uint256 i = 0; i <= MAX_DEFINED_BACKUP_INDEX; i++) {
            address backup = accountStorage.getBackupAddress(_client, i);
            uint256 effectiveDate = accountStorage.getBackupEffectiveDate(_client, i);
            uint256 expiryDate = accountStorage.getBackupExpiryDate(_client, i);
            if (backup != address(0) && isEffectiveBackup(effectiveDate, expiryDate)) {
                // count how many backups in backup list
                backupCount += 1;
                // iterate approved array
                for (uint256 k = 0; k < approved.length; k++) {
                    if (backup == approved[k]) {
                       // count how many approved backups still exist in backup list
                       approvedCount += 1;
                    }
                }
            }
        }
        require(backupCount > 0, "no backup in list");
        uint256 threshold = SafeMath.ceil(backupCount*6, 10);
        require(approvedCount >= threshold, "must have 60% approval at least");
    }

	// *************** change admin key by backup ********************** //

    // called from 'executeProposal'
    // changing admin key by backup's proposal requires 30 days delay
	function changeAdminKeyByBackup(address payable _account, address _pkNew) external allowSelfCallsOnly {
		require(_pkNew != address(0), "0x0 is invalid");
		address pk = accountStorage.getKeyData(_account, 0);
		require(pk != _pkNew, "identical admin key exists");
		require(accountStorage.getDelayDataHash(_account, CHANGE_ADMIN_KEY_BY_BACKUP) == 0, "delay data already exists");
		bytes32 hash = keccak256(abi.encodePacked('changeAdminKeyByBackup', _account, _pkNew));
		accountStorage.setDelayData(_account, CHANGE_ADMIN_KEY_BY_BACKUP, hash, now + DELAY_CHANGE_ADMIN_KEY_BY_BACKUP);
		emit ChangeAdminKeyByBackup(_account, _pkNew);
	}

    // called from external
	function triggerChangeAdminKeyByBackup(address payable _account, address _pkNew) external {
		bytes32 hash = keccak256(abi.encodePacked('changeAdminKeyByBackup', _account, _pkNew));
		require(hash == accountStorage.getDelayDataHash(_account, CHANGE_ADMIN_KEY_BY_BACKUP), "delay hash unmatch");

		uint256 due = accountStorage.getDelayDataDueTime(_account, CHANGE_ADMIN_KEY_BY_BACKUP);
		require(due > 0, "delay data not found");
		require(due <= now, "too early to trigger changeAdminKeyByBackup");
		accountStorage.setKeyData(_account, 0, _pkNew);
		//clear any existing related delay data and proposal
		accountStorage.clearDelayData(_account, CHANGE_ADMIN_KEY_BY_BACKUP);
		accountStorage.clearDelayData(_account, CHANGE_ADMIN_KEY);
		clearRelatedProposalAfterAdminKeyChanged(_account);
		emit ChangeAdminKeyByBackupTriggered(_account, _pkNew);
	}

	// *************** change admin key immediately ********************** //

    // called from 'executeProposal'
	function changeAdminKeyWithoutDelay(address payable _account, address _pkNew) external allowSelfCallsOnly {
		address pk = accountStorage.getKeyData(_account, 0);
		require(pk != _pkNew, "identical admin key already exists");
		require(_pkNew != address(0), "0x0 is invalid");
		accountStorage.setKeyData(_account, 0, _pkNew);
		//clear any existing related delay data and proposal
		accountStorage.clearDelayData(_account, CHANGE_ADMIN_KEY);
		accountStorage.clearDelayData(_account, CHANGE_ADMIN_KEY_BY_BACKUP);
		accountStorage.clearDelayData(_account, CHANGE_ALL_OPERATION_KEYS);
		accountStorage.clearDelayData(_account, UNFREEZE);
		clearRelatedProposalAfterAdminKeyChanged(_account);
        emit ChangeAdminKeyWithoutDelay(_account, _pkNew);
	}

	// *************** change all operation keys immediately ********************** //

    // called from 'executeProposal'
	function changeAllOperationKeysWithoutDelay(address payable _account, address[] calldata _pks) external allowSelfCallsOnly {
		uint256 keyCount = accountStorage.getOperationKeyCount(_account);
		require(_pks.length == keyCount, "invalid number of keys");
		for (uint256 i = 0; i < keyCount; i++) {
			address pk = _pks[i];
			require(pk != address(0), "0x0 is invalid");
			accountStorage.setKeyData(_account, i+1, pk);
			accountStorage.setKeyStatus(_account, i+1, 0);
		}
        emit ChangeAllOperationKeysWithoutDelay(_account, _pks);
	}

	// *************** unfreeze all operation keys immediately ********************** //

    // called from 'executeProposal'
	function unfreezeWithoutDelay(address payable _account) external allowSelfCallsOnly {
		for (uint256 i = 0; i < accountStorage.getOperationKeyCount(_account); i++) {
			if (accountStorage.getKeyStatus(_account, i+1) == 1) {
				accountStorage.setKeyStatus(_account, i+1, 0);
			}
		}
        emit UnfreezeWithoutDelay(_account);
	}
}