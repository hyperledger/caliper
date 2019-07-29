/*
* Licensed under the Apache License, Version 2.0 (the "License");
* you may not use this file except in compliance with the License.
* You may obtain a copy of the License at
*
* http://www.apache.org/licenses/LICENSE-2.0
*
* Unless required by applicable law or agreed to in writing, software
* distributed under the License is distributed on an "AS IS" BASIS,
* WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
* See the License for the specific language governing permissions and
* limitations under the License.
*/

package main

import (
	"fmt"
	"strconv"
	"crypto/sha512"
	"encoding/hex"
	"encoding/json"
	"strings"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

const ERROR_UNKNOWN_FUNC = "Unknown function"
const ERROR_WRONG_ARGS = "Wrong arguments of function"
const ERROR_SYSTEM = "System exception"
const ERR_NOT_FOUND = "Could not find specified account"
const ERROR_PUT_STATE = "Failed to put state"

var namespace = hexdigest("smallbank")[:6]

type SmallbankChaincode struct {

}

func (t *SmallbankChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	// nothing to do
	return shim.Success(nil)
}

func (t *SmallbankChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()
	switch function {
	case "create_account":
		return t.CreateAccount(stub, args)
	case "transact_savings":
		return t.TransactSavings(stub, args)
	case "deposit_checking":
		return t.DepositChecking(stub, args)
	case "send_payment":
		return t.SendPayment(stub, args)
	case "write_check":
		return t.WriteCheck(stub, args)
	case "amalgamate":
		return t.Amalgamate(stub, args)
	case "query":
		return t.Query(stub, args)
	default:
		return errormsg(ERROR_UNKNOWN_FUNC + ": " +function)
	}
}

type Account struct {
	CustomId   string
	CustomName string
	SavingsBalance int
	CheckingBalance int
}
func (t *SmallbankChaincode) CreateAccount(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 4 {	//should be [customer_id, customer_name, initial_checking_balance, initial_savings_balance]
		return errormsg(ERROR_WRONG_ARGS + " create_account")
	}

	key := accountKey(args[0])
	data,err := stub.GetState(key)
	if data != nil {
		return errormsg("Can not create duplicated account")
	}

	checking, errcheck := strconv.Atoi(args[2])
	if errcheck != nil {
		return errormsg(ERROR_WRONG_ARGS + " create_account, checking balance should be integer")
	}
	saving, errsaving := strconv.Atoi(args[3])
	if errsaving != nil {
		return errormsg(ERROR_WRONG_ARGS + " create_account, saving balance should be integer")
	}

	account := &Account {
		CustomId: args[0],
		CustomName: args[1],
		SavingsBalance: saving,
		CheckingBalance: checking }
	err = saveAccount(stub, account)
	if err != nil {
		return systemerror(err.Error())
	}

	return shim.Success(nil)
}

func (t *SmallbankChaincode) DepositChecking(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 2 {	// should be [amount,customer_id]
		return errormsg(ERROR_WRONG_ARGS + " deposit_checking")
	}
	account, err := loadAccount(stub, args[1])
	if err != nil {
		return errormsg(ERR_NOT_FOUND);
	}
	amount, _ := strconv.Atoi(args[0])
	account.CheckingBalance += amount
	err = saveAccount(stub, account)
	if err != nil {
		return systemerror(err.Error())
	}

	return shim.Success(nil)
}

func (t *SmallbankChaincode) WriteCheck(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 2 {	// should be [amount,customer_id]
		return errormsg(ERROR_WRONG_ARGS + " write_check")
	}
	account, err := loadAccount(stub, args[1])
	if err != nil {
		return errormsg(ERR_NOT_FOUND);
	}
	amount, _ := strconv.Atoi(args[0])
	account.CheckingBalance -= amount
	err = saveAccount(stub, account)
	if err != nil {
		return systemerror(err.Error())
	}

	return shim.Success(nil)
}

func (t *SmallbankChaincode) TransactSavings(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 2 {	// should be [amount,customer_id]
		return errormsg(ERROR_WRONG_ARGS + " transaction_savings")
	}
	account, err := loadAccount(stub, args[1])
	if err != nil {
		return errormsg(ERR_NOT_FOUND);
	}
	amount, _ := strconv.Atoi(args[0])
	// since the contract is only used for perfomance testing, we ignore this check 
	//if amount < 0 && account.SavingsBalance < (-amount) {
	//	return errormsg("Insufficient funds in source savings account")
	//}
	account.SavingsBalance += amount
	err = saveAccount(stub, account)
	if err != nil {
		return systemerror(err.Error())
	}

	return shim.Success(nil)
}

func (t *SmallbankChaincode) SendPayment(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 3 {	// should be [amount,dest_customer_id,source_customer_id]
		return errormsg(ERROR_WRONG_ARGS + " send_payment")
	}
	destAccount, err1 := loadAccount(stub, args[1])
	sourceAccount, err2 := loadAccount(stub, args[2])
	if err1 != nil || err2 != nil {
		return errormsg(ERR_NOT_FOUND)
	}

	amount, _ := strconv.Atoi(args[0])
	// since the contract is only used for perfomance testing, we ignore this check
	//if sourceAccount.CheckingBalance < amount {
	//	return errormsg("Insufficient funds in source checking account")
	//}
	sourceAccount.CheckingBalance -= amount
	destAccount.CheckingBalance += amount
	err1 = saveAccount(stub, sourceAccount)
	err2 = saveAccount(stub, destAccount)
	if err1 != nil || err2 != nil {
		return errormsg(ERROR_PUT_STATE)
	}
	
	return shim.Success(nil)
}

func (t *SmallbankChaincode) Amalgamate(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	if len(args) != 2 {	// should be [dest_customer_id,source_customer_id]
		return errormsg(ERROR_WRONG_ARGS + " amalgamate")
	}
	destAccount, err1 := loadAccount(stub, args[0])
	sourceAccount, err2 := loadAccount(stub, args[1])
	if err1 != nil || err2 != nil {
		return errormsg(ERR_NOT_FOUND)
	}

	destAccount.CheckingBalance += sourceAccount.SavingsBalance
	sourceAccount.SavingsBalance = 0
	err1 = saveAccount(stub, sourceAccount)
	err2 = saveAccount(stub, destAccount)
	if err1 != nil || err2 != nil {
		return errormsg(ERROR_PUT_STATE)
	}
	
	return shim.Success(nil)
}

func (t *SmallbankChaincode) Query(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	key := accountKey(args[0])
	accountBytes,err := stub.GetState(key)
	if err != nil {
		return systemerror(err.Error())
	}

	return shim.Success(accountBytes)
}

func  main()  {
	err := shim.Start(new(SmallbankChaincode))
	if err != nil {
		fmt.Printf("Error starting chaincode: %v \n", err)
	}

}

func errormsg(msg string) pb.Response {
	return shim.Error("{\"error\":"+msg+"}")
}

func systemerror(err string) pb.Response {
	return errormsg(ERROR_SYSTEM + ":" + err)
}

func hexdigest(str string) string {
	hash := sha512.New()
	hash.Write([]byte(str))
	hashBytes := hash.Sum(nil)
	return strings.ToLower(hex.EncodeToString(hashBytes))
}

func accountKey(id string) string {
	return namespace + hexdigest(id)[:64]
}

func loadAccount(stub shim.ChaincodeStubInterface, id string) (*Account, error) {
	key := accountKey(id)
	accountBytes,err := stub.GetState(key)
	if err != nil {
		return nil, err
	}
	res := Account{}
	err = json.Unmarshal(accountBytes, &res)
	if err != nil {
		return nil, err
	}
	return &res, nil
}

func saveAccount(stub shim.ChaincodeStubInterface, account *Account) error {
	accountBytes, err := json.Marshal(account)
	if err != nil {
		return err
	}
	key := accountKey(account.CustomId)
	return stub.PutState(key, accountBytes)
}