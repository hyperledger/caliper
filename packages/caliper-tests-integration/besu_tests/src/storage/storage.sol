pragma solidity >=0.4.0 <0.6.0;

contract SimpleStorage {
    uint public value;
    
    function update(uint _value) public {
        value = _value;
    }
}