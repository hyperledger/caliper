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
	"encoding/json"
	"encoding/base64"
	"crypto/sha256"
	"github.com/hyperledger/fabric/core/chaincode/shim"
	pb "github.com/hyperledger/fabric/protos/peer"
)

type DrmChaincode struct {

}

type PublishRequest struct {
	Author     string
	CreateTime string
	Info       string
	Item       string
}

type DigitalItem struct {
	Author     string
	CreateTime string
	Info       string
	Identity   string
}

type QueryResponse struct {
	Result     string		// "Published" or "Unknown"
	Author     string
	CreateTime string
	Info       string
}

func (t *DrmChaincode) Init(stub shim.ChaincodeStubInterface) pb.Response {
	// nothing to do
	return shim.Success(nil)
}

// query the drm info by item's identity
func (t *DrmChaincode) Query(stub shim.ChaincodeStubInterface, args []string)  pb.Response {
	if len(args) != 1 {
		return shim.Error("Wrong format, should be 'query id'")
	}

	stat, err := stub.GetState(args[0])
	if err != nil {
		notFound := QueryResponse{"Unknown","","",""}
		r,_ := json.Marshal(notFound)
		return shim.Success([]byte(r))		// query a unpublished item , return success
	}

	var item DigitalItem
	err = json.Unmarshal(stat, &item)
	if err != nil {
		fmt.Printf("unknown state value %v \n", string(stat))
		return shim.Error(err.Error())
	}

	resp := QueryResponse{"Published", item.Author, item.CreateTime, item.Info}
	r,_  := json.Marshal(resp)
	return shim.Success(r)
}

// publish a digital item, store the hash and drm information into ledger
func (t * DrmChaincode) Publish(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var wrongFmt = "Wrong format, should be 'publish {author:string, createtime:string, info:string, item:string'"
	if len(args) != 1 {
		fmt.Println(wrongFmt)
		return shim.Error(wrongFmt)
	}

	var req PublishRequest
	err := json.Unmarshal([]byte(args[0]), &req)
	if err != nil {
		return shim.Error(wrongFmt)
	}

	// calculate the hash value as identity
	hash := sha256.Sum256([]byte(req.Item))
	id   := base64.URLEncoding.EncodeToString(hash[:])
	item := DigitalItem{req.Author, req.CreateTime, req.Info, id}
	i,_  := json.Marshal(item)

	// check if item already exists
	state, err := stub.GetState(id)
	if state != nil && err == nil {
		return shim.Error("Item already published");
	}

	err = stub.PutState(id, []byte(i))
	if err != nil {
		fmt.Printf("PutState error, %v\n", err.Error())
		return shim.Error(err.Error())
	}

	return shim.Success([]byte(id));
}

// check if a digital item is already published
func (t * DrmChaincode) Check(stub shim.ChaincodeStubInterface, args []string) pb.Response {
	var wrongFmt = "Wrong format, should be 'check item'"
	if len(args) != 1 {
		fmt.Println(wrongFmt)
		return shim.Error(wrongFmt)
	}

	hash  := sha256.Sum256([]byte(args[0]))
	id    := base64.URLEncoding.EncodeToString(hash[:])
	bytes,err := stub.GetState(id)
	if bytes != nil && err == nil {
		return shim.Success([]byte("Published"))
	} else{
		return shim.Success([]byte("Not Published"))
	}


}

func (t * DrmChaincode) Invoke(stub shim.ChaincodeStubInterface) pb.Response {
	function, args := stub.GetFunctionAndParameters()
	if function == "query" {
		return t.Query(stub, args)
	}
	if function == "publish" {
		return t.Publish(stub, args)
	}
	if function == "check" {
		return t.Check(stub, args)
	}

	return shim.Error("Unknown action, should be 'query', 'publish' or 'check'")
}

func  main()  {
	err := shim.Start(new(DrmChaincode))
	if err != nil {
		fmt.Printf("Error starting chaincode: %v \n", err)
	}

}