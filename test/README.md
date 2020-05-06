
1. install [Truffle](https://github.com/trufflesuite/truffle)

2. shorten delay time in `AccountBaseLogic.sol` to 2 seconds before running test files
```
uint256 constant internal DELAY_CHANGE_ADMIN_KEY = 2 seconds;//21 days
uint256 constant internal DELAY_CHANGE_OPERATION_KEY = 2 seconds;//7 days
uint256 constant internal DELAY_UNFREEZE_KEY = 2 seconds;//7 days
uint256 constant internal DELAY_CHANGE_BACKUP = 2 seconds;//21 days
uint256 constant internal DELAY_CHANGE_ADMIN_KEY_BY_BACKUP = 2 seconds;//30 days
```

3. `truffle test`