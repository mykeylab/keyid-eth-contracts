pragma solidity ^0.5.4;

import "./base/BaseLogic.sol";

contract TransferLogic is BaseLogic {

    /*
    index 0: admin key
          1: asset(transfer)
          2: adding
          3: reserved(dapp)
          4: assist
     */
    uint constant internal TRANSFER_KEY_INDEX = 1;


    // *************** Events *************************** //

    event TransferLogicEntered(bytes data, uint256 indexed nonce);

    // *************** Constructor ********************** //

    constructor(AccountStorage _accountStorage)
		BaseLogic(_accountStorage)
		public
	{
	}

    // *************** action entry ********************* //

    /**
    * @dev Entry method of TransferLogic.
    * TransferLogic has 5 actions called from 'enter':
        transferEth, transferErc20, transferApprovedErc20, transferNft, transferApprovedNft
    */
    function enter(bytes calldata _data, bytes calldata _signature, uint256 _nonce) external {
        address account = getSignerAddress(_data);
        checkKeyStatus(account, TRANSFER_KEY_INDEX);

        address assetKey = accountStorage.getKeyData(account, TRANSFER_KEY_INDEX);
        checkAndUpdateNonce(assetKey, _nonce);
        bytes32 signHash = getSignHash(_data, _nonce);
        verifySig(assetKey, _signature, signHash);

        // solium-disable-next-line security/no-low-level-calls
        (bool success,) = address(this).call(_data);
        require(success, "calling self failed");
        emit TransferLogicEntered(_data, _nonce);
    }

    // *************** transfer assets ********************* //

    // called from 'enter'
    // signer is '_from'
    function transferEth(address payable _from, address _to, uint256 _amount) external allowSelfCallsOnly {
        // solium-disable-next-line security/no-low-level-calls
        (bool success,) = _from.call(abi.encodeWithSignature("invoke(address,uint256,bytes)", _to, _amount, ""));
        require(success, "calling invoke failed");
    }

    // called from 'enter'
    // signer is '_from'
    function transferErc20(address payable _from, address _to, address _token, uint256 _amount) external allowSelfCallsOnly {
        bytes memory methodData = abi.encodeWithSignature("transfer(address,uint256)", _to, _amount);
        bool success;
        bytes memory res;
        // solium-disable-next-line security/no-low-level-calls
        (success, res) = _from.call(abi.encodeWithSignature("invoke(address,uint256,bytes)", _token, 0, methodData));
        require(success, "calling invoke failed");
        if (res.length > 0) {//compatible with old account template which has no 'invoke()' return value
            res = abi.decode(res, (bytes));
            if (res.length > 0) {//compatible with "Bad" ERC20 token like USDT
                bool r;
                r = abi.decode(res, (bool));
                require(r, "transferErc20 return false");
            }
        }
    }

    // called from 'enter'
    // signer is '_approvedSpender'
    // make sure '_from' has approved allowance to '_approvedSpender'
    function transferApprovedErc20(address payable _approvedSpender, address _from, address _to, address _token, uint256 _amount) external allowSelfCallsOnly {
        bytes memory methodData = abi.encodeWithSignature("transferFrom(address,address,uint256)", _from, _to, _amount);
        bool success;
        bytes memory res;
        // solium-disable-next-line security/no-low-level-calls
        (success, res) = _approvedSpender.call(abi.encodeWithSignature("invoke(address,uint256,bytes)", _token, 0, methodData));
        require(success, "calling invoke failed");
        if (res.length > 0) {//compatible with old account template which has no 'invoke()' return value
            res = abi.decode(res, (bytes));
            if (res.length > 0) {//compatible with "Bad" ERC20 token like USDT
                bool r;
                r = abi.decode(res, (bool));
                require(r, "transferFrom return false");
            }
        }
    }

    // called from 'enter'
    // signer is '_from'
    function transferNft(
        address payable _from, address _to, address _nftContract, uint256 _tokenId, bytes calldata _data, bool _safe)
        external
        allowSelfCallsOnly
    {
        bytes memory methodData;
        if(_safe) {
            methodData = abi.encodeWithSignature("safeTransferFrom(address,address,uint256,bytes)", _from, _to, _tokenId, _data);
        } else {
            methodData = abi.encodeWithSignature("transferFrom(address,address,uint256)", _from, _to, _tokenId);
        }
        bool success;
        // solium-disable-next-line security/no-low-level-calls
        (success,) = _from.call(abi.encodeWithSignature("invoke(address,uint256,bytes)", _nftContract, 0, methodData));
        require(success, "calling invoke failed");
    }

    // called from 'enter'
    // signer is '_approvedSpender'
    // make sure '_from' has approved nftToken to '_approvedSpender'
    function transferApprovedNft(
        address payable _approvedSpender, address _from, address _to, address _nftContract, uint256 _tokenId, bytes calldata _data, bool _safe)
        external
        allowSelfCallsOnly
    {
        bytes memory methodData;
        if(_safe) {
            methodData = abi.encodeWithSignature("safeTransferFrom(address,address,uint256,bytes)", _from, _to, _tokenId, _data);
        } else {
            methodData = abi.encodeWithSignature("transferFrom(address,address,uint256)", _from, _to, _tokenId);
        }
        bool success;
        // solium-disable-next-line security/no-low-level-calls
        (success,) = _approvedSpender.call(abi.encodeWithSignature("invoke(address,uint256,bytes)", _nftContract, 0, methodData));
        require(success, "calling invoke failed");
    }


}

