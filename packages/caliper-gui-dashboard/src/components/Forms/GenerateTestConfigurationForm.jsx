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
/*!

=========================================================
* Hyperledger Caliper GUI
=========================================================

* Author: Jason You
* GitHub: 
* Licensed under the Apache 2.0 - https://www.apache.org/licenses/LICENSE-2.0

Copyright (c) 2019 Jason You

*/


import React from "react";
import {
  Alert,
  Button, 
  Card,
  CardBody,
  CardHeader, 
  CardTitle,
  CustomInput,
  Form, 
  FormGroup,
  Input,
  Label, 
  Modal,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Tooltip
} from "reactstrap";
import Textarea from "react-textarea-autosize";
import {CopyToClipboard} from 'react-copy-to-clipboard';
// Utility functions for GUI
const GuiUtils = require("../../utilities/GuiUtils");
// import { thisTypeAnnotation } from "@babel/types";
const yaml = require('js-yaml');

export default class GenerateTestConfigurationForm extends React.Component {

  state = {
    // Form functionality states
    showAlert: false,
    copied: false,
    modal: false,
    // Tooltip toggle states
    tooltipBasicTestInfo: false,
    // Test configuration generating states
    testConfig: "",
    test_name: "",
    test_description: "",
    test_client_type: "local",
    test_client_number: 1,
    test_rounds: [JSON.parse(JSON.stringify(GuiUtils.testRoundsTemplete))],
    monitor_type_docker: true,
    monitor_type_process: false,
    monitor_type_docker_names: [],
    monitor_type_process_command: "",
    monitor_type_process_arguments: "",
    monitor_type_process_multiOutput: "",
    monitor_interval: 1,
    // Validity check
    lessThanOneTest: false
  }

  // toggle the modal when inputs are varified
  handleGenerate = () => {
    let testConfig = this.configFormSummary();
    this.setState(prevState => ({
      testConfig: testConfig,
      modal: !prevState.modal
    }));
  }

  // Summarized the form data provided by user, and generate a copiable test configuration yaml file content
  configFormSummary = () => {
    // TODO: Error handling

    // Collecting states and put them into the right spot of test config file
    let testConfig = {
      test: {
        name: this.state.test_name,
        description: this.state.test_description,
        client: {
          type: this.state.test_client_type,
          number: this.state.test_client_number
        },
        rounds: [],     // array of test round objects to be appended
        monitor: {
          type: [],     // array of monitor type to be appened
          interval: this.state.monitor_interval
        }
      }
    };
    
    // append nested test rounds
    this.state.test_rounds.forEach((elem, idx) => {
      let testRound = {
        label: elem.test_rounds_label,
        txNumber: [],
        rateControl: [],
        arguments: [],
        callback: elem.test_rounds_callback
      };
      // append transactions
      elem.test_rounds_transactions.forEach((elem) => {
        // append txNumber
        testRound.txNumber.push(elem.test_rounds_transactions_txNumber);
        // append rateControl objects
        testRound.rateControl.push({
          type: elem.test_rounds_transactions_rateControl_type,
          opts: {
            tps: elem.test_rounds_transactions_rateControl_opts_tps
          }
        });
      });
      // append arguments
      elem.test_rounds_arguments.forEach((elem) => {
        testRound.arguments.push({ [elem.key]: elem.value });
      });
      // adding this test round to the main test config object
      testConfig.test.rounds.push(testRound);
    });
    // append array of monitor type
    if (this.state.monitor_type_docker) {
      testConfig.test.monitor.type.push("docker");
      // append array of docker names for docker monitor config
      testConfig.test.monitor["docker"] = {
        name: []    // array of docker names to be appended
      };
      this.state.monitor_type_docker_names.map((val, idx) => {
        return testConfig.test.monitor.docker.name.push(val);
      });
    }
    if (this.state.monitor_type_process) {
      testConfig.test.monitor.type.push("process");
      // adding the process monitor config
      testConfig.test.monitor["process"] = {
        command: this.state.monitor_type_process_command,
        arguments: this.state.monitor_type_process_arguments,
        multiOutput: this.state.monitor_type_process_multiOutput,
      };
    }

    // Convert testConfig JSON into YAML type string
    testConfig = yaml.safeDump(testConfig);

    // Save test config yaml into a string
    return GuiUtils.addYamlDash(testConfig);
  };

