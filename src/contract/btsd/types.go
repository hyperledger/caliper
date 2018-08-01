package main

import "github.com/hyperledger/fabric/core/chaincode/shim"

type KeyType string

const (
	SensorKeyType KeyType = "sensor"
)

type stubFunc func(stub shim.ChaincodeStubInterface, args []string) error
