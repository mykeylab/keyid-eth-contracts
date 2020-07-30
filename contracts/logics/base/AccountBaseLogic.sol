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
	// Equals to bytes4(keccak256("changeAllOperationKeysWithoutDelay(address,address[])"))
	bytes4 internal constant CHANGE_ALL_OPERATION_KEYS_WITHOUT_DELAY = 0x02064abc;
	// Equals to bytes4(keccak256("unfreezeWithoutDelay(address)"))
	bytes4 internal constant UNFREEZE_WITHOUT_DELAY = 0x69521650;
	// Equals to bytes4(keccak256("changeAllOperationKeys(address,address[])"))
	bytes4 internal constant CHANGE_ALL_OPERATION_KEYS = 0xd3b9d4d6;
	// Equals to bytes4(keccak256("unfreeze(address)"))
	bytes4 internal constant UNFREEZE = 0x45c8b1a6;

    // *************** Constructor ********************** //

	constructor(AccountStorage _accountStorage)
		BaseLogic(_accountStorage)
		public
	{
	}

    // *************** Functions ********************** //

    /**
    * @dev Check if a certain account is another's backup.
    */
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
        accountStorage.clearProposalData(_client, _client, CHANGE_ALL_OPERATION_KEYS_WITHOUT_DELAY);
        accountStorage.clearProposalData(_client, _client, UNFREEZE_WITHOUT_DELAY);

        //clear any existing proposal proposed by backup, proposer is one of the backups
        for (uint256 i = 0; i <= MAX_DEFINED_BACKUP_INDEX; i++) {
            address backup = accountStorage.getBackupAddress(_client, i);
            if (backup != address(0)) {
                accountStorage.clearProposalData(_client, backup, CHANGE_ADMIN_KEY_BY_BACKUP);
            }
        }
    }

}