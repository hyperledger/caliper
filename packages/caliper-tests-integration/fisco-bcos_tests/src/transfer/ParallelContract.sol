pragma solidity ^0.4.25;

contract ParallelConfigPrecompiled
{
    function registerParallelFunctionInternal(address, string, uint256) public returns (int);
    function unregisterParallelFunctionInternal(address, string) public returns (int);
}

contract ParallelContract
{
    ParallelConfigPrecompiled precompiled = ParallelConfigPrecompiled(0x1006);

    function registerParallelFunction(string functionName, uint256 criticalSize) public
    {
        precompiled.registerParallelFunctionInternal(address(this), functionName, criticalSize);
    }

    function unregisterParallelFunction(string functionName) public
    {
        precompiled.unregisterParallelFunctionInternal(address(this), functionName);
    }

    function enableParallel() public;
    function disableParallel() public;
}
