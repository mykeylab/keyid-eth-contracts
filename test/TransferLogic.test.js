const assert = require('assert');
const truffleAssert = require('truffle-assertions');
const AccountStorage = artifacts.require("AccountStorage");
const LogicManager = artifacts.require("LogicManager");
const TransferLogic = artifacts.require("TransferLogic");
const CommonStaticLogic = artifacts.require("CommonStaticLogic");
const BaseAccount = artifacts.require("Account");
const MyToken = artifacts.require("MyToken");
const MyNft = artifacts.require("MyNft");
const BaseAccountProxy = artifacts.require("AccountProxy");

let accountStorage;
let accountLogic;
let transferLogic;
let commonStaticLogic;
let logicManager;
let baseAccountProxy;
let baseAccountProxy2;
let baseAccount;
let baseAccount2;
let mgrOwner;
let account0;
let account1;
let account2;
let account3;

contract("TransferLogic", accounts => {
	before(async () => {
		account0 = accounts[0];
		account1 = accounts[1];
		account2 = accounts[2];
		account3 = accounts[3];
		
		accountStorage = await AccountStorage.deployed();
        transferLogic = await TransferLogic.deployed();
        commonStaticLogic= await CommonStaticLogic.deployed(); 
		logicManager = await LogicManager.deployed();
		myToken = await MyToken.deployed();
		myNft = await MyNft.deployed();
		baseAccountImp = await BaseAccount.deployed();

		mgrOwner = await logicManager.owner();
		
		// console.log("accountstorage:", accountStorage.address);
		// console.log("transferLogic:", transferLogic.address);
		// console.log("logicManager:", logicManager.address);
		// console.log("mgrOwner:", mgrOwner);
		// console.log("baseAccount:", baseAccount.address);
        // console.log("mytoken:", myToken.address);
        // console.log("mynft:", myNft.address);
    });
    
    beforeEach(async () => {
        var keys1 = [account1,account2];
        baseAccountImp = await BaseAccount.deployed();
		baseAccountProxy = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount = await BaseAccount.at(baseAccountProxy.address)
        await baseAccount.init(logicManager.address, accountStorage.address, [transferLogic.address, commonStaticLogic.address], keys1, [])
        
        var keys2 = [account2,account3];
		baseAccountProxy2 = await BaseAccountProxy.new(baseAccountImp.address); 
		baseAccount2 = await BaseAccount.at(baseAccountProxy2.address)
		await baseAccount2.init(logicManager.address, accountStorage.address, [transferLogic.address, commonStaticLogic.address], keys2, [])
    }); 

	it('transfer eth', async () => {
		var pk1 = await accountStorage.getKeyData(baseAccount.address, 1);

		let toAddr = account2;
		let signingKey = pk1;
		let nonce = await getNonce();
		let amount = 800;  // 800 wei

		let data = web3.eth.abi.encodeFunctionCall({
						name: 'transferEth',
						type: 'function',
						inputs: [{
							type: 'address',
							name: 'from'
						},{
							type: 'address',
							name: 'to'
						},{
							type: 'uint256',
							name: 'amount'
						}]
					}, [baseAccount.address, toAddr, amount]);

		let msg = '0x1900' + transferLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
		let hash = web3.utils.soliditySha3(msg);

		let sig = await web3.eth.sign(hash, signingKey);
        sig = fixSignature(sig);
		await web3.eth.sendTransaction({from:account0, to:baseAccount.address, value:1000});

		var before = await web3.eth.getBalance(baseAccount.address);
		assert.equal(before, 1000, "baseAccount balance before should be 1000 wei")

		await transferLogic.enter(data, sig, nonce);

		var after = await web3.eth.getBalance(baseAccount.address)
		assert.equal(after, 200, "baseAccount balance after  should be 200 wei")
		assert.equal(before - after, amount, "eth transfer failed.");
		
	});


  it('check erc20 token direct transfer', async () => {

    await myToken.mint(baseAccount.address, 10000);

    var pk1 = await accountStorage.getKeyData(baseAccount.address, 1);
    let nonce = await getNonce();
    let signingKey = pk1;
    let toAddr =   account2;
    let amount = '100'; // 100 MTK

    let sendData = web3.eth.abi.encodeFunctionCall({
                    name: 'transferErc20',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'address',
                        name: 'token'
                    },{
                        type: 'uint256',
                        name: 'amount'
                    }]
                }, [baseAccount.address, toAddr, myToken.address, amount]);
    
    let msg = '0x1900' + transferLogic.address.slice(2) + sendData.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);
    let sig = await web3.eth.sign(hash,signingKey);
    sig = fixSignature(sig);
    var balanceBefore = await myToken.balanceOf(baseAccount.address);

    await transferLogic.enter(sendData, sig, nonce);

    var balanceAfter = await myToken.balanceOf(baseAccount.address);

    assert.equal(balanceBefore-balanceAfter, amount, "erc20 token transfer failed.");
  });

  it('check erc20 token approved transfer', async () => {

    await myToken.mint(account3, 10000);
    await myToken.approve(baseAccount.address, 500, {from:account3});

    var pk1 = await accountStorage.getKeyData(baseAccount.address, 1);
    let nonce = await getNonce();
    let signingKey = pk1;
    let toAddr =   account2;
    let amount = '100'; // 100 MTK

    let sendData = web3.eth.abi.encodeFunctionCall({
                    name: 'transferApprovedErc20',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'approvedSpender'
                    },{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'address',
                        name: 'token'
                    },{
                        type: 'uint256',
                        name: 'amount'
                    }]
                }, [baseAccount.address, account3, toAddr, myToken.address, amount]);
    
    let msg = '0x1900' + transferLogic.address.slice(2) + sendData.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);

    let sig = await web3.eth.sign(hash,signingKey);
    sig = fixSignature(sig);
    var balanceBefore = await myToken.balanceOf(account3);

    await transferLogic.enter(sendData, sig, nonce);

    var balanceAfter = await myToken.balanceOf(account3);

    assert.equal(balanceBefore-balanceAfter, amount, "erc20 token approved transfer failed.");
  });

  it('check erc721 token transfer - transferFrom', async () => {
    let tokenId = 100
    await myNft.mint(baseAccount.address, tokenId);

    var pk1 = await accountStorage.getKeyData(baseAccount.address, 1);
    let nonce = await getNonce();
    let signingKey = pk1;
    let toAddr =   baseAccount2.address;
    let emptyBytes = [];
    let safe = false;

    let sendData = web3.eth.abi.encodeFunctionCall({
                    name: 'transferNft',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'address',
                        name: 'nftContract'
                    },{
                        type: 'uint256',
                        name: 'tokenId'
                    },{
                        type: 'bytes',
                        name: 'data'
                    },{
                        type: 'bool',
                        name: 'safe'
                    }]
                }, [baseAccount.address, toAddr, myNft.address, tokenId, emptyBytes, safe]);
    
    let msg = '0x1900' + transferLogic.address.slice(2) + sendData.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);
    let sig = await web3.eth.sign(hash,signingKey);
    sig = fixSignature(sig);

    await transferLogic.enter(sendData, sig, nonce);

    var ownerAfter = await myNft.ownerOf(tokenId);
    assert.equal(ownerAfter, toAddr, "erc721 token transfer failed.");
  });


  it('check erc721 token transfer - safeTransferFrom', async () => {

    let tokenId = 101
    await myNft.mint(baseAccount.address, tokenId);

    var pk1 = await accountStorage.getKeyData(baseAccount.address, 1);
    let nonce = await getNonce();
    let signingKey = pk1;
    let toAddr =   baseAccount2.address;
    let emptyBytes = [];
    let safe = true;

    let sendData = web3.eth.abi.encodeFunctionCall({
                    name: 'transferNft',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'address',
                        name: 'nftContract'
                    },{
                        type: 'uint256',
                        name: 'tokenId'
                    },{
                        type: 'bytes',
                        name: 'data'
                    },{
                        type: 'bool',
                        name: 'safe'
                    }]
                }, [baseAccount.address, toAddr, myNft.address, tokenId, emptyBytes, safe]);
    
    let msg = '0x1900' + transferLogic.address.slice(2) + sendData.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);
    let sig = await web3.eth.sign(hash,signingKey);
    sig = fixSignature(sig);

    await transferLogic.enter(sendData, sig, nonce);

    var ownerAfter = await myNft.ownerOf(tokenId);
    assert.equal(ownerAfter, toAddr, "erc721 token transfer failed.");
  });


  it('check erc721 token approved transfer - transferFrom', async () => {

    let tokenId = 400;
    await myNft.mint(account3, tokenId);
    await myNft.approve(baseAccount.address, tokenId, {from:account3});
        
    var pk1 = await accountStorage.getKeyData(baseAccount.address, 1);
    let nonce = await getNonce();
    let signingKey = pk1;
    let toAddr =   baseAccount2.address;
    let emptyBytes = [];
    let safe = false;

    let sendData = web3.eth.abi.encodeFunctionCall({
                    name: 'transferApprovedNft',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'approvedSpender'
                    },{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'address',
                        name: 'nftContract'
                    },{
                        type: 'uint256',
                        name: 'tokenId'
                    },{
                        type: 'bytes',
                        name: 'data'
                    },{
                        type: 'bool',
                        name: 'safe'
                    }]
                }, [baseAccount.address, account3, toAddr, myNft.address, tokenId, emptyBytes, safe]);
    
    let msg = '0x1900' + transferLogic.address.slice(2) + sendData.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);
    let sig = await web3.eth.sign(hash,signingKey);
    sig = fixSignature(sig);

    await transferLogic.enter(sendData, sig, nonce);

    var ownerAfter = await myNft.ownerOf(tokenId);
    assert.equal(ownerAfter, toAddr, "erc721 token approved transfer failed.");
  });

  it('check erc721 token approved transfer - safeTransferFrom', async () => {

    let tokenId = 401;
    await myNft.mint(account3, tokenId);
    await myNft.approve(baseAccount.address, tokenId, {from:account3});
        
    var pk1 = await accountStorage.getKeyData(baseAccount.address, 1);
    let nonce = await getNonce();
    let signingKey = pk1;
    let toAddr =   baseAccount2.address;
    let emptyBytes = [];
    let safe = true;

    let sendData = web3.eth.abi.encodeFunctionCall({
                    name: 'transferApprovedNft',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'approvedSpender'
                    },{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'address',
                        name: 'nftContract'
                    },{
                        type: 'uint256',
                        name: 'tokenId'
                    },{
                        type: 'bytes',
                        name: 'data'
                    },{
                        type: 'bool',
                        name: 'safe'
                    }]
                }, [baseAccount.address, account3, toAddr, myNft.address, tokenId, emptyBytes, safe]);
    
    let msg = '0x1900' + transferLogic.address.slice(2) + sendData.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);
    let sig = await web3.eth.sign(hash,signingKey);
    sig = fixSignature(sig);

    await transferLogic.enter(sendData, sig, nonce);

    var ownerAfter = await myNft.ownerOf(tokenId);
    assert.equal(ownerAfter, toAddr, "erc721 token approved transfer failed.");
  });


  it('should only let asset key to transfer token', async () => {
    var pk = await accountStorage.getKeyData(baseAccount.address, 0); // admin key

    let toAddr = account2;
    let signingKey = pk;
    let nonce = await getNonce();
    let amount = 1000  

    await web3.eth.sendTransaction({from:account0, to:baseAccount.address, value:2000});

    let data = web3.eth.abi.encodeFunctionCall({
                    name: 'transferEth',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'uint256',
                        name: 'amount'
                    }]
                }, [baseAccount.address, toAddr, amount]);

    let msg = '0x1900' + transferLogic.address.slice(2) + data.slice(2) + (nonce.toString('16')).slice(2);
    let hash = web3.utils.soliditySha3(msg);

    let sig = await web3.eth.sign(hash, signingKey);
    sig = fixSignature(sig);


    await truffleAssert.reverts(
        transferLogic.enter(data, sig, nonce)
    );
    
});