  toggleModal = () => {
    this.setState(prevState => ({
      modal: !prevState.modal
    }));
  };

  toggleTooltip = (toggleState) => {
    console.log(toggleState);
    this.setState({
      [toggleState]: !this.state[toggleState]
    });
  };

  toggleMonitorState = (event) => {
    let monitorName = event.target.name;  // matches the name set for monitor switch
    let monitorChecked = this.state[monitorName];
    this.setState({
      [monitorName]: !monitorChecked
    });
  };

  /* Handle most common, array, and nested input state value changes
    TODO: add more logic if needed
    Usage:
      [Single state] onInputChange(event, name, null, null, null);
        e.g.: {
          name: value
        }
      [Array state] onInputChange(event, name, index, null, null);
        e.g.: {
          name: [
            value1, 
            value2, 
            ...
          ]
        }
      [Nested object] onInputChange(event, name, null, parentName, null);
        e.g.: {
          parentName: {
            name: value
          } 
        }
      [Nested array object] onInputChange(event, name, null, parentName, parentIndex);
        e.g.: { 
          parentName: [
            {
              name: value
            }, 
            ...
          ] 
        }
      [Nested array object of array object] onInputChange(event, name, index, parentName, parentIndex);
        e.g.: { 
          parentName: [
            {
              name1: [
                value1, 
                value2, 
                ...
              ]
            }, 
            ...
          ] 
        }
      [State in nested array object of array object] onInputChange(event, name, index, parentName, parentIndex, innerName);
        e.g.: { 
          parentName: [
            {
              name1: [
                {
                  innerName
                },
                ...
              ]
            }, 
            ...
          ] 
        }
  */ 
  onInputChange = (event, name, index, parentName, parentIndex, innerName) => {
    // TODO: handle all invalid arguments
    if (!GuiUtils.hasInput(name)) {
      return;
    }
    let newValue = event.target.value;  //updated input value
    let targetObject = null;  // object to be modified

    if (GuiUtils.hasInput(index)) {
      if (GuiUtils.hasInput(parentName) && GuiUtils.hasInput(parentIndex) && GuiUtils.hasInput(innerName)) {
        // single state in nested array object of array object
        targetObject = this.state[parentName];
        targetObject[parentIndex][name][index][innerName] = newValue;
        this.setState({ [parentName]: targetObject });
      } else if (GuiUtils.hasInput(parentName) && GuiUtils.hasInput(parentIndex)) {
        // nested array object of array object state change
        targetObject = this.state[parentName];
        targetObject[parentIndex][name][index] = newValue;
        this.setState({ [parentName]: targetObject });
      } else {
        // array state change
        targetObject = this.state[name];
        targetObject[index] = newValue;
        this.setState({ [name]: targetObject });  // update object
      }
    } else {
      if (GuiUtils.hasInput(parentName) && GuiUtils.hasInput(parentIndex)) {
        // nested array object state change
        targetObject = this.state[parentName];
        targetObject[parentIndex][name] = newValue;
        this.setState({ [parentName]: targetObject });
      }
      if (GuiUtils.hasInput(parentName) && !GuiUtils.hasInput(parentIndex)) {
        // nested object state change
        targetObject = this.state[parentName];
        targetObject[parentName][name] = newValue;
        this.setState({ [parentName]: targetObject });  // update object
      } else {
        // single state change
        this.setState({ [name]: newValue });
      }
    }
  };

  /*
    Append a new input field in the end of this form group
    TODO: add more logic if needed
    Usage:
      [Single state] addInput(name, appendObj, null, null);
        e.g.: {
          name: [value, ...]
        }
      [Nested array object of array object] addInput(name, appendObj, parentName, parentIndex);
        e.g.: { 
          parentName: [
            {
              name1: [value1, ...]
            }, 
            ...
          ] 
        }
  */
  addInput = (name, appendObj, parentName, parentIndex) => {
    if (GuiUtils.hasInput(parentName) && GuiUtils.hasInput(parentIndex)) {
      // nested array object of array object appending
      let targetObject = this.state[parentName];
      targetObject[parentIndex][name] = [...targetObject[parentIndex][name], appendObj ? appendObj : ""];
      this.setState({ [parentName]: targetObject });
    } else {
      // single state appending
      this.setState({ [name]: [...this.state[name], appendObj ? appendObj : ""] });
    }
  };

  /* Removing the last input field in this form group
    TODO: add more logic if needed
    Usage:
      [Single state] removeInput(name, null, null);
        e.g.: {
          name: [value, ...]
        }
      [Nested array object of array object] removeInput(name, parentName, parentIndex);
        e.g.: { 
          parentName: [
            {
              name1: [value1, ...]
            }, 
            ...
          ] 
        }
  */
  removeInput = (name, parentName, parentIndex) => {
    // handle less than one test round issue
    if (name === "test_rounds" && this.state[name].length <= 1) {
      this.setState({ lessThanOneTest: true });
      setInterval(() => this.setState({ lessThanOneTest: false }), 3000);
      return;
    }
    if (GuiUtils.hasInput(parentName) && GuiUtils.hasInput(parentIndex)) {
      // nested array object of array object removing
      let targetObject = this.state[parentName];
      targetObject[parentIndex][name].pop();
      this.setState({ [parentName]: targetObject });
    } else {
      // single state removing
      this.state[name].pop();
      this.setState({ [name]: this.state[name] });
    }
  };

  // Display the "Copied" keyword sign to user
  copyFile = () => {
    this.setState({copied: true});
    setInterval(() => { this.setState({copied: false}) }, 5000);
  };

  // Dismiss alert
  onDismiss = () => {
    this.setState({ showAlert: false });
  }

