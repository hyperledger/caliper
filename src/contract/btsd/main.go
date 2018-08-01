package main

import (
	"fmt"

	"github.com/hyperledger/fabric/core/chaincode/shim"
)

func main() {
	// Create a new Smart Contract
	err := shim.Start(&RecordManager{})
	if err != nil {
		fmt.Printf("Error creating new Smart Contract: %s", err)
	}
}
