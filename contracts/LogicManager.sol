pragma solidity ^0.5.4;

import "./utils/Owned.sol";

contract LogicManager is Owned {

    event UpdateLogicSubmitted(address indexed logic, bool value);
    event UpdateLogicCancelled(address indexed logic);
    event UpdateLogicDone(address indexed logic, bool value);

    struct pending {
        bool value; //True: enable a new logic; False: disable an old logic.
        uint dueTime; //due time of a pending logic
    }

    // The authorized logic modules
    mapping (address => bool) public authorized;

    /*
    array
    index 0: AccountLogic address
          1: TransferLogic address
          2: DualsigsLogic address
          3: DappLogic address
          4: ...
     */
    address[] public authorizedLogics;

    // updated logics and their due time of becoming effective
    mapping (address => pending) public pendingLogics;

    struct pendingTime {
        uint curPendingTime; //current pending time
        uint nextPendingTime; //new pending time
        uint dueTime; //due time of new pending time
    }

    pendingTime public pt;

    // how many authorized logics
    uint public logicCount;

    constructor(address[] memory _initialLogics, uint256 _pendingTime) public
    {
        for (uint i = 0; i < _initialLogics.length; i++) {
            address logic = _initialLogics[i];
            authorized[logic] = true;
            logicCount += 1;
        }
        authorizedLogics = _initialLogics;

        pt.curPendingTime = _pendingTime;
        pt.nextPendingTime = _pendingTime;
        pt.dueTime = now;
    }

    /**
     * @dev Submit a new pending time. Called only by owner.
     * @param _pendingTime The new pending time.
     */
    function submitUpdatePendingTime(uint _pendingTime) external onlyOwner {
        pt.nextPendingTime = _pendingTime;
        pt.dueTime = pt.curPendingTime + now;
    }

    /**
     * @dev Trigger updating pending time.
     */
    function triggerUpdatePendingTime() external {
        require(pt.dueTime <= now, "too early to trigger updatePendingTime");
        pt.curPendingTime = pt.nextPendingTime;
    }

    /**
     * @dev check if a logic contract is authorized.
     */
    function isAuthorized(address _logic) external view returns (bool) {
        return authorized[_logic];
    }

    /**
     * @dev get the authorized logic array.
     */
    function getAuthorizedLogics() external view returns (address[] memory) {
        return authorizedLogics;
    }

    /**
     * @dev Submit a new logic. Called only by owner.
     * @param _logic The new logic contract address.
     * @param _value True: enable a new logic; False: disable an old logic.
     */
    function submitUpdate(address _logic, bool _value) external onlyOwner {
        pending storage p = pendingLogics[_logic];
        p.value = _value;
        p.dueTime = now + pt.curPendingTime;
        emit UpdateLogicSubmitted(_logic, _value);
    }

    /**
     * @dev Cancel a logic update. Called only by owner.
     */
    function cancelUpdate(address _logic) external onlyOwner {
        delete pendingLogics[_logic];
        emit UpdateLogicCancelled(_logic);
    }

    /**
     * @dev Trigger updating a new logic.
     * @param _logic The logic contract address.
     */
    function triggerUpdateLogic(address _logic) external {
        pending memory p = pendingLogics[_logic];
        require(p.dueTime > 0, "pending logic not found");
        require(p.dueTime <= now, "too early to trigger updateLogic");
        updateLogic(_logic, p.value);
        delete pendingLogics[_logic];
    }

    /**
     * @dev To update an existing logic, for example authorizedLogics[1],
     * first a new logic is added to the array end, then copied to authorizedLogics[1],
     * then the last logic is dropped, done.
     */
    function updateLogic(address _logic, bool _value) internal {
        if (authorized[_logic] != _value) {
            if(_value) {
                logicCount += 1;
                authorized[_logic] = true;
                authorizedLogics.push(_logic);
            }
            else {
                logicCount -= 1;
                require(logicCount > 0, "must have at least one logic module");
                delete authorized[_logic];
                removeLogic(_logic);
            }
            emit UpdateLogicDone(_logic, _value);
        }
    }

    function removeLogic(address _logic) internal {
        uint len = authorizedLogics.length;
        address lastLogic = authorizedLogics[len - 1];
        if (_logic != lastLogic) {
            for (uint i = 0; i < len; i++) {
                 if (_logic == authorizedLogics[i]) {
                     authorizedLogics[i] = lastLogic;
                     break;
                 }
            }
        }
        authorizedLogics.length--;
    }
}