pragma solidity >=0.0.0;

contract Storage {
  uint public balance = 0;

  function receive() public payable {
    balance += msg.value;
  }

  function query() constant public returns (uint256) {
    return balance;
  }
}
