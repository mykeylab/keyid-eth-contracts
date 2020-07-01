pragma solidity ^0.5.4;

import "./base/AccountBaseLogic.sol";

contract CommonStaticLogic is BaseLogic {
    /*
    index 0: admin key
          1: asset(transfer)
          2: adding
          3: reserved(dapp)
          4: assist
     */
    uint256 internal constant DAPP_KEY_INDEX = 3;

    // Equals to `bytes4(keccak256("onERC721Received(address,address,uint256,bytes)"))`
    bytes4 private constant ERC721_RECEIVED = 0x150b7a02;
    // Equals to `bytes4(keccak256("isValidSignature(bytes,bytes)"))`
    bytes4 private constant ERC1271_ISVALIDSIGNATURE_BYTES = 0x20c13b0b;
    // Equals to `bytes4(keccak256("isValidSignature(bytes32,bytes)"))`
    bytes4 private constant ERC1271_ISVALIDSIGNATURE_BYTES32 = 0x1626ba7e;


    event CommonStaticLogicInitialised(address indexed account);

    // *************** Constructor ********************** //
    constructor(AccountStorage _accountStorage)
        public
        BaseLogic(_accountStorage)
    {
    }

    // *************** Initialization ********************* //
    function initAccount(Account _account)
        external
        allowAccountCallsOnly(_account)
    {
        _account.enableStaticCall(address(this), ERC721_RECEIVED);
        _account.enableStaticCall(address(this), ERC1271_ISVALIDSIGNATURE_BYTES);
        _account.enableStaticCall(address(this), ERC1271_ISVALIDSIGNATURE_BYTES32);
        emit CommonStaticLogicInitialised(address(_account));
    }

    // *************** Implementation of EIP1271 ********************** //

    /**
     * @dev Should return whether the signature provided is valid for the provided data.
     * @param _data Arbitrary length data signed on the behalf of address(this)
     * @param _signature Signature byte array associated with _data
     */
    function isValidSignature(bytes calldata _data, bytes calldata _signature)
        external
        view
        returns (bytes4)
    {
        bytes32 msgHash = keccak256(abi.encodePacked(_data));
        isValidSignature(msgHash, _signature);
        return ERC1271_ISVALIDSIGNATURE_BYTES;
    }

    function isValidSignature(bytes32 _msgHash, bytes memory _signature)
        public
        view
        returns (bytes4)
    {
        require(_signature.length == 65, "invalid signature length");
        checkKeyStatus(msg.sender, DAPP_KEY_INDEX);
        address signingKey = accountStorage.getKeyData(
            msg.sender,
            DAPP_KEY_INDEX
        );
        bytes32 prefixedHash = keccak256(
            abi.encodePacked(SIGN_HASH_PREFIX, _msgHash)
        );
        verifySig(signingKey, _signature, prefixedHash);
        return ERC1271_ISVALIDSIGNATURE_BYTES32;
    }

    // *************** Implementation of EIP721 ********************* //

    function onERC721Received(
        address _operator,
        address _from,
        uint256 _tokenId,
        bytes calldata _data
    ) external pure returns (bytes4) {
        return ERC721_RECEIVED;
    }
}
