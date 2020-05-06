const AccountStorage = artifacts.require("AccountStorage");
const LogicManager = artifacts.require("LogicManager");
const AccountLogic = artifacts.require("AccountLogic");
const TransferLogic = artifacts.require("TransferLogic");
const DualsigsLogic = artifacts.require("DualsigsLogic");
const DappLogic = artifacts.require("DappLogic");
const BaseAccount = artifacts.require("Account");
const BaseAccountProxy = artifacts.require("AccountProxy");
const AccountCreator = artifacts.require("AccountCreator");

contract("BaseAccountProxy", accounts => {

    let baseAccountImp, baseAccount, logicManager, accountLogic, transferLogic, dappLogic;
    before(async () => {
        baseAccountImp = await BaseAccount.deployed();
        logicManager = await LogicManager.deployed();
        accountLogic = await AccountLogic.deployed();
        transferLogic = await TransferLogic.deployed();
        accountStorage = await AccountStorage.deployed();
        dappLogic = await DappLogic.deployed();
        dualsigsLogic = await DualsigsLogic.deployed();
    });

    beforeEach(async () => {
        baseAccountProxy = await BaseAccountProxy.new(baseAccountImp.address); 
        baseAccount = await BaseAccount.at(baseAccountProxy.address)
    });

    it("should init account correct", async () => {

        let manager = await baseAccount.manager();
        assert.equal(manager, "0x0000000000000000000000000000000000000000", "manager should be null before init");

        await baseAccount.init(logicManager.address, accountStorage.address, [accountLogic.address, transferLogic.address], [accounts[1], accounts[2]], [])

        manager = await baseAccount.manager();
        assert.equal(manager, logicManager.address, "owner should be the owner after init");
    });

    it("should accept ETH", async () => {
        await web3.eth.sendTransaction({from:accounts[0], to:baseAccount.address, value:2000});

        let bal = await web3.eth.getBalance(baseAccount.address)
        assert.equal(bal, 2000, "should have received ETH")
    });

    it("logic manager should have correct logics", async () => {
        var logics = await logicManager.getAuthorizedLogics();

        assert.equal(accountLogic.address, logics[0], "wrong accountLogic");
        assert.equal(transferLogic.address, logics[1], "wrong transferLogic");
        assert.equal(dualsigsLogic.address, logics[2], "wrong dualsigsLogic");
        assert.equal(dappLogic.address, logics[3], "wrong dappLogic");
    });
})