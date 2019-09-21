pragma solidity >=0.0.0;

contract simple {
  uint private money = 0;

  function receive() public payable {
    money += msg.value;
  }

  function balance() public constant returns (uint total) {
    return money;
  }
}
