pragma solidity ^0.4.2;

contract HelloWorld {
    string name;

    constructor() public {
       name = "Hello, World!";
    }

    function get() public view returns(string) {
        return name;
    }

    function  set(string n) public {
    	name = n;
    }
}
