const assert = require('assert');
const rlp = require('rlp');

const AccountStorage = artifacts.require("AccountStorage");
const LogicManager = artifacts.require("LogicManager");
const DappLogic = artifacts.require("DappLogic");
const BaseAccount = artifacts.require("Account");
const MyToken = artifacts.require("MyToken");
const BaseAccountProxy = artifacts.require("AccountProxy");

let accountStorage;
let accountLogic;
let transferLogic;
let logicManager;
let baseAccount;
let baseAccount2;
let mgrOwner;
let account0;
let account1;
let account2;
let account3;

contract("DappLogic", accounts => {
	before(async () => {
		account0 = accounts[0];
		account1 = accounts[1];
		account2 = accounts[2];
		account3 = accounts[3];
		
		accountStorage = await AccountStorage.deployed();
		dappLogic = await DappLogic.deployed();
		logicManager = await LogicManager.deployed();
		myToken = await MyToken.deployed();
		baseAccountImp = await BaseAccount.deployed();
		baseAccountProxy = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount = await BaseAccount.at(baseAccountProxy.address);

        let keys = [account0, account1, account2, account3, account3, account3];
		await baseAccount.init(logicManager.address, accountStorage.address, [dappLogic.address], keys, [])

	    await myToken.mint(baseAccount.address, 10000);

		mgrOwner = await logicManager.owner();
		
		// console.log("accountstorage:", accountStorage.address);
		// console.log("dappLogic:", dappLogic.address);
		// console.log("logicManager:", logicManager.address);
		// console.log("mgrOwner:", mgrOwner);
		// console.log("baseAccount:", baseAccount.address);
        // console.log("mytoken:", myToken.address);
	});

	it('check current logics of logicManager', async () => {
		const a = await logicManager.authorized(dappLogic.address);
		assert.equal(a, true, "Current logic not correct.");
	});
	
	it('check manager of BaseAccount', async () => {
		const mgr = await baseAccount.manager();
		assert.equal(mgr, logicManager.address, "The mgr of baseAccount is not correct.");
	});


	it('call dapp contract', async () => {

		var dappKey = await accountStorage.getKeyData(baseAccount.address, 5);
		let nonce = await getNonce();
		let dappAddr = myToken.address; // erc20 token contract
		let amount = '100'; // 100 MTK
		let toAddr =   account2;

		let tData = web3.eth.abi.encodeFunctionCall({
		                name: 'transfer',
		                type: 'function',
		                inputs: [{
		                    type: 'address',
		                    name: 'recipient'
		                },{
		                    type: 'uint256',
		                    name: 'amount'
		                }]
		            }, [toAddr, amount]);

		let data = web3.eth.abi.encodeFunctionCall({
		                name: 'callContract',
		                type: 'function',
		                inputs: [{
		                    type: 'address',
		                    name: 'account'
		                },{
		                    type: 'address',
		                    name: 'target'
		                },{
		                    type: 'uint256',
		                    name: 'value'
		                },{
		                    type: 'bytes',
		                    name: 'methodData'
		                }]
		            }, [baseAccount.address, dappAddr, 0, tData]);

		let msg = '0x1900' + dappLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);

		let sig = await web3.eth.sign(hash,dappKey);
        sig = fixSignature(sig);
		var balanceBefore = await myToken.balanceOf(baseAccount.address);

		await dappLogic.enter(data, sig, nonce);

		var balanceAfter = await myToken.balanceOf(baseAccount.address);

		assert.equal(balanceBefore-balanceAfter, amount, "call dapp contract failed.");
	});

	it('call multi contracts', async () => {

		var dappKey = await accountStorage.getKeyData(baseAccount.address, 5);
		let nonce = await getNonce();
		let dappAddr = myToken.address; // erc20 token contract
		let amount = '100'; // 100 MTK
		let toAddr =   account2;

		let tData = web3.eth.abi.encodeFunctionCall({
		                name: 'transfer',
		                type: 'function',
		                inputs: [{
		                    type: 'address',
		                    name: 'recipient'
		                },{
		                    type: 'uint256',
		                    name: 'amount'
		                }]
					}, [toAddr, amount]);
		var rlp_encoded = rlp.encode([tData, tData]);
		var tBytes = '0x'+rlp_encoded.toString('hex');

		let data = web3.eth.abi.encodeFunctionCall({
		                name: 'callMultiContract',
		                type: 'function',
		                inputs: [{
		                    type: 'address',
		                    name: 'account'
		                },{
		                    type: 'address[]',
		                    name: 'targets'
		                },{
		                    type: 'uint256[]',
		                    name: 'values'
		                },{
		                    type: 'bytes',
		                    name: 'rlpBytes'
		                }]
		            }, [baseAccount.address, [dappAddr,dappAddr], [0,0], tBytes]);

		let msg = '0x1900' + dappLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);

		let sig = await web3.eth.sign(hash,dappKey);
        sig = fixSignature(sig);
		const balanceBefore = await myToken.balanceOf(baseAccount.address);

		await dappLogic.enter(data, sig, nonce);

		const balanceAfter = await myToken.balanceOf(baseAccount.address);

		assert.equal(balanceBefore-balanceAfter, amount*2, "call dapp contract failed.");
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
