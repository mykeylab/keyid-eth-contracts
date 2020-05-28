const assert = require('assert');

const AccountStorage = artifacts.require("AccountStorage");
const LogicManager = artifacts.require("LogicManager");
const AccountLogic = artifacts.require("AccountLogic");
const BaseAccount = artifacts.require("Account");
const BaseAccountProxy = artifacts.require("AccountProxy");
const AccountCreator = artifacts.require("AccountCreator");

let accountStorage;
let accountLogic;
let logicManager;
let baseAccount;
let mgrOwner;
let account0;
let account1;
let account2;
let account3;

contract("AccountLogic", accounts => {

	before(async () => {
		account0 = accounts[0];
		account1 = accounts[1];
		account2 = accounts[2];
		account3 = accounts[3];
	
		accountStorage = await AccountStorage.deployed();
		accountLogic = await AccountLogic.deployed();
		logicManager = await LogicManager.deployed();
		baseAccountImp = await BaseAccount.deployed();
		accountCreator = await AccountCreator.deployed();

		baseAccountProxy = await BaseAccountProxy.new(baseAccountImp.address); 

		baseAccount = await BaseAccount.at(baseAccountProxy.address);

		// console.log(`baseAccount ${baseAccount.address}, baseAccountImp.address ${baseAccountImp.address}  `);

		await baseAccount.init(logicManager.address, accountStorage.address, [accountLogic.address], [account1, account2, account3, account3], []);

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
	
	it('create account', async () => {
		var keys = [account2,account3];

		let baseAccountProxy2 = await BaseAccountProxy.new(baseAccountImp.address); 
		let baseAccount2 = await BaseAccount.at(baseAccountProxy2.address)

		let logics = [accountLogic.address]
		await baseAccount2.init(logicManager.address, accountStorage.address, logics, keys, [baseAccount.address])

		var pk0 = await accountStorage.getKeyData(baseAccount2.address, 0);
		var pk1 = await accountStorage.getKeyData(baseAccount2.address, 1);
		assert.equal(pk0, keys[0], "account created with incorrect pubkey address 0.");
		assert.equal(pk1, keys[1], "account created with incorrect pubkey address 1.");
	});

	it('create account by create2', async () => {
		var keys = [account2,account3];
		var bkps = [baseAccount.address];
		var salt = web3.utils.soliditySha3("a");

		await accountCreator.addOwner(account0);
		await accountCreator.setAddresses(logicManager.address, accountStorage.address, baseAccountImp.address);
		var ret = await accountCreator.createCounterfactualAccount(keys,bkps,salt);
		var wallet = ret.logs[0].args.wallet;
		var walletGot = await accountCreator.getCounterfactualAccountAddress(keys,bkps,salt);
		// console.log("accountAddr:",wallet, walletGot);

		assert.equal(wallet, walletGot, "create2 wallet address mismatch.");
	});

	it('change admin key', async () => {

		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
		let nonce = await getNonce();

		let data = web3.eth.abi.encodeFunctionCall({
						name: 'changeAdminKey',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'pkNew'
						}]
					}, [baseAccount.address, account2]);

		let actionId = data.slice(0,10);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);
		let sig = await web3.eth.sign(hash, signingKey);
        sig = fixSignature(sig);

		await accountLogic.enter(data, sig, nonce);

		await sleep(2000);
		await accountLogic.triggerChangeAdminKey(baseAccount.address, account2);

		var adminKeyNew = await accountStorage.getKeyData(baseAccount.address, 0);
		assert.equal(adminKeyNew, account2, "change admin key failed.");
		let h = await accountStorage.getDelayDataHash(baseAccount.address,actionId);
	    assert( h == 0, "clear admin key delay data failed");
	});

	it('add opration key', async () => {

		var pk2 = await accountStorage.getKeyData(baseAccount.address, 2);
		let signingKey = pk2;
		let nonce = await getNonce();
		let index = 3;
		let newKey = account3;
		let funcName = 'addOperationKey';

		let data = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'pkNew'
						}]
					}, [baseAccount.address, newKey]);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);
		let sig = await web3.eth.sign(hash, signingKey);
		sig = fixSignature(sig);
		await accountLogic.enter(data, sig, nonce);

		var oprkeynew = await accountStorage.getKeyData(baseAccount.address, index);
		assert.equal(oprkeynew, newKey, "add operation key failed.");
	
	});

	it('change all opration keys', async () => {

		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
		let nonce = await getNonce();
		let funcName = 'changeAllOperationKeys';
		let pks = [account3, account3, account3, account3];

		let data = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address[]',
							name: 'pks'
						}]
					}, [baseAccount.address, pks]);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);
		let sig = await web3.eth.sign(hash, signingKey);
		sig = fixSignature(sig);
		await accountLogic.enter(data, sig, nonce);

		await sleep(2000);
		await accountLogic.triggerChangeAllOperationKeys(baseAccount.address, pks);

		var oprkeynew = await accountStorage.getKeyData(baseAccount.address, 1);
		assert.equal(oprkeynew, account3, "change all operation keys failed.");
	
	});

	it('freeze all opration keys', async () => {

		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
		let nonce = await getNonce();
		let funcName = 'freeze';

		let data = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						}]
					}, [baseAccount.address]);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);
		let sig = await web3.eth.sign(hash, signingKey);
		sig = fixSignature(sig);
		await accountLogic.enter(data, sig, nonce);	

		var status = await accountStorage.getKeyStatus(baseAccount.address, 1);
		assert.equal(status, 1, "freeze all operation key failed.");
	
	});

	it('unfreeze all opration keys', async () => {

		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
		let nonce = await getNonce();
		let funcName = 'unfreeze';

		let data = web3.eth.abi.encodeFunctionCall({
						name: funcName,
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						}]
					}, [baseAccount.address]);

		let msg = '0x1900' + accountLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);
		let sig = await web3.eth.sign(hash, signingKey);
		sig = fixSignature(sig);
		let tx = await accountLogic.enter(data, sig, nonce);

		await sleep(2000);
		await accountLogic.triggerUnfreeze(baseAccount.address);

		var status = await accountStorage.getKeyStatus(baseAccount.address, 1);
		assert.equal(status, 0, "unfreeze all opration keys failed.");
	
	});

	//ERC1271 test
	it('is valid signature', async () => {
		var pk3 = await accountStorage.getKeyData(baseAccount.address, 3);
		let signingKey = pk3;

		let msg = web3.utils.fromAscii("random message");
		let hash = web3.utils.soliditySha3(msg);
	
		var sig = await web3.eth.sign(hash, signingKey);
		sig = fixSignature(sig);
	
		var abi = [{"constant":true,"inputs":[{"name":"","type":"bytes"},{"name":"","type":"bytes"}],"name":"isValidSignature","outputs":[{"name":"","type":"bytes4"}],"payable":false,"stateMutability":"view","type":"function"}];
		var accnt = await new web3.eth.Contract(abi, baseAccount.address);
	
		let res = await accnt.methods.isValidSignature(msg,sig).call();
		assert.equal(res, '0x20c13b0b', "is not valid sig");
	});

})

async function getNonce() {
	return web3.eth.abi.encodeParameter('uint256', Math.floor(Date.now()*1000));
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
