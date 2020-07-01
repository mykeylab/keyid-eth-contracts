const assert = require('assert');

const AccountStorage = artifacts.require("AccountStorage");
const LogicManager = artifacts.require("LogicManager");
const AccountLogic = artifacts.require("AccountLogic");
const BaseAccount = artifacts.require("Account");
const AccountCreator = artifacts.require("AccountCreator");
const BaseAccountProxy = artifacts.require("AccountProxy");
const ProposalLogic = artifacts.require("ProposalLogic");

let accountStorage;
let accountLogic;
let proposalLogic;
let logicManager;
let baseAccount;
let baseAccount2;
let baseAccount3;
let mgrOwner;
let account0;
let account1;
let account2;
let account3;

contract("AccountLogic backup and proposal", accounts => {

	before(async () => {
		account0 = accounts[0];
		account1 = accounts[1];
		account2 = accounts[2];
		account3 = accounts[3];
	
		accountStorage = await AccountStorage.deployed();
		accountLogic = await AccountLogic.deployed();
        proposalLogic = await ProposalLogic.deployed();
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

	it('approve proposal', async () => {
		let client = baseAccount.address;
		let proposeBackup = baseAccount2.address;
        let backup = baseAccount3.address;
		let backupNonce = await getNonce();
		let funcName = 'approveProposal';

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
							name: 'backup'
						},{
							type: 'address',
							name: 'client'
						},{
							type: 'address',
							name: 'proposer'
						},{
							type: 'bytes',
							name: 'functionData'
						}]
					}, [backup, client, proposeBackup, fData]);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + backupNonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);

		var backupKey = await accountStorage.getKeyData(backup, 4);
		let sig = await web3.eth.sign(hash, backupKey);
		sig = fixSignature(sig);
		await accountLogic.enter(data, sig, backupNonce);

		let approved = await accountStorage.getProposalDataApproval(client, proposeBackup, proposedActionId);
		assert.equal(approved[1], backup, "approve proposal failed.");
	
	});

	it('execute proposal', async () => {
		let client = baseAccount.address;
		let proposeBackup = baseAccount2.address;

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

		await proposalLogic.executeProposal(client, proposeBackup,fData);

		await sleep(2000);
		await proposalLogic.triggerChangeAdminKeyByBackup(client, account3);

        let adminNew = await accountStorage.getKeyData(client, 0);
		assert.equal(adminNew, account3, "execute proposal failed.");
	
	});

	it('remove backup', async () => {

		let clientNonce = await getNonce();
		let funcName = 'removeBackup';
		let client = baseAccount.address;
		let backup = baseAccount3.address;
		let index = 1; // index in backup list
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

		await sleep(3000);

		var expiry = await accountStorage.getBackupExpiryDate(client, index);
		assert.equal(Math.floor(Date.now()/1000) > expiry, true, "remove backup failed.");
	
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
