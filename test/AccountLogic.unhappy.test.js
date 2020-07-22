const truffleAssert = require('truffle-assertions');

const AccountStorage = artifacts.require("AccountStorage");
const LogicManager = artifacts.require("LogicManager");
const AccountLogic = artifacts.require("AccountLogic");
const CommonStaticLogic = artifacts.require("CommonStaticLogic");
const BaseAccount = artifacts.require("Account");
const BaseAccountProxy = artifacts.require("AccountProxy");
const AccountCreator = artifacts.require("AccountCreator");

let accountStorage;
let accountLogic;
let commonStaticLogic;
let logicManager;
let baseAccount;
let baseAccount1;
let baseAccount2;
let mgrOwner;
let account0;
let account1;
let account2;
let account3;

contract("AccountLogic unhappy", accounts => {

	before(async () => {
		account0 = accounts[0];
		account1 = accounts[1];
		account2 = accounts[2];
		account3 = accounts[3];
	
		accountStorage = await AccountStorage.deployed();
		accountLogic = await AccountLogic.deployed();
		commonStaticLogic= await CommonStaticLogic.deployed();
		logicManager = await LogicManager.deployed();
		baseAccountImp = await BaseAccount.deployed();
        accountCreator = await AccountCreator.deployed();
        
        var keys = [account1, account2, account3, account3, account3];
        let logics = [accountLogic.address, commonStaticLogic.address];

		let baseAccountProxy = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount = await BaseAccount.at(baseAccountProxy.address);
        await baseAccount.init(logicManager.address, accountStorage.address, logics, keys, []);
        
		let baseAccountProxy1 = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount1 = await BaseAccount.at(baseAccountProxy1.address);
        await baseAccount1.init(logicManager.address, accountStorage.address, logics, keys, []);
        
		let baseAccountProxy2 = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount2 = await BaseAccount.at(baseAccountProxy2.address)
		await baseAccount2.init(logicManager.address, accountStorage.address, logics, keys, [baseAccount.address, account1]);

		mgrOwner = await logicManager.owner();
	
		// console.log("accountstorage:", accountStorage.address);
		// console.log("accountlogic:", accountLogic.address);
		// console.log("logicManager:", logicManager.address);
		// console.log("baseaccount:", baseAccount.address);
		// console.log("mgrOwner:", mgrOwner);

	});

    // *************** change admin key ********************** //

	it('should not allow change adm key to address 0x0', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
        let pkNew = '0x0000000000000000000000000000000000000000';
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
					}, [baseAccount.address, pkNew]);
		let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });
    
	it('should not allow identical admin key', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
        let pkNew = pk0;
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
					}, [baseAccount.address, pkNew]);
		let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });
    
	it('should not allow reenter admin key change', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
        let pkNew = account3;
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
					}, [baseAccount.address, pkNew]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await accountLogic.enter(data, sig, nonce);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

	it('should not allow triggering too early', async () => {
        await truffleAssert.reverts(accountLogic.triggerChangeAdminKey(baseAccount.address,account3), "too early to trigger");
	});
    
	it('should not allow triggering wrong hash', async () => {
        await sleep(2000);
        await truffleAssert.reverts(accountLogic.triggerChangeAdminKey(baseAccount.address,account2), "delay hash unmatch");
	});

    // *************** add operation key ********************** //

	it('should not allow adding address 0x0', async () => {
		var pk2 = await accountStorage.getKeyData(baseAccount.address, 2);
		let signingKey = pk2;
        let nonce = await getNonce();
        let pkNew = '0x0000000000000000000000000000000000000000';
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'addOperationKey',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'pkNew'
						}]
					}, [baseAccount.address, pkNew]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

    // *************** change all opr keys ********************** //

    it('should not allow invalid number of keys', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
        let pks = [account3];
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'changeAllOperationKeys',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address[]',
							name: 'pks'
						}]
					}, [baseAccount.address, pks]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

    it('should not allow change opr key to 0x0', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
        let pks = [account3,account3,account3,'0x0000000000000000000000000000000000000000'];
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'changeAllOperationKeys',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address[]',
							name: 'pks'
						}]
					}, [baseAccount.address, pks]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

	it('should not allow reenter operation keys change', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
        let pks = [account3,account3,account3,account3];
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'changeAllOperationKeys',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address[]',
							name: 'pks'
						}]
					}, [baseAccount.address, pks]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await accountLogic.enter(data, sig, nonce);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

	it('should not allow triggering too early', async () => {
        let pks = [account3,account3,account3,account3];
        await truffleAssert.reverts(accountLogic.triggerChangeAllOperationKeys(baseAccount.address,pks), "too early to trigger");
	});
    
	it('should not allow triggering wrong hash', async () => {
        await sleep(2000);
        let pks = [account3,account3,account3,account2];
        await truffleAssert.reverts(accountLogic.triggerChangeAllOperationKeys(baseAccount.address,pks), "delay hash unmatch");
    });
    
    // *************** unfreeze ********************** //

	it('should not allow reenter unfreeze', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'unfreeze',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						}]
					}, [baseAccount.address]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await accountLogic.enter(data, sig, nonce);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

	it('should not allow triggering too early', async () => {
        await truffleAssert.reverts(accountLogic.triggerUnfreeze(baseAccount.address), "too early to trigger");
    });
    
    // *************** remove backup ********************** //

	it('should not allow remove backup not exist', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'removeBackup',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						}]
					}, [baseAccount2.address, account3]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

	it('should not allow reenter remove backup', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'removeBackup',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						}]
					}, [baseAccount2.address, account1]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await accountLogic.enter(data, sig, nonce);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

	it('should not allow cancel remove nonexist backup', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'cancelRemoveBackup',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						}]
					}, [baseAccount2.address, account3]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

	it('should not allow cancel remove expired backup', async () => {
		var pk0 = await accountStorage.getKeyData(baseAccount.address, 0);
		let signingKey = pk0;
        let nonce = await getNonce();
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'cancelRemoveBackup',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'account'
						},{
							type: 'address',
							name: 'backup'
						}]
					}, [baseAccount2.address, account1]);
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await sleep(2000);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

    // *************** propose as backup ********************** //

    it('should not allow propose data with invalid client', async () => {
		let nonce = await getNonce();
		let client = baseAccount2.address;
        let backup = baseAccount.address;
        let signingKey = await accountStorage.getKeyData(backup, 4);
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
					}, [account1, account3]);
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'proposeAsBackup',
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
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });
    
    it('should not allow propose invalid proposal', async () => {
		let nonce = await getNonce();
		let client = baseAccount2.address;
        let backup = baseAccount.address;
        let signingKey = await accountStorage.getKeyData(backup, 4);
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
					}, [account1, account3]);
		let data = web3.eth.abi.encodeFunctionCall({
						name: 'proposeAsBackup',
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
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
	});

    it('should not allow propose by non-backup', async () => {
		let nonce = await getNonce();
		let client = baseAccount2.address;
        let backup = baseAccount1.address;
        let signingKey = await accountStorage.getKeyData(backup, 4);
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
						name: 'proposeAsBackup',
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
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });
    
    it('should not allow approve data with invalid client', async () => {
		let nonce = await getNonce();
		let client = baseAccount2.address;
        let backup = baseAccount.address;
        let signingKey = await accountStorage.getKeyData(backup, 4);
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
						name: 'proposeAsBackup',
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
        let sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await accountLogic.enter(data, sig, nonce);

        fData = web3.eth.abi.encodeFunctionCall({
                    name: 'changeAdminKeyByBackup',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'account'
                    },{
                        type: 'address',
                        name: 'pkNew'
                    }]
                }, [account1, account3]);
        data = web3.eth.abi.encodeFunctionCall({
                    name: 'approveProposal',
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
                        name: 'data'
                    }]
                }, [backup, client, backup, fData]);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

    it('should not allow approve by invalid proposer', async () => {
		let nonce = await getNonce();
		let client = baseAccount2.address;
        let backup = baseAccount.address;
        let signingKey = await accountStorage.getKeyData(backup, 4);
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
                    name: 'approveProposal',
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
                        name: 'data'
                    }]
                }, [backup, client, account1, fData]);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

    it('should not allow approve by invalid backup', async () => {
		let nonce = await getNonce();
		let client = baseAccount2.address;
        let backup = baseAccount1.address;
        let signingKey = await accountStorage.getKeyData(backup, 4);
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
                    name: 'approveProposal',
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
                        name: 'data'
                    }]
                }, [backup, client, backup, fData]);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

    it('should not allow approve invalid proposal', async () => {
		let nonce = await getNonce();
		let client = baseAccount2.address;
        let backup = baseAccount.address;
        let signingKey = await accountStorage.getKeyData(backup, 4);
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
                }, [client, account3]);
        let data = web3.eth.abi.encodeFunctionCall({
                    name: 'approveProposal',
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
                        name: 'data'
                    }]
                }, [backup, client, backup, fData]);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

    it('should not allow cancel dual signed proposal', async () => {
		let nonce = await getNonce();
		let client = baseAccount2.address;
        let backup = baseAccount.address;
        let signingKey = await accountStorage.getKeyData(client, 0);
        let data = web3.eth.abi.encodeFunctionCall({
                    name: 'cancelProposal',
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
                }, [client, client, '0xfdd54ba1']);
        nonce = await getNonce();
        sig = await getSig(accountLogic.address, data, nonce, signingKey);
        await truffleAssert.reverts(accountLogic.enter(data,sig,nonce), "calling self failed");
    });

})

async function getSig(logicAddr, data, nonce, signingKey) {
    let msg = '0x1900' + logicAddr.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);
    let sig = await web3.eth.sign(hash, signingKey);
    sig = fixSignature(sig);
    return sig;
}

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
