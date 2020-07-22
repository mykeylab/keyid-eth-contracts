const truffleAssert = require('truffle-assertions');

const AccountStorage = artifacts.require("AccountStorage");
const LogicManager = artifacts.require("LogicManager");
const AccountLogic = artifacts.require("AccountLogic");
const BaseAccount = artifacts.require("Account");
const AccountCreator = artifacts.require("AccountCreator");
const BaseAccountProxy = artifacts.require("AccountProxy");
const DualsigsLogic = artifacts.require("DualsigsLogic");
const ProposalLogic = artifacts.require("ProposalLogic");

let accountStorage;
let accountLogic;
let dualsigsLogic;
let proposalLogic;
let logicManager;
let baseAccount;
let baseAccount1;
let baseAccount2;
let baseAccount3;
let mgrOwner;
let account0;
let account1;
let account2;
let account3;
let testPropActionId;

contract("DualsigsLogic unhappy", accounts => {

	before(async () => {
		account0 = accounts[0];
		account1 = accounts[1];
		account2 = accounts[2];
		account3 = accounts[3];
	
		accountStorage = await AccountStorage.deployed();
		accountLogic = await AccountLogic.deployed();
		dualsigsLogic = await DualsigsLogic.deployed();
		proposalLogic = await ProposalLogic.deployed();
		logicManager = await LogicManager.deployed();
		baseAccountImp = await BaseAccount.deployed();

		baseAccountProxy = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount = await BaseAccount.at(baseAccountProxy.address);

		let baseAccountProxy1 = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount1 = await BaseAccount.at(baseAccountProxy1.address);

		let baseAccountProxy2 = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount2 = await BaseAccount.at(baseAccountProxy2.address);

		var keys = [account0, account1, account2, account3, account3];
		var bkps = [baseAccount1.address];
        let logics = [accountLogic.address, dualsigsLogic.address];
		await baseAccount.init(logicManager.address, accountStorage.address, logics, keys, bkps);
		await baseAccount1.init(logicManager.address, accountStorage.address, logics, keys, []);
		await baseAccount2.init(logicManager.address, accountStorage.address, logics, keys, []);

		mgrOwner = await logicManager.owner();
	
		// console.log("accountstorage:", accountStorage.address);
		// console.log("accountlogic:", accountLogic.address);
		// console.log("dualsigslogic:", dualsigsLogic.address);
		// console.log("logicManager:", logicManager.address);
		// console.log("baseaccount:", baseAccount.address);
		// console.log("mgrOwner:", mgrOwner);

	});

    // *************** add backup ********************** //

	it('should not allow add oneself as backup', async () => {
		let clientNonce = await getNonce();
		let backupNonce = await getNonce();
		let client = baseAccount.address;
		let backup = baseAccount.address;
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'addBackup',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						}]
					}, [client, backup]);
		// client sign with admin key
		let clientKey = await accountStorage.getKeyData(client, 0);
		let clientSig = await getSig(dualsigsLogic.address, data, clientNonce, clientKey);
		// backup sign with assist key
		let backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await getSig(dualsigsLogic.address, data, backupNonce, backupKey);
        await truffleAssert.reverts(dualsigsLogic.enter(data,clientSig,backupSig,clientNonce,backupNonce), "enterWithDualSigs failed");
    });

	it('should not allow add a backup already exists', async () => {
		let clientNonce = await getNonce();
		let backupNonce = await getNonce();
		let client = baseAccount.address;
		let backup = baseAccount1.address;
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'addBackup',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						}]
					}, [client, backup]);
		// client sign with admin key
		let clientKey = await accountStorage.getKeyData(client, 0);
		let clientSig = await getSig(dualsigsLogic.address, data, clientNonce, clientKey);
		// backup sign with assist key
		let backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await getSig(dualsigsLogic.address, data, backupNonce, backupKey);
        await truffleAssert.reverts(dualsigsLogic.enter(data,clientSig,backupSig,clientNonce,backupNonce), "enterWithDualSigs failed");
    });

    // *************** propose by both ********************** //

	it('should not allow invalid client in data', async () => {
		let clientNonce = '';
		let backupNonce = await getNonce();
		let client = baseAccount.address;
        let backup = baseAccount1.address;
		let fData = web3.eth.abi.encodeFunctionCall({
            name: 'changeAdminKeyWithoutDelay',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'account'
            },{
                type: 'address',
                name: 'pkNew'
            }]
        }, [account1, account2]);
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'proposeByBoth',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						},{
							type: 'bytes',
							name: 'data'
						}]
					}, [client, backup, fData]);
		// client sign with admin key
		let clientKey = await accountStorage.getKeyData(client, 0);
		let clientSig = await getSig(dualsigsLogic.address, data, clientNonce, clientKey);
		// backup sign with assist key
		let backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await getSig(dualsigsLogic.address, data, backupNonce, backupKey);
        await truffleAssert.reverts(dualsigsLogic.enter(data,clientSig,backupSig,clientNonce,backupNonce), "enterWithDualSigs failed");
    });

    it('should not allow invalid proposal', async () => {
		let clientNonce = await getNonce();
		let backupNonce = await getNonce();
		let client = baseAccount.address;
        let backup = baseAccount1.address;
		let fData = web3.eth.abi.encodeFunctionCall({
            name: 'changeAdminKeyByBackup',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'account'
            },{
                type: 'address',
                name: 'pkNew'
            }]
        }, [account1, account2]);
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'proposeByBoth',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						},{
							type: 'bytes',
							name: 'data'
						}]
					}, [client, backup, fData]);
		// client sign with admin key
		let clientKey = await accountStorage.getKeyData(client, 0);
		let clientSig = await getSig(dualsigsLogic.address, data, clientNonce, clientKey);
		// backup sign with assist key
		let backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await getSig(dualsigsLogic.address, data, backupNonce, backupKey);
        await truffleAssert.reverts(dualsigsLogic.enter(data,clientSig,backupSig,clientNonce,backupNonce), "enterWithDualSigs failed");
    });

    it('should not allow non-backup', async () => {
		let clientNonce = '';
		let backupNonce = await getNonce();
		let client = baseAccount.address;
        let backup = baseAccount2.address;
		let fData = web3.eth.abi.encodeFunctionCall({
            name: 'changeAdminKeyWithoutDelay',
            type: 'function',
            inputs: [{
                type: 'address',
                name: 'account'
            },{
                type: 'address',
                name: 'pkNew'
            }]
        }, [client, account2]);
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'proposeByBoth',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						},{
							type: 'bytes',
							name: 'data'
						}]
					}, [client, backup, fData]);
		// client sign with admin key
		let clientKey = await accountStorage.getKeyData(client, 0);
		let clientSig = await getSig(dualsigsLogic.address, data, clientNonce, clientKey);
		// backup sign with assist key
		let backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await getSig(dualsigsLogic.address, data, backupNonce, backupKey);
        await truffleAssert.reverts(dualsigsLogic.enter(data,clientSig,backupSig,clientNonce,backupNonce), "enterWithDualSigs failed");
    });
})

async function getSig(logicAddr, data, nonce, signingKey) {
    let msg = '0x1900' + logicAddr.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
    if (nonce == '') {
        msg = '0x1900' + logicAddr.slice(2) + data.slice(2);
    }
    let hash = web3.utils.soliditySha3(msg);
    let sig = await web3.eth.sign(hash, signingKey);
    sig = fixSignature(sig);
    return sig;
}

async function getNonce() {
	return web3.eth.abi.encodeParameter('uint256', Date.now()*1000);
}

function fixSignature (signature) {
  // in geth its always 27/28, in ganache its 0/1. Change to 27/28 to prevent
  // signature malleability if version is 0/1
  // see https://github.com/ethereum/go-ethereum/blob/v1.8.23/internal/ethapi/api.go#L465
  let v = parseInt(signature.slice(130, 132), 16);
  if (v < 27) {
    v += 27;
  }
  const vHex = v.toString(16);
  return signature.slice(0, 130) + vHex;
}

function sleep(ms) {
	return new Promise(resolve => setTimeout(resolve, ms));
}