  render() {
    return (
      <>
        <Card>
          <CardHeader className="text-center">
            <CardTitle tag="h4">Generate New Test Configuration</CardTitle>
            <p className="card-category">Genearte test config file and save as YAML and then use if for test above.</p>
            <hr />
            {/* <Button onClick={() => console.log(this.state)}>DEBUG Show State</Button> */}
          </CardHeader>
          <CardBody>
            <h3 className="text-primary">Test Configuration</h3>
            <Form>
              <h5 id="tooltipBasicTestInfo">Basic Test Info</h5>
              <Tooltip placement="left" isOpen={this.state.tooltipBasicTestInfo} target="tooltipBasicTestInfo" toggle={() => this.toggleTooltip("tooltipBasicTestInfo")}>
                <b>TODO</b>: Tooltip explaination for the configuration.
              </Tooltip>
              <FormGroup>
                <Label for="test_name">Test Name</Label>
                <Input
                  type="text"
                  name="test_name"
                  id="test_name"
                  placeholder="Test Name"
                  value={this.state.test_name}
                  onChange={(e) => this.onInputChange(e, "test_name")}
                />
              </FormGroup>
              <FormGroup>
                <Label for="test_description">Test Description</Label>
                <Input
                  type="text"
                  name="test_description"
                  id="test_description"
                  placeholder="Test Description"
                  value={this.state.test_description}
                  onChange={(e) => this.onInputChange(e, "test_description")}
                />
              </FormGroup>
              <hr style={{marginTop:"50px"}}/>
              <h5>Client Setup</h5>
              <FormGroup>
                <Label for="client_type">Client Type</Label>
                <div>
                  <CustomInput
                    type="radio"
                    name="client_type"
                    id="client_type_local"
                    label="Local"
                    value="local"
                    onClick={(e) =>
                  this.onInputChange(e, "test_client_type")}
                  checked={this.state.test_client_type === "local"}
                  />
                  <CustomInput
                    type="radio"
                    name="client_type"
                    id="client_type_prometheus"
                    label="Prometheus"
                    value="prometheus"
                    onClick={(e) =>
                  this.onInputChange(e, "test_client_type")}
                  checked={this.state.test_client_type === "prometheus"}
                  />
                </div>
              </FormGroup>
              <FormGroup>
                <Label for="client_number">Client Number</Label>
                <Input
                  type="select"
                  name="client_number" 
                  id="client_number"
                  onChange={(e) => this.onInputChange(e, "test_client_number")}
                value={this.state.test_client_number}
                >
                <option value="1">1</option>
                <option value="2">2</option>
                <option value="3">3</option>
                <option value="4">4</option>
                <option value="5">5</option>
                </Input>
              </FormGroup>
              <hr style={{marginTop:"50px"}}/>
              <h5>Test Rounds</h5>
              {
              this.state.test_rounds.map((val, idx) => {
              let testId = `Test Round #${idx + 1}`;
              return (
              <div
                style={GuiUtils.borderStyle}
                >
                <h5>{testId}</h5>
                <FormGroup>
                  <Label for="test_rounds_label">Test Round Label</Label>
                  <Input
                    type="input"
                    name="test_rounds_label" 
                    id="test_rounds_label" 
                    onChange={(e) => this.onInputChange(e, "test_rounds_label", null, "test_rounds", idx)} 
                  value={val.test_rounds_label} 
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="test_rounds_description">Test Round Description</Label>
                  <Input 
                    type="input" 
                    name="test_rounds_description" 
                    id="test_rounds_description" 
                    onChange={(e) => this.onInputChange(
                  e,
                  "test_rounds_description",
                  null,
                  "test_rounds",
                  idx
                  )} 
                  value={val.test_rounds_description} 
                  />
                </FormGroup>
                <FormGroup>
                  <Label for="test_rounds_callback">Test Round Callback Function Path (relative to workspace)</Label>
                  <Input 
                    type="input" 
                    name="test_rounds_callback" 
                    id="test_rounds_callback" 
                    onChange={(e) => this.onInputChange(
                  e,
                  "test_rounds_callback",
                  null, "test_rounds",
                  idx
                  )} 
                  value={val.test_rounds_callback} 
                  />
                </FormGroup>
                {/* Setting Arguments */}
                {
                val.test_rounds_arguments.map((childVal, childIdx) => {
                let argumentId = `Argument #${childIdx + 1}`;
                return (
                <div style={GuiUtils.borderStyle}>
                  <h6>{argumentId}</h6>
            <Form inline>
            <FormGroup>
            <Label
            for="key"
            style={{margin:"0 5px"}}
            >
            {`Key #${childIdx + 1}`}
            </Label>
            <Input
              type="input"
              name="key"
              id="key"
              onChange={(e) => this.onInputChange(
            e,
            "test_rounds_arguments",
            childIdx,
            "test_rounds",
            idx,
            "key"
            )}
            value={childVal.key}
            />
            </FormGroup>
            <FormGroup>
            <Label
            for="value"
            style={{margin:"0 5px"}}
            >
            {`Value #${childIdx + 1}`}
            </Label>
            <Input
              type="input"
              name="value"
              id="value"
              onChange={(e) => this.onInputChange(
            e,
            "test_rounds_arguments",
            childIdx,
            "test_rounds",
            idx,
            "value"
            )}
            value={childVal.value}
            />
            </FormGroup>
            </Form>
            </div>
            )
            })
            }
            <Button
              color="secondary"
              onClick={() => this.addInput(
            "test_rounds_arguments",
            {
            key: "",
            value: ""
            },
            "test_rounds",
            idx)
            }
            >
            Add Arguments
            </Button>
            <Button
              color="danger"
              onClick={() => this.removeInput(
            "test_rounds_arguments",
            "test_rounds",
            idx)
            }
            >
            Remove
            </Button>
            <h6 className="text-secondary">
            (Total: {
            this.state.test_rounds[idx].test_rounds_arguments.length
            } Arguments)
            </h6>
            <hr style={{marginTop:"50px"}}/>
            {/* Setting Transactions */}
            {
            val.test_rounds_transactions.map((childVal, childIdx) => {
            let transactionId = `Transaction #${childIdx + 1}`;
            return (
            <div style={GuiUtils.borderStyle}>
            <h6>{transactionId}</h6>
            <Form inline>
            <FormGroup>
            <Label
            for="test_rounds_transactions_rateControl_type"
            style={{margin:"0 5px"}}
            >
            Rate Control Type
            </Label>
            <Input
              type="select"
              name="test_rounds_transactions_rateControl_type"
              id="test_rounds_transactions_rateControl_type"
              onChange={(e) => this.onInputChange(
            e,
            "test_rounds_transactions",
            childIdx,
            "test_rounds",
            idx,
            "test_rounds_transactions_rateControl_type"
            )}
            value={childVal.test_rounds_transactions_rateControl_type}
            >
            <option value="fixed-rate">Fixed Rate</option>
            <option value="fixed-feedback-rate">Fixed Feedback Rate</option>
            <option value="record-rate">Record Rate</option>
            <option value="replay-rate">Replay Rate</option>
            <option value="linear-rate">Linear Rate</option>
            </Input>
            </FormGroup>
            <FormGroup>
            <Label
            for="test_rounds_transactions_txNumber"
            style={{margin:"0 5px"}}
            >
            Tx. Number
            </Label>
            <Input
              type="number"
              name="test_rounds_transactions_txNumber"
              id="test_rounds_transactions_txNumber"
              onChange={(e) => this.onInputChange(
            e,
            "test_rounds_transactions",
            childIdx,
            "test_rounds",
            idx,
            "test_rounds_transactions_txNumber"
            )}
            value={childVal.test_rounds_transactions_txNumber}
            />
            </FormGroup>
            <FormGroup>
            <Label
            for="test_rounds_transactions_rateControl_opts_tps"
            style={{margin:"0 5px"}}
            >
            Rate Control TPS
            </Label>
            <Input
              type="number"
              name="test_rounds_transactions_rateControl_opts_tps"
              id="test_rounds_transactions_rateControl_opts_tps"
              onChange={(e) => this.onInputChange(
            e,
            "test_rounds_transactions",
            childIdx,
            "test_rounds",
            idx,
            "test_rounds_transactions_rateControl_opts_tps"
            )}
            value={childVal.test_rounds_transactions_rateControl_opts_tps}
            />
            </FormGroup>
            </Form>
            </div>
            );
            })
            }
            <Button
              color="secondary"
              onClick={() => this.addInput(
            "test_rounds_transactions",
            {
            test_rounds_transactions_txNumber: 100,
            test_rounds_transactions_rateControl_type: "fixed_rate",
            test_rounds_transactions_rateControl_opts_tps: 300
            },
            "test_rounds",
            idx)
            }
            >
            Add Transaction
            </Button>
            <Button
              color="danger"
              onClick={() => this.removeInput(
            "test_rounds_transactions",
            "test_rounds",
            idx)
            }
            >
            Remove
            </Button>
            <h6 className="text-secondary">
            (Total: {
            this.state.test_rounds[idx].test_rounds_transactions.length
            } Transactions)
            </h6>
            </div>
            );
            })
            }
            <Button
              onClick={() => this.addInput("test_rounds", JSON.parse(JSON.stringify(GuiUtils.testRoundsTemplete)))} 
            color="warning"
            >
            Add Another Test
            </Button>
            <Button
              onClick={() => this.removeInput("test_rounds")} 
            color="danger"
            >
            Remove
            </Button>
            <Alert
              color="danger"
              isOpen={this.state.lessThanOneTest}
              >At least one test round needed</Alert>
            <h6 className="text-secondary">
              (Total: {this.state.test_rounds.length} Tests)
            </h6>
            <hr style={{marginTop:"50px"}}/>
            <h5>Monitor</h5>
            <FormGroup>
              <Label for="monitor_interval">Monitor Interval</Label>
              <Input
                type="select"
                name="monitor_interval"
                id="monitor_interval"
                onChange={(e) => this.onInputChange(e, "monitor_interval")}
              value={this.state.monitor_interval}
              >
              <option value="1">1</option>
              <option value="2">2</option>
              </Input>
            </FormGroup>
            <FormGroup>
              <Label for="monitor_type">Monitor Type</Label>
              <div>
                <CustomInput type="switch" id="monitor_type_docker" name="monitor_type_docker" label="Add Docker Monitor" checked={this.state.monitor_type_docker} onClick={this.toggleMonitorState} />
                { this.state.monitor_type_docker
                ?
                this.state.monitor_type_docker_names.map((val, idx) => {
                let dockerNameId = `docker-${idx}`;
                return (
                <div key={idx}>
                  <Label for={dockerNameId}>
                  {`Docker Name #${idx + 1}`}
                  </Label>
                  <Input
                    type="text"
                    name="monitor_type_docker_names"
                    id={dockerNameId}
                    onChange={(e) => this.onInputChange(e, "monitor_type_docker_names", idx)}
                  value={val}
                  placeholder="e.g. all"
                  />
                </div>
                );
                })
                :
                ""
                }
                {this.state.monitor_type_docker
                ?
                <>
                <Button color="secondary" name="monitor_type_docker_names" onClick={() => this.addInput("monitor_type_docker_names")}>Add Docker</Button>
                <Button color="danger" name="monitor_type_docker_names" onClick={() => this.removeInput("monitor_type_docker_names")}>Remove</Button>
                <h6 className="text-secondary">
                  (Total: {this.state.monitor_type_docker_names.length} Dockers)
                </h6>
                </>
                :
                ""
                }
                <CustomInput type="switch" id="monitor_type_process" name="monitor_type_process" label="Add Process Monitor" checked={this.state.monitor_type_process} onClick={this.toggleMonitorState} />
                { this.state.monitor_type_process
                ?
                <>
                <Label for="monitor_type_process_command">
                Process Command
                </Label>
                <Input
                  type="text"
                  name="monitor_type_process_command"
                  id="monitor_type_process_command"
                  onChange={(e) => this.onInputChange(e, "monitor_type_process_command")}
                value={this.state.monitor_type_process_command}
                placeholder="e.g. node"
                />
                <Label for="monitor_type_process_arguments">
                Process Arguments
                </Label>
                <Input
                  type="text"
                  name="monitor_type_process_arguments"
                  id="monitor_type_process_arguments"
                  onChange={(e) => this.onInputChange(e, "monitor_type_process_arguments")}
                value={this.state.monitor_type_process_arguments}
                placeholder="e.g. local-client.js"
                />
                <Label for="monitor_type_process_multiOutput">
                Process Multi-Output
                </Label>
                <Input
                  type="text"
                  name="monitor_type_process_multiOutput"
                  id="monitor_type_process_multiOutput"
                  onChange={(e) => this.onInputChange(e, "monitor_type_process_multiOutput")}
                value={this.state.monitor_type_process_multiOutput}
                placeholder="e.g. avg"
                />
                </>
                :
                ""
                }
              </div>
            </FormGroup>
            </Form>
            <div className="text-center">
              <Button color="primary" style={{width:"300px"}} onClick={this.handleGenerate}>
              Generate
              </Button>
              <Alert color="danger" isOpen={this.state.showAlert} toggle={this.onDismiss}>
                You Need To Complete All Required Fields Before Generate
              </Alert>
            </div>
            <Modal isOpen={this.state.modal} toggle={this.toggleModal} size="lg" >
              <ModalHeader toggle={this.toggleModal}>Test Config Generated</ModalHeader>
              <ModalBody  style={{height:"500px"}}>
                <FormGroup>
                  <Label for="configFile">Test Benchmark Yaml File</Label>
                  <p className="card-category">Please Copy And Paste The Following Text Into A Yaml File And Upload As Test Configuraiton File</p>
                  <Textarea name="configFile" id="configFile" onChange={(e) =>
                  this.onInputChange(e, "testConfig")} value={this.state.testConfig} maxRows={18} style={GuiUtils.textareaStyle} />
                </FormGroup>
              </ModalBody>
              <ModalFooter>
                {this.state.copied ? <span className="text-secondary"><b>Copied!</b></span> : ''}
                <CopyToClipboard text={this.state.testConfig} onCopy={this.copyFile}>
                  <Button color="primary" onClick={this.copyFile}>Copy</Button>
                </CopyToClipboard>
              </ModalFooter>
            </Modal>
          </CardBody>
        </Card>
      </>
    );
  }
}
