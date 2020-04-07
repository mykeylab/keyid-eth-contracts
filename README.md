# Overview  
MYKEY is a decentralized smart wallet, which means MYKEY account is a smart contract, rather than an EOA address. This highly improves security and usability.  
MYKEY has 3 main characteristics:  
- **Separated permissions**. Various action permissions(like transferring asset, account management, etc.) are owned by separated multiple keys.  
- **Recoverable account**. All keys of MYKEY account are replaceable. In extreme cases when all keys are lost, one can still recover his/her account with the assist of emergency contacts.  
- **Meta-transaction**. MYKEY users don't need to care about gas price or gas limit. All transactions are delivered by "postman" accounts with meta-transaction mechanism.

![MYKEY contract structure diagram](https://github.com/mykeylab/keyid-eth-contracts/blob/master/images/MYKEY%20contract%20structure%20diagram.png)

MYKEY smart contracts can be divided by function into 4 main modules: **Account Module, Account Storage Module, Logic Management Module and Logic Module.**  

Contract     | Mainnet Address  
------------- | ------------- 
Account  | 0xEf004D954999EB9162aeB3989279eFf2161D5095 
AccountCreator  | 0x185479FB2cAEcbA11227db4186046496D6230243 
AccountStorage  | 0xADc92d1fD878580579716d944eF3460E241604b7 
LogicManager  | 0xDF8aC96BC9198c610285b3d1B29de09621B04528 
AccountLogic (to be deprecated)  | 0x52dAb11c6029862eBF1E65A4d5c30641f5FbD957 
new AccountLogic  | 0xe9737a94eABf50D4E252D7ab68E006639eA73E0D 
DualsigsLogic  | 0x039aA54fEbe98AaaDb91aE2b1Db7aA00a82F8571 
TransferLogic  | 0x1C2349ACBb7f83d07577692c75B6D7654899BF10 
DappLogic  | 0x847f5AbbA6A36c727eCfF76784eE3648BA868808 

# Account Module
Account Module is composed with account template contract(Account.sol) and account proxy contract(AccountProxy.sol). Account template contract is the specific implementation of MYKEY account, while account proxy contract delegates all invocations to account template contract, executing specific operations. This proxy mechanism can save gas costs of creating a huge amount of accounts.  

## Account.sol
Description: account template contract with specific implementation of MYKEY account  
`function init()`: initialization after account creation, initializing account in Account Storage Module and Logic Module  
`function invoke()`: invoke arbitrary external contracts  
`function enableStaticCall()`: register methods defined in Logic Module  
`function changeManager()`: change account's Logic Management Module  
`function ()`: fallback function, delegating invocation to Logic Module  

## AccountProxy.sol  
Description: account proxy contract  
`function ()`: fallback function, delegating invocation to account template contract  

## AccountCreator.sol
Description: account creation contract  
`function createAccount()`: create accounts(proxy contract) and initialize accounts  
`function setAddresses()`: set addresses for account creation  

# Account Storage Module  
Account Storage Module stores data of every MYKEY account, including a set of public keys, emergency contacts, delayed actions and multi-sig proposals. Only invocations sent from Logic Module are allowed to call get/set functions in Account Storage Module.  
## AccountStorage.sol  
`function initAccount()`: initialization of account storage  
`function getKeyData()`: get key data  
`function setKeyData()`: set key data  
`function getBackupAddress()`: get address of emergency contact  
`function getBackupEffectiveDate()`: get effective time of emergency contact  
`function getBackupExpiryDate()`: get expiry time of emergency contact  
`function setBackup()`: set data of emergency contact  
`function clearBackupData()`: remove an emergency contact  
`function getDelayDataHash()`: get hash of delayed item  
`function getDelayDueTime()`: get due time of delayed item  
`function setDelayData()`: set delayed item  
`function clearDelayData()`: remove a delayed item  
`function getProposalDataHash()`: get hash of proposal data  
`function getProposalDataApproval()`: get approvals of proposal  
`function setProposalData()`: set a proposal  
`function clearProposalData()`: remove a proposal  

# Logic Management Module  
Logic contracts authorized by Logic Management Module can be added or removed with delay, and the pending time can also be altered with delay.  
Any update of logic contracts should follow [strict procedures](https://docs.mykey.org/v/English/key-id/keyid-contract-upgrade-process).  
Below is a diagram showing the procedure of logic update:  

![MYKEY logic update diagram](https://github.com/mykeylab/keyid-eth-contracts/blob/master/images/MYKEY%20logic%20update%20diagram.png)

## LogicManager.sol  
Description: management of all logic contracts  
`function submitUpdatePendingTime()`: alter pending time (with delay)  
`function triggerUpdatePendingTime()`: trigger updating pending time  
`function submitUpdate()`: update logic contract (with delay)  
`function cancelUpdate()`: cancel an update of logic contract  
`function triggerUpdate()`: trigger updating logic contract  
`function isAuthorized()`: check if a contract is an authorized logic contract  
`function getAuthorizedLogics()`: get all authorized logic contracts  

# Logic Module  
Logic Module contains logic contracts, which implements specific operations like replacing keys, freezing account, transferring asset and calling external contract etc. In every logic contract, there is an entry method(`function enter()`) which validates signature. So the entry method must be called first before executing any operation.  
Currently, there are 4 logic contracts in Logic Module: ***AccountLogic, DualsigsLogic, TransferLogic and DappLogic.***  

## AccountLogic.sol  
Description: implement logic of account management  
`function changeAdminKey()`: change admin key (with delay)  
`function triggerChangeAdminKey()`: trigger changing admin key  
`function changeAdminKeyByBackup()`: change admin key (proposed by emergency contact, with delay)  
`function triggerChangeAdminkeyByBackup()`: trigger changing admin key proposed by emergency contact  
`function addOperationKey()`: add an operation key  
`function changeAllOperationKeys()`: change all operation keys (with delay)  
`function triggerChangeAllOperationKeys()`: trigger changing all operation keys  
`function freeze()`: freeze account  
`function unfreeze()`: unfreeze account (with delay)  
`function triggerUnfreeze()`: trigger unfreezing account  
`function removeBackup()`: remove an emergency contact (with delay)  
`function cancelDelay()`: cancel delayed operation  
`function cancelAddBackup()`: cancel adding emergency contact  
`function cancelRemoveBackup()`: cancel removing emergency contact  
`function proposeAsBackup()`: propose a proposal as an emergency contact  
`function approveProposal()`: approve a proposal  
`function executeProposal()`: execute a proposal  

## DualsigsLogic.sol  
Description: implement logic of dual signatures  
`function changeAdminKeyWithoutDelay()`: change admin key immediately  
`function changeAllOperationKeysWithoutDelay()`: change all operation keys immediately  
`function unfreezeWithoutDelay()`: unfreeze account immediately  
`function addBackup()`: add an emergency contact  
`function proposeByBoth()`: user proposes a proposal together with an emergency contact  
`function executeProposal()`: execute a proposal  

## TransferLogic.sol  
Description: implement logic of transferring asset  
`function transferEth()`: transfer ETH  
`function transferErc20()`: transfer ERC20 token  
`function transferApprovedErc20()`: transfer approved ERC20 token  
`function transferNft()`: transfer Non-fungible token  
`function transferApprovedNft()`: transfer approved Non-fungible token

## DappLogic.sol  
Description: implement logic of interacting with external contracts  
`function callContract()`: call external contract  
`function callMultiContract()`: call multiple external contracts atomically  
