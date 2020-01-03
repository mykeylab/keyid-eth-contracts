pragma solidity ^0.5.4;

import "./Owned.sol";

contract MultiOwned is Owned {
    mapping (address => bool) public multiOwners;

    modifier onlyMultiOwners {
        require(multiOwners[msg.sender] == true, "must be one of owners");
        _;
    }

    event OwnerAdded(address indexed _owner);
    event OwnerRemoved(address indexed _owner);

    function addOwner(address _owner) external onlyOwner {
        require(_owner != address(0), "owner must not be 0x0");
        if(multiOwners[_owner] == false) {
            multiOwners[_owner] = true;
            emit OwnerAdded(_owner);
        }        
    }

    function removeOwner(address _owner) external onlyOwner {
        require(multiOwners[_owner] == true, "owner not exist");
        delete multiOwners[_owner];
        emit OwnerRemoved(_owner);
    }
}