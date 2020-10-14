# Overview  
MYKEY is a decentralized smart wallet, which means MYKEY account is a smart contract, rather than an EOA address. This highly improves security and usability.  
MYKEY has 3 main characteristics:  
- **Separated permissions**. Various action permissions(like transferring asset, account management, etc.) are owned by separated multiple keys.  
- **Recoverable account**. All keys of MYKEY account are replaceable. In extreme cases when all keys are lost, one can still recover his/her account with the assist of emergency contacts.  
- **Meta-transaction**. MYKEY users don't need to care about gas price or gas limit. All transactions are delivered by "postman" accounts with meta-transaction mechanism.

![MYKEY contract structure diagram](https://github.com/mykeylab/keyid-eth-contracts/blob/master/images/MYKEY%20contract%20structure%20diagram.png)

MYKEY smart contracts can be divided by function into 4 main modules: **Account Module, Account Storage Module, Logic Management Module and Logic Module.**  

Contract     | Mainnet Address  | Ropsten Testnet Address
------------- | ------------- | ------------- 
Account  | 0xEf004D954999EB9162aeB3989279eFf2161D5095 | 0xcb72410150c06CfA95E224dA868EC12e8876FAD5
AccountCreator  | 0x185479FB2cAEcbA11227db4186046496D6230243 | 0x7E7cBD4e3a5D66FBD67f1CF46d4376ade597a060
AccountStorage  | 0xADc92d1fD878580579716d944eF3460E241604b7 | 0x6185Dd4709982c03750e03FA8b3fF30D042585b9
LogicManager  | 0xDF8aC96BC9198c610285b3d1B29de09621B04528 | 0x9651C050C7E43d84e20629149000C96CF3D8e258
AccountLogic  | 0x205dc661Ee6946319ebb0698A017BCc20549910F | 0x2F1396Dfc9b799AdEE4277077aE0d99a9Aa091da
TransferLogic  | 0x1C2349ACBb7f83d07577692c75B6D7654899BF10 | 0x4c57328b67fc81c5c85bfa4f296eb4d106932369
DualsigsLogic  | 0x142914E134348E51c5f402bAeD81810A1f829e7B | 0x4E5ACA81a1276805c09E724EB550a1DA06Fc840E
DappLogic  | 0xf9bb55b6a14acd32066182f0f5f0296073f5d054 | 0x0750efc1893971f08ca35dad02e4c5b9a6667e9e
ProposalLogic | 0xdc4a5151c0f29f6defa09b383d04b95d587fa275 | 0xd9144d661B9E5F6eF838645116545CADCB589221
CommonStaticLogic | 0x910119bee96c7a03dd2597d4596e88bdf3aff682 | 0xc34963be7C465f708CA979eed77CF97796dA5DfB

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



# Install
yarn install

# Compile
truffle build

# Test
1. shorten delay time in `AccountBaseLogic.sol` to 2 seconds before running test files
```
uint256 constant internal DELAY_CHANGE_ADMIN_KEY = 2 seconds;//21 days
uint256 constant internal DELAY_CHANGE_OPERATION_KEY = 2 seconds;//7 days
uint256 constant internal DELAY_UNFREEZE_KEY = 2 seconds;//7 days
uint256 constant internal DELAY_CHANGE_BACKUP = 2 seconds;//21 days
uint256 constant internal DELAY_CHANGE_ADMIN_KEY_BY_BACKUP = 2 seconds;//30 days
```

2. truffle test