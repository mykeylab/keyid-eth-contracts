const assert = require('assert');

const AccountStorage = artifacts.require("AccountStorage");
const LogicManager = artifacts.require("LogicManager");
const AccountLogic = artifacts.require("AccountLogic");
const BaseAccount = artifacts.require("Account");
const AccountCreator = artifacts.require("AccountCreator");
const BaseAccountProxy = artifacts.require("AccountProxy");

let accountStorage;
let accountLogic;
let dualsigsLogic;
let logicManager;
let baseAccount;
let baseAccount2;
let baseAccount3;
let mgrOwner;
let account0;
let account1;
let account2;
let account3;

contract("AccountLogic cancel delayed or proposal", accounts => {

	before(async () => {
		account0 = accounts[0];
		account1 = accounts[1];
		account2 = accounts[2];
		account3 = accounts[3];
	
		accountStorage = await AccountStorage.deployed();
		accountLogic = await AccountLogic.deployed();
		logicManager = await LogicManager.deployed();
		baseAccountImp = await BaseAccount.deployed();

		baseAccountProxy = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount = await BaseAccount.at(baseAccountProxy.address);

		let baseAccountProxy2 = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount2 = await BaseAccount.at(baseAccountProxy2.address);

		let baseAccountProxy3 = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount3 = await BaseAccount.at(baseAccountProxy3.address);

		var keys = [account0, account1, account2, account3, account3];
        let logics = [accountLogic.address];
		await baseAccount2.init(logicManager.address, accountStorage.address, logics, keys, []);
		await baseAccount3.init(logicManager.address, accountStorage.address, logics, keys, []);
		var bkps = [baseAccount2.address, baseAccount3.address];
		await baseAccount.init(logicManager.address, accountStorage.address, logics, keys, bkps);

		mgrOwner = await logicManager.owner();
	
		// console.log("accountstorage:", accountStorage.address);
		// console.log("accountlogic:", accountLogic.address);
		// console.log("logicManager:", logicManager.address);
		// console.log("baseaccount:", baseAccount.address);
		// console.log("mgrOwner:", mgrOwner);

	});


	it('check current logics of logicManager', async () => {
		const a = await logicManager.authorized(accountLogic.address);
		assert.equal(a, true, "Current logic not correct.");
	});
	
	it('check manager of BaseAccount', async () => {
		const mgr = await baseAccount.manager();
		assert.equal(mgr, logicManager.address, "The mgr of baseAccount is not correct.");
	});

	it('propose solely by backup', async () => {

		let backupNonce = await getNonce();
		let funcName = 'proposeAsBackup';
		let client = baseAccount.address;
		let backup = baseAccount2.address;

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
					}, [client, account3]);

		let data = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'backup'
						},{
							type: 'address',
							name: 'client'
						},{
							type: 'bytes',
							name: 'functionData'
						}]
					}, [backup, client, fData]);

		let funcHash = web3.utils.soliditySha3(fData);
		let proposedActionId = fData.slice(0,10);

		// backup sign with assist key
		let backupMsg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + backupNonce.toString('16').slice(2);
		let bhash = web3.utils.soliditySha3(backupMsg);
		var backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await web3.eth.sign(bhash, backupKey);
        backupSig = fixSignature(backupSig);
		await accountLogic.enter(data, backupSig, backupNonce);

		let approved = await accountStorage.getProposalDataApproval(client, backup, proposedActionId);
		assert.equal(approved[0], backup, "propose by solely backup failed.");
	
	});

	it('cancel proposal', async () => {
		let client = baseAccount.address;
		let proposeBackup = baseAccount2.address;
        let backup = baseAccount3.address;
		let clientNonce = await getNonce();
		let funcName = 'cancelProposal';

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
					}, [client, account3]);
		let fHash = web3.utils.soliditySha3(fData);
		let proposedActionId = fData.slice(0,10);

		let data = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'client'
						},{
							type: 'address',
							name: 'proposer'
						},{
							type: 'bytes4',
							name: 'proposedActionId'
						}]
					}, [client, proposeBackup, proposedActionId]);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + clientNonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);

		var clientKey = await accountStorage.getKeyData(client, 0);
		let sig = await web3.eth.sign(hash, clientKey);
		sig = fixSignature(sig);
		await accountLogic.enter(data, sig, clientNonce);

		let approved = await accountStorage.getProposalDataApproval(client, proposeBackup, proposedActionId);
		assert.equal(approved.length, 0, "cancel proposal failed.");
	
	});

	it('cancel removebackup', async () => {
        // try removing Backup first
		let clientNonce = await getNonce();
		let funcName = 'removeBackup';
		let client = baseAccount.address;
		let backup = baseAccount2.address;
		let index = 0; // index in backup list
		var clientKey = await accountStorage.getKeyData(client, 0);

		let data = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						}]
					}, [client, backup]);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + clientNonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);
		let sig = await web3.eth.sign(hash, clientKey);
		sig = fixSignature(sig);
		await accountLogic.enter(data, sig, clientNonce);

		//then cancel RemoveBackup
		let clientNonce2 = await getNonce();
		funcName = 'cancelRemoveBackup';

		let cdata = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						}]
					}, [client, backup]);

		msg = '0x1900' + accountLogic.address.slice(2) + cdata.slice(2) + clientNonce2.toString('16').slice(2);
		hash = web3.utils.soliditySha3(msg);

		sig = await web3.eth.sign(hash, clientKey);
		sig = fixSignature(sig);
		await accountLogic.enter(cdata, sig, clientNonce2);

		var b = await accountStorage.getBackupAddress(client, index);
		var e = await accountStorage.getBackupExpiryDate(client, index);
		assert.equal(b, baseAccount2.address, "cancel removebackup failed.");
	    assert(e > Date.now()/1000, "cancelRemoveBackup unsuccessful");
	});


})

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
