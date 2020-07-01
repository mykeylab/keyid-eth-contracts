const assert = require('assert');

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

contract("DualsigsLogic", accounts => {

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
		var bkps = [baseAccount.address];
        let logics = [accountLogic.address, dualsigsLogic.address];
		await baseAccount.init(logicManager.address, accountStorage.address, logics, keys, []);
		await baseAccount1.init(logicManager.address, accountStorage.address, logics, keys, bkps);
		await baseAccount2.init(logicManager.address, accountStorage.address, logics, keys, bkps);

		mgrOwner = await logicManager.owner();
	
		// console.log("accountstorage:", accountStorage.address);
		// console.log("accountlogic:", accountLogic.address);
		// console.log("dualsigslogic:", dualsigsLogic.address);
		// console.log("logicManager:", logicManager.address);
		// console.log("baseaccount:", baseAccount.address);
		// console.log("mgrOwner:", mgrOwner);

	});


	it('check current logics of logicManager', async () => {
		const a = await logicManager.authorized(dualsigsLogic.address);
		assert.equal(a, true, "Current logic not correct.");
	});
	
	it('check manager of BaseAccount', async () => {
		const mgr = await baseAccount.manager();
		assert.equal(mgr, logicManager.address, "The mgr of baseAccount is not correct.");
	});
	
	it('create account', async () => {
		var keys = [account0, account1, account2, account3, account3];
		var bkps = [baseAccount.address];
		let logics = [accountLogic.address, dualsigsLogic.address]

		let baseAccountProxy3 = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount3 = await BaseAccount.at(baseAccountProxy3.address);
		await baseAccount3.init(logicManager.address, accountStorage.address, logics, keys, bkps)

		var pk0 = await accountStorage.getKeyData(baseAccount3.address, 0);
		var pk1 = await accountStorage.getKeyData(baseAccount3.address, 1);

		assert.equal(pk0, keys[0], "account created with incorrect pubkey address 0.");
		assert.equal(pk1, keys[1], "account created with incorrect pubkey address 1.");
	});


	it('add backup', async () => {
		let clientNonce = await getNonce();
		let backupNonce = await getNonce();
		let funcName = 'addBackup';
		let client = baseAccount2.address;
		let backup = baseAccount3.address;

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

		// client sign with admin key
		let clientMsg = '0x1900' + dualsigsLogic.address.slice(2) + data.slice(2) + clientNonce.toString('16').slice(2);
		let chash = web3.utils.soliditySha3(clientMsg);
		var clientKey = await accountStorage.getKeyData(client, 0);
		let clientSig = await web3.eth.sign(chash, clientKey);
		clientSig = fixSignature(clientSig);

		// backup sign with assist key
		let backupMsg = '0x1900' + dualsigsLogic.address.slice(2) + data.slice(2) + backupNonce.toString('16').slice(2);
		let bhash = web3.utils.soliditySha3(backupMsg);
		var backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await web3.eth.sign(bhash, backupKey);
		backupSig = fixSignature(backupSig);

		await dualsigsLogic.enter(data, clientSig, backupSig, clientNonce, backupNonce);

		await sleep(2000);//newly added backup will be effective in 1 second in local test environment

		var b = await accountStorage.getBackupAddress(client, 1);
		var t = await accountStorage.getBackupEffectiveDate(client, 1);
		assert.equal(b, backup, "add backup failed.");
		assert(t < Date.now()/1000, "newly added backup not effective");
	});

	it('propose by both', async () => {
		let clientNonce = 0;
		let backupNonce = await getNonce();
		let funcName = 'proposeByBoth';
		let client = baseAccount2.address;
		let backup = baseAccount3.address;

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
					}, [client, account1]);

		let data = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'client'
						},{
							type: 'address',
							name: 'backup'
						},{
							type: 'bytes',
							name: 'functionData'
						}]
					}, [client, backup, fData]);

		let proposedActionId = fData.slice(0,10);

		// client sign with admin key
		// clientNonce is not needed here (changeAdminKeyWithoutDelay proposed by both)
		let clientMsg = '0x1900' + dualsigsLogic.address.slice(2) + data.slice(2);// + clientNonce.toString('16').slice(2);
		let chash = web3.utils.soliditySha3(clientMsg);
		var clientKey = await accountStorage.getKeyData(client, 0);
		let clientSig = await web3.eth.sign(chash, clientKey);
		clientSig = fixSignature(clientSig);

		// backup sign with assist key
		let backupMsg = '0x1900' + dualsigsLogic.address.slice(2) + data.slice(2) + backupNonce.toString('16').slice(2);
		let bhash = web3.utils.soliditySha3(backupMsg);
		var backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await web3.eth.sign(bhash, backupKey);
		backupSig = fixSignature(backupSig);

		await dualsigsLogic.enter(data, clientSig, backupSig, clientNonce, backupNonce);

		let approved = await accountStorage.getProposalDataApproval(client, client, proposedActionId);
		assert.equal(approved[0], backup, "propose by both failed.");
	
	});

	it('approve proposal', async () => {
		let client = baseAccount2.address;
        let backup = baseAccount.address;
		let backupNonce = await getNonce();
		let funcName = 'approveProposal';

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
					}, [client, account1]);
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
					}, [backup, client, client, fData]);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + backupNonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);

		var backupKey = await accountStorage.getKeyData(backup, 4);
		let sig = await web3.eth.sign(hash, backupKey);
		sig = fixSignature(sig);
		await accountLogic.enter(data, sig, backupNonce);

		let approved = await accountStorage.getProposalDataApproval(client, client, proposedActionId);
		assert.equal(approved[1], backup, "approve proposal failed.");
	
	});

	it('backup propose a proposal', async () => {

		let backupNonce = await getNonce();
		let funcName = 'proposeAsBackup';
		let client = baseAccount2.address;
		let backup = baseAccount.address;

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

		testPropActionId = fData.slice(0,10);

		// backup sign with assist key
		let backupMsg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + backupNonce.toString('16').slice(2);
		let bhash = web3.utils.soliditySha3(backupMsg);
		var backupKey = await accountStorage.getKeyData(backup, 4);
		let backupSig = await web3.eth.sign(bhash, backupKey);
		backupSig = fixSignature(backupSig);

		await accountLogic.enter(data, backupSig, backupNonce);

		let approved = await accountStorage.getProposalDataApproval(client, backup, testPropActionId);
		assert.equal(approved[0], backup, "backup propose a proposal failed.");
		let h = await accountStorage.getProposalDataHash(client,backup,testPropActionId);
	    assert( h > 0, "add proposal failed");
	});

	it('execute proposal', async () => {
		let client = baseAccount2.address;
        let backup = baseAccount.address;

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
					}, [client, account1]);

		await proposalLogic.executeProposal(client, client, fData);

        let adminNew = await accountStorage.getKeyData(client, 0);
		assert.equal(adminNew, account1, "execute proposal failed.");
		let h = await accountStorage.getProposalDataHash(client,backup,testPropActionId);
	    assert( h == 0, "clear related proposal failed");
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