it('should fail to transfer eth over balance', async () => {
    var pk = await accountStorage.getKeyData(baseAccount.address, 1); // asset key

    let toAddr = account2;
    let signingKey = pk;
    let nonce = await getNonce();//32;
    let amount = 1000  // transfer 1000 wei

    // await web3.eth.sendTransaction({from:account0, to:baseAccount.address, value:2000});

    let data = web3.eth.abi.encodeFunctionCall({
                    name: 'transferEth',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'uint256',
                        name: 'amount'
                    }]
                }, [baseAccount.address, toAddr, amount]);

    let msg = '0x1900' + transferLogic.address.slice(2) + data.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);

    let sig = await web3.eth.sign(hash, signingKey);
    sig = fixSignature(sig);


    await truffleAssert.reverts(
        transferLogic.enter(data, sig, nonce)
    );
    
    
});
    


it('should fail to transfer erc20 token over balance', async () => {

    let mintAmount = 100
    await myToken.mint(baseAccount.address, mintAmount);

    var pk1 = await accountStorage.getKeyData(baseAccount.address, 1); 
    let nonce = await getNonce();//64;
    let signingKey = pk1;
    let toAddr =   account2;
    let amount = mintAmount + 1; 

    let sendData = web3.eth.abi.encodeFunctionCall({
                    name: 'transferErc20',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'address',
                        name: 'token'
                    },{
                        type: 'uint256',
                        name: 'amount'
                    }]
                }, [baseAccount.address, toAddr, myToken.address, amount]);
    
    let msg = '0x1900' + transferLogic.address.slice(2) + sendData.slice(2) + nonce.toString('16').slice(2);
    let hash = web3.utils.soliditySha3(msg);
    // console.log('hash:', hash);
    // console.log('address1:', account1);
    // console.log('address2:', account2);
    let sig = await web3.eth.sign(hash, signingKey);
    sig = fixSignature(sig);
    // console.log(balanceBefore + " MTK");

    await truffleAssert.reverts(
        transferLogic.enter(sendData, sig, nonce)
    );


  });



