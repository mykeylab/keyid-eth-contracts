pragma solidity ^0.5.4;

import "./BaseLogic.sol";

contract AccountBaseLogic is BaseLogic {

    uint256 constant internal DELAY_CHANGE_ADMIN_KEY = 21 days;
    uint256 constant internal DELAY_CHANGE_OPERATION_KEY = 7 days;
    uint256 constant internal DELAY_UNFREEZE_KEY = 7 days;
    uint256 constant internal DELAY_CHANGE_BACKUP = 21 days;
    uint256 constant internal DELAY_CHANGE_ADMIN_KEY_BY_BACKUP = 30 days;

    uint256 constant internal MAX_DEFINED_BACKUP_INDEX = 5;

	// Equals to bytes4(keccak256("changeAdminKey(address,address)"))
	bytes4 internal constant CHANGE_ADMIN_KEY = 0xd595d935;
	// Equals to bytes4(keccak256("changeAdminKeyByBackup(address,address)"))
	bytes4 internal constant CHANGE_ADMIN_KEY_BY_BACKUP = 0xfdd54ba1;
	// Equals to bytes4(keccak256("changeAdminKeyWithoutDelay(address,address)"))
	bytes4 internal constant CHANGE_ADMIN_KEY_WITHOUT_DELAY = 0x441d2e50;
	// Equals to bytes4(keccak256("changeAllOperationKeys(address,address[])"))
	bytes4 internal constant CHANGE_ALL_OPERATION_KEYS = 0xd3b9d4d6;
	// Equals to bytes4(keccak256("unfreeze(address)"))
	bytes4 internal constant UNFREEZE = 0x45c8b1a6;

    event ProposalExecuted(address indexed client, address indexed proposer, bytes functionData);

    // *************** Constructor ********************** //

	constructor(AccountStorage _accountStorage)
		BaseLogic(_accountStorage)
		public
	{
	}

    // *************** Proposal ********************** //

    /* ‘executeProposal’ is shared by AccountLogic and DualsigsLogic,
       proposed actions called from 'executeProposal':
         AccountLogic: changeAdminKeyByBackup
         DualsigsLogic: changeAdminKeyWithoutDelay, changeAllOperationKeysWithoutDelay, unfreezeWithoutDelay
    */
    function executeProposal(address payable _client, address _proposer, bytes calldata _functionData) external {
        bytes4 proposedActionId = getMethodId(_functionData);
        bytes32 functionHash = keccak256(_functionData);

        checkApproval(_client, _proposer, proposedActionId, functionHash);

        // call functions with/without delay
        // solium-disable-next-line security/no-low-level-calls
        (bool success,) = address(this).call(_functionData);
        require(success, "executeProposal failed");

        accountStorage.clearProposalData(_client, _proposer, proposedActionId);
        emit ProposalExecuted(_client, _proposer, _functionData);
    }

    function checkApproval(address _client, address _proposer, bytes4 _proposedActionId, bytes32 _functionHash) internal view {
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

    function checkRelation(address _client, address _backup) internal view {
        require(_backup != address(0), "backup cannot be 0x0");
        require(_client != address(0), "client cannot be 0x0");
        bool isBackup;
        for (uint256 i = 0; i <= MAX_DEFINED_BACKUP_INDEX; i++) {
            address backup = accountStorage.getBackupAddress(_client, i);
            uint256 effectiveDate = accountStorage.getBackupEffectiveDate(_client, i);
            uint256 expiryDate = accountStorage.getBackupExpiryDate(_client, i);
            // backup match and effective and not expired
            if (_backup == backup && isEffectiveBackup(effectiveDate, expiryDate)) {
                isBackup = true;
                break;
            }
        }
        require(isBackup, "backup does not exist in list");
    }

    function isEffectiveBackup(uint256 _effectiveDate, uint256 _expiryDate) internal view returns(bool) {
        return (_effectiveDate <= now) && (_expiryDate > now);
    }

    function clearRelatedProposalAfterAdminKeyChanged(address payable _client) internal {
        //clear any existing proposal proposed by both, proposer is _client
        accountStorage.clearProposalData(_client, _client, CHANGE_ADMIN_KEY_WITHOUT_DELAY);

        //clear any existing proposal proposed by backup, proposer is one of the backups
        for (uint256 i = 0; i <= MAX_DEFINED_BACKUP_INDEX; i++) {
            address backup = accountStorage.getBackupAddress(_client, i);
            uint256 effectiveDate = accountStorage.getBackupEffectiveDate(_client, i);
            uint256 expiryDate = accountStorage.getBackupExpiryDate(_client, i);
            if (backup != address(0) && isEffectiveBackup(effectiveDate, expiryDate)) {
                accountStorage.clearProposalData(_client, backup, CHANGE_ADMIN_KEY_BY_BACKUP);
            }
        }
    }

}