package main

import (
	"fmt"

	"encoding/json"

	"bytes"
	"math"

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
		"registerSensor":  registerSensor,
		"recordInvoke":    recordInvoke,
		"queryAllSensors": queryAllSensors,
		"querySensor":     querySensor,
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

	result, err := action(stub, args)
	if err != nil {
		return shim.Error(fmt.Sprintf("action failed %s", err.Error()))
	}

	return shim.Success(result)
}

func registerSensor(stub shim.ChaincodeStubInterface, args []string) ([]byte, error) {
	// 0 - ID
	if len(args) != 1 {
		return nil, errors.New("invalid amount of args")
	}

	state, err := stub.GetState(args[0])
	if err != nil {
		return nil, errors.Wrap(err, "failed to get state")
	}
	//sensor already registered
	if state != nil {
		return nil, errors.New(fmt.Sprintf("sensor with id = %s is already registered", args[0]))
	}

	compositeKey, err := stub.CreateCompositeKey(string(SensorKeyType), []string{args[0]})
	if err != nil {
		return nil, errors.Wrap(err, "failed to register sensor")
	}

	fmt.Printf("Your sensor was successfully registered %s", compositeKey)

	return nil, nil
}

func recordInvoke(stub shim.ChaincodeStubInterface, args []string) ([]byte, error) {
	// 0 - ID 1 - Value
	if len(args) != 2 {
		return nil, errors.New("invalid amount of args")
	}

	value, err := cast.ToUint64E(args[1])
	if err != nil {
		return nil, errors.Wrap(err, "failed to parse value")
	}

	invoice := &Invoice{
		Value: value,
	}

	bytes, err := json.Marshal(invoice)
	if err != nil {
		return nil, errors.Wrap(err, "invalid invoice body")
	}

	if err := stub.PutState(args[0], bytes); err != nil {
		return nil, errors.Wrap(err, "failed to put state")
	}

	return nil, nil
}

func queryAllSensors(stub shim.ChaincodeStubInterface, args []string) ([]byte, error) {

	startKey := "0"
	endKey := fmt.Sprintf("%d", uint64(math.MaxUint64))

	resultsIterator, err := stub.GetStateByRange(startKey, endKey)
	if err != nil {
		return nil, errors.Wrap(err, "failed to get states")
	}
	defer resultsIterator.Close()

	// buffer is a JSON array containing QueryResults
	var buffer bytes.Buffer
	buffer.WriteString("[")

	bArrayMemberAlreadyWritten := false
	for resultsIterator.HasNext() {
		queryResponse, err := resultsIterator.Next()
		if err != nil {
			return nil, errors.Wrap(err, "failed to iterate by states")
		}
		// Add a comma before array members, suppress it for the first array member
		if bArrayMemberAlreadyWritten == true {
			buffer.WriteString(",")
		}

		buffer.WriteString("{\"Key\":")
		buffer.WriteString("\"")
		buffer.WriteString(queryResponse.Key)
		buffer.WriteString("\"")

		buffer.WriteString(", \"Record\":")
		// Record is a JSON object, so we write as-is
		buffer.WriteString(string(queryResponse.Value))
		buffer.WriteString("}")
		bArrayMemberAlreadyWritten = true
	}
	buffer.WriteString("]")

	fmt.Printf("- queryAllSensors:\n%s\n", buffer.String())

	return buffer.Bytes(), nil
}

func querySensor(stub shim.ChaincodeStubInterface, args []string) ([]byte, error) {
	// 0 - ID
	if len(args) != 1 {
		return nil, errors.New("invalid amount of args")
	}

	stateValue, err := stub.GetState(args[0])
	if err != nil {
		return nil, err
	}

	sensor := Sensor{
		ID:    cast.ToUint64(args[0]),
		Value: cast.ToUint64(stateValue),
	}
	return json.Marshal(&sensor)
}