it('should fail to do approved transfer when amount is above allowance', async () => {

    let allowance = 500
    await myToken.mint(account3, 10000);
    await myToken.approve(baseAccount.address, allowance, {from:account3});
    
    var pk1 = await accountStorage.getKeyData(baseAccount.address, 1);
    let nonce = await getNonce();
    let signingKey = pk1;
    let toAddr =   account2;
    let amount = allowance + 1; 

    let sendData = web3.eth.abi.encodeFunctionCall({
                    name: 'transferApprovedErc20',
                    type: 'function',
                    inputs: [{
                        type: 'address',
                        name: 'approvedSpender'
                    },{
                        type: 'address',
                        name: 'from'
                    },{
                        type: 'address',
                        name: 'to'
                    },{
                        type: 'address',
                        name: 'token'
                    },{
                        type: 'uint256',
                        name: 'amount'
                    }]
                }, [baseAccount.address, account3, toAddr, myToken.address, amount]);
    
    let msg = '0x1900' + transferLogic.address.slice(2) + sendData.slice(2) + (nonce.toString('16')).slice(2);
    let hash = web3.utils.soliditySha3(msg);
    // console.log('hash:', hash);
    // console.log('address1:', account1);
    // console.log('address2:', account2);
    let sig = await web3.eth.sign(hash,signingKey);
    sig = fixSignature(sig);
    const balanceBefore = await myToken.balanceOf(account3);
    // console.log(balanceBefore + " MTK");
    
    await truffleAssert.reverts(
        transferLogic.enter(sendData, sig, nonce)
    );


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
