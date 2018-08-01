package main

import (
	"fmt"

	"encoding/json"

	"github.com/hyperledger/fabric/core/chaincode/shim"
	sc "github.com/hyperledger/fabric/protos/peer"
	"github.com/pkg/errors"
	"github.com/spf13/cast"
)

// RecordManager base implementation of simple Smart Contract
type RecordManager struct {
	actionMap map[string]stubFunc
}

//Init default params on initializing chaincode
func (s *RecordManager) Init(stub shim.ChaincodeStubInterface) sc.Response {
	s.actionMap = map[string]stubFunc{
		"registerSensor": registerSensor,
		"recordInvoke":   recordInvoke,
	}

	return shim.Success(nil)
}

//Invoke do dispatch of stub and call appropriate handler function
func (s *RecordManager) Invoke(stub shim.ChaincodeStubInterface) sc.Response {
	// Retrieve the requested Smart Contract function and arguments
	function, args := stub.GetFunctionAndParameters()
	// Route to the appropriate handler function to interact with the ledger appropriately

	action, ok := s.actionMap[function]
	if !ok {
		return shim.Error(fmt.Sprintf("failed to execute action %s: no such action", function))
	}

	if err := action(stub, args); err != nil {
		return shim.Error(fmt.Sprintf("action failed %s", err.Error()))
	}

	return shim.Success(nil)
}

func registerSensor(stub shim.ChaincodeStubInterface, args []string) error {
	// 0 - ID
	if len(args) != 1 {
		return errors.New("invalid amount of args")
	}

	state, err := stub.GetState(args[0])
	if err != nil {
		return errors.Wrap(err, "failed to get state")
	}
	//sensor already registered
	if state != nil {
		return errors.New(fmt.Sprintf("sensor with id = %s is already registered", args[0]))
	}

	compositeKey, err := stub.CreateCompositeKey(string(SensorKeyType), []string{args[0]})
	if err != nil {
		return errors.Wrap(err, "failed to register sensor")
	}

	fmt.Printf("Your sensor was successfully registered %s", compositeKey)

	return nil
}

func recordInvoke(stub shim.ChaincodeStubInterface, args []string) error {
	// 0 - ID 1 - Value
	if len(args) != 2 {
		return errors.New("invalid amount of args")
	}

	stateValue, err := stub.GetState(args[0])
	if err != nil {
		return errors.Wrap(err, "failed to get state")
	}
	//sensor already registered
	if stateValue == nil {
		return errors.New("no such sensor")
	}


	value, err := cast.ToUint64E(args[1])
	if err != nil {
		return errors.Wrap(err, "failed to parse value")
	}

	resultValue := cast.ToUint64(stateValue) + value

	invoice := &Invoice{
		Value: resultValue,
	}

	bytes, err := json.Marshal(invoice)
	if err != nil {
		return errors.Wrap(err, "invalid invoice body")
	}

	if err := stub.PutState(args[0], bytes); err != nil {
		return errors.Wrap(err, "failed to put state")
	}

	return nil
}
