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

'use strict';

const CaliperUtils = require('@hyperledger/caliper-core').CaliperUtils;
const Logger = CaliperUtils.getLogger('config-validator');

const j = require('@hapi/joi');

/**
 * Utility class for the declarative validation of Fabric network configuration objects.
 */
class ConfigValidator {
    /**
     * Validates the entire network configuration object.
     * @param {object} config The network configuration object.
     * @param {object} flowOptions Contains the flow control options for Caliper.
     * @param {boolean} discovery Indicates whether discovery is configured or not.
     * @param {boolean} gateway Indicates whether gateway mode is configured or not.
     */
    static validateNetwork(config, flowOptions, discovery, gateway) {
        Logger.debug('Entering validateNetwork');

        // Current limitation is that default Caliper transactions do not work with discovery, since full network knowledge is required; it is required to use a gateway
        if (discovery && !gateway) {
            throw new Error('Use of discovery is only supported through a gateway transaction');
        }

        // Not possible to use discovery to perform admin operations (init/install) since full knowledge is required
        if (discovery && (flowOptions.performInit || flowOptions.performInstall)) {
            throw new Error('Use of service discovery is only valid with a `caliper-flow-only-test` flag');
        }

        // registrar requirement removed if only-test
        let requireRegistrar = 'required';
        if (flowOptions.performTest && (!flowOptions.performInit && !flowOptions.performInstall)) {
            requireRegistrar = 'optional';
        }

        let tls; // undefined => we don't know yet
        // the TLS setting might not be known after the individual section if they are missing
        // the first existing node will determine its value, and after that every node is validated against that value
        // see the lines: "tls = ... || nodeUrl.startsWith(...);"

        // can't validate mutual TLS now
        ConfigValidator._validateTopLevel(config, flowOptions, discovery, tls);

        // validate CA section
        let cas = [];
        if (config.certificateAuthorities) {
            cas = Object.keys(config.certificateAuthorities);
            for (const ca of cas) {
                try {
                    ConfigValidator.validateCertificateAuthority(config.certificateAuthorities[ca], tls, requireRegistrar);
                    tls = (tls || false) || config.certificateAuthorities[ca].url.startsWith('https://');
                } catch (err) {
                    throw new Error(`Invalid "${ca}" CA configuration: ${err.message}`);
                }
            }
        }

        // validate orderer section
        let orderers = [];
        if (config.orderers) {
            orderers = Object.keys(config.orderers);
            for (const orderer of orderers) {
                try {
                    ConfigValidator.validateOrderer(config.orderers[orderer], tls);
                    tls = (tls || false) || config.orderers[orderer].url.startsWith('grpcs://');
                } catch (err) {
                    throw new Error(`Invalid "${orderer}" orderer configuration: ${err.message}`);
                }
            }
        }

        // validate peer section
        let peers = [];
        if (config.peers) {
            let eventUrl;
            peers = Object.keys(config.peers);
            for (const peer of peers) {
                try {
                    ConfigValidator.validatePeer(config.peers[peer], tls, eventUrl);
                    tls = (tls || false) || config.peers[peer].url.startsWith('grpcs://');
                    eventUrl = !!config.peers[peer].eventUrl; // the first peer will decide it
                } catch (err) {
                    throw new Error(`Invalid "${peer}" peer configuration: ${err.message}`);
                }
            }
        }

        // validate organization section
        let orgs = [];
        const mspIds = [];
        if (config.organizations) {
            orgs = Object.keys(config.organizations);
            for (const org of orgs) {
                try {
                    ConfigValidator.validateOrganization(config.organizations[org], peers, cas);
                    mspIds.push(config.organizations[org].mspid);
                } catch (err) {
                    throw new Error(`Invalid "${org}" organization configuration: ${err.message}`);
                }
            }
        }

        // validate organizationWallets section
        if (config.organizationWallets) {
            try {
                ConfigValidator.validateOrganizationWallets(config.organizationWallets, orgs);
            } catch (err) {
                throw new Error(`Invalid organizationWallets configuration : ${err.message}`);
            }
        }

        // validate client section
        if (config.clients) {
            const clients = Object.keys(config.clients);
            for (const client of clients) {
                try {
                    const hasOrgWallet = config.hasOwnProperty('organizationWallets') && Object.keys(config.organizationWallets).includes(config.clients[client].client.organization);
                    ConfigValidator.validateClient(config.clients[client], orgs, hasOrgWallet);
                } catch (err) {
                    throw new Error(`Invalid "${client}" client configuration: ${err.message}`);
                }
            }
        }

        // validate channels section
        if (config.channels) {
            const channels = Object.keys(config.channels);
            const takenContractIds = [];
            for (const channel of channels) {
                try {
                    ConfigValidator.validateChannel(config.channels[channel], orderers, peers, mspIds, takenContractIds, flowOptions, discovery);
                    takenContractIds.push(config.channels[channel].contracts.map(cc => cc.contractID || cc.id));
                } catch (err) {
                    throw new Error(`Invalid "${channel}" channel configuration: ${err.message}`);
                }
            }
        }

        // now we can validate mutual TLS
        ConfigValidator._validateTopLevel(config, flowOptions, discovery, tls);
        Logger.debug('Exiting validateNetwork');
    }

    /**
     * Validates the top-level properties of the configuration.
     * @param {object} config The network configuration object.
     * @param {object} flowOptions Contains the flow control options for Caliper.
     * @param {boolean} discovery Indicates whether discovery is configured or not.
     * @param {boolean} tls Indicates whether TLS is enabled or known at this point.
     * @private
     */
    static _validateTopLevel(config, flowOptions, discovery, tls) {
        Logger.debug(`Entering _validateTopLevel with discovery "${discovery}" and tls "${tls}"`);
        // some utility vars for the sake of readability
        const onlyScript = !flowOptions.performInit && !flowOptions.performInstall && !flowOptions.performTest;

        // to dynamically call the modifier functions
        const scriptModif = onlyScript ? 'optional' : 'required';
        const ordererModif = (onlyScript || discovery) ? 'optional' : 'required';

        // if server TLS is explicitly disabled, can't enable mutual TLS
        const mutualTlsValid = tls === undefined ? [ true, false ] : (tls ? [ true, false ] : [ false ]);

        const schema = j.object().keys({
            // simple attributes
            name: j.string().min(1).required(),
            version: j.string().valid('1.0').required(),
            'mutual-tls': j.boolean().valid(mutualTlsValid).optional(),
            caliper: j.object().keys({
                blockchain: j.string().valid('fabric').required(),
                command: j.object().keys({
                    start: j.string().min(1).optional(),
                    end: j.string().min(1).optional()
                }).or('start', 'end').optional(),
            }).required(),
            info: j.object().optional(),
            // organizationWallets is an optional array of wallet objects to be used by clients
            organizationWallets: j.object().optional(),
            // complicated parts with custom keys
            clients: j.object()[scriptModif](), // only required for full workflow
            channels: j.object()[scriptModif](), // only required for full workflow
            organizations: j.object()[scriptModif](), // only required for full workflow
            orderers: j.object()[ordererModif](), // only required for full workflow without discovery
            peers: j.object()[scriptModif](), // only required for full workflow
            certificateAuthorities: j.object().optional()
        });

        const options = {
            abortEarly: false,
            allowUnknown: false
        };
        const result = j.validate(config, schema, options);
        if (result.error) {
            throw result.error;
        }
        Logger.debug('Exiting validateNetwork');
    }

    /**
     * Validates the given channel configuration object
     * @param {object} config The configuration object.
     * @param {string[]} validOrderers The array of valid orderer names.
     * @param {string[]} validPeers The array of valid peer names.
     * @param {string[]} validMspIds The array of valid MSP IDs.
     * @param {string[]} takenContractIds The array of invalid/taken contract IDs.
     * @param {object} flowOptions Contains the flow control options for Caliper.
     * @param {boolean} discovery Indicates whether discovery is configured or not.
     */
    static validateChannel(config, validOrderers, validPeers, validMspIds, takenContractIds, flowOptions, discovery) {
        Logger.debug('Entering validateChannel');
        // ugly hack, but there are too many declarative conditional modifiers otherwise
        const created = typeof config.created === 'boolean' ? config.created : false;
        const binary = !!config.configBinary;
        const def = !!config.definition;
        const ordererModif = discovery ? 'optional' : 'required';
        const peerModif = discovery ? 'optional' : 'required';

        let binaryModif;
        let defModif;
        let needXor = false;
        let needOptionalXor = false;

        if (!created) {
            if (def) {
                defModif = 'required'; // definition takes precedence
                binaryModif = 'forbidden'; // if it's not specified, this won't matter
            } else if (binary) { // && !def
                binaryModif = 'required';
                defModif = 'forbidden'; // doesn't matter, it's not specified
            } else {
                // nothing is specified, so make them optional, but require one
                defModif = 'optional';
                binaryModif = 'optional';
                needXor = true;
            }
        } else {
            // nothing is required, but keep the oxor rule if both is specified
            defModif = 'optional';
            binaryModif = 'optional';
            needOptionalXor = true;
        }

        const createPeersSchema = () => {
            const peersSchema = {};
            for (const peer of validPeers) {
                peersSchema[peer] = j.object().keys({
                    endorsingPeer: j.boolean().optional(),
                    chaincodeQuery: j.boolean().optional(),
                    ledgerQuery: j.boolean().optional(),
                    eventSource: j.boolean().optional(),
                }).optional();
            }

            return peersSchema;
        };

        const createEndorsementPolicySchema = () => {
            // recursive schema of "X-of" objects
            // array element objects either have a "signed-by" key, or a recursive "X-of"
            const policySchema = j.array().sparse(false).min(1).items(j.object().min(1)
                .pattern(/^signed-by$/, j.number().integer().min(0))
                .pattern(/^[1-9]\d*-of$/,
                    j.lazy(() => policySchema).description('Policy schema'))
            );

            return j.object().keys({
                identities: j.array().sparse(false).items(j.object().keys({
                    role: j.object().keys({
                        name: j.string().valid('member', 'admin').required(),
                        mspId: j.string().valid(validMspIds).required()
                    }).required()
                })).unique().required(),

                // at the top level, allow exactly one "[integer>0]-of" key
                // the schema of that top level key will be recursive
                policy: j.object().pattern(/^[1-9]\d*-of$/, policySchema).length(1).required()
            });
        };

        const contractIdComparator = (a, b) => {
            if (a.contractID) {
                if (b.contractID) {
                    return a.contractID === b.contractID;
                }

                return a.contractID === b.id;
            } else {
                if (b.contractID) {
                    return a.id === b.contractID;
                }

                return a.id === b.id;
            }
        };

        const collectionsConfigObjectSchema = j.array().sparse(false).min(1).items(j.object().keys({
            name: j.string().min(1).required(),
            policy: createEndorsementPolicySchema().required(),
            requiredPeerCount: j.number().integer().min(0).max(j.ref('maxPeerCount')).required(),
            maxPeerCount: j.number().integer().min(j.ref('requiredPeerCount')).required(),
            blockToLive: j.number().integer().min(0).required()
        })).unique('name');

        let schema = j.object().keys({
            created: j.boolean().optional(),

            configBinary: j.string().min(1)[binaryModif](),

            definition: j.object().keys({
                capabilities: j.array().sparse(false).required(),
                consortium: j.string().min(1).required(),
                msps: j.array().sparse(false).items(j.string().valid(validMspIds)).unique().required(),
                version: j.number().integer().min(0).required()
            })[defModif](),

            orderers: j.array().sparse(false).items(j.string().valid(validOrderers)).unique()[ordererModif](),
            peers: j.object().keys(createPeersSchema())[peerModif](),

            // leave this embedded, so the validation error messages are more meaningful
            contracts: j.array().sparse(false).items(j.object().keys({
                id: j.string().min(1).required(),
                version: j.string().min(1).required(),
                contractID: j.string().min(1).disallow(takenContractIds).optional(),

                language: j.string().valid('golang', 'node', 'java').optional(),
                path: j.string().min(1).optional(),
                metadataPath: j.string().min(1).optional(),
                init: j.array().sparse(false).items(j.string()).optional(),
                function: j.string().optional(),
                // every key must be a string
                initTransientMap: j.object().pattern(j.string(), j.string()).optional(),

                'collections-config': j.alternatives().try(j.string().min(1), collectionsConfigObjectSchema).optional(),

                'endorsement-policy': createEndorsementPolicySchema().optional(),
                targetPeers: j.array().sparse(false).min(1).unique().items(j.string().valid(validPeers)).optional()
            }) // constraints for the contract properties
                .with('metadataPath', 'path') // if metadataPath is provided, installation needs the path
                .with('path', 'language') // if path is provided, installation needs the language
                // the following properties indicate instantiation, which needs the language property
                .with('init', 'language')
                .with('function', 'language')
                .with('initTransientMap', 'language')
                .with('collections-config', 'language')
                .with('endorsement-policy', 'language')
            ).unique(contractIdComparator).required() // for the contracts collection
        });

        if (needXor) {
            schema = schema.xor('configBinary', 'definition');
        } else if (needOptionalXor) {
            schema = schema.oxor('configBinary', 'definition');
        }

        const options = {
            abortEarly: false,
            allowUnknown: false
        };
        const result = j.validate(config, schema, options);
        if (result.error) {
            throw result.error;
        }
        Logger.debug('Exiting validateChannel');
    }

    /**
     * Validates the given CA configuration object.
     * @param {object} config The configuration object.
     * @param {boolean} tls Indicates whether TLS is enabled or known at this point.
     * @param {string} requireRegistrar Indicates whether a registrar is optional or required.
     */
    static validateCertificateAuthority(config, tls, requireRegistrar) {
        Logger.debug('Entering validateCertificateAuthority');
        const urlRegex = tls === undefined ? /^(https|http):\/\// : (tls ? /^https:\/\// : /^http:\/\//);

        const schema = j.object().keys({
            caName: j.string().optional(),
            url: j.string().uri().regex(urlRegex).required(),

            httpOptions: j.object().optional(),

            // required when using https
            tlsCACerts: j.object().keys({
                pem: j.string().min(1).optional(),
                path: j.string().min(1).optional()
            }).xor('pem', 'path').when('url', {
                is: j.string().regex(/^https:\/\//),
                then: j.required(),
                otherwise: j.forbidden()
            }),

            registrar: j.array().items(j.object().keys({
                enrollId: j.string().min(1).required(),
                enrollSecret: j.string().min(1).required()
            })).min(1).sparse(false).unique('enrollId')[requireRegistrar]()
        });

        const options = {
            abortEarly: false,
            allowUnknown: false
        };
        const result = j.validate(config, schema, options);
        if (result.error) {
            throw result.error;
        }
        Logger.debug('Exiting validateCertificateAuthority');
    }

    /**
     * Validates the given peer configuration object.
     * @param {object} config The configuration object.
     * @param {boolean} tls Indicates whether TLS is enabled or known at this point.
     * @param {boolean} eventUrl Indicates whether other peers specified event URLs or not.
     */
    static validatePeer(config, tls, eventUrl) {
        Logger.debug(`Entering validatePeer with tls "${tls}" and eventUrl "${eventUrl}"`);
        const urlRegex = tls === undefined ? /^(grpcs|grpc):\/\// : (tls ? /^grpcs:\/\// : /^grpc:\/\//);
        const eventModif = eventUrl === undefined ? 'optional' : (eventUrl ? 'required' : 'forbidden');

        const schema = j.object().keys({
            url: j.string().uri().regex(urlRegex).required(),
            // match the protocol of the base "url"
            // NOTE: Fabric v1.0.0 can only be detected through the presence of "eventUrl"
            eventUrl: j.string().uri().when('url', {
                is: j.string().regex(/^grpcs:\/\//),
                then: j.string().regex(/^grpcs:\/\//),
                otherwise: j.string().regex(/^grpc:\/\//)
            })[eventModif](),
            grpcOptions: j.object().optional(),

            // required when using https
            tlsCACerts: j.object().keys({
                pem: j.string().min(1).optional(),
                path: j.string().min(1).optional()
            }).xor('pem', 'path').when('url', {
                is: j.string().regex(/^grpcs:\/\//),
                then: j.required(),
                otherwise: j.forbidden()
            })
        });

        const options = {
            abortEarly: false,
            allowUnknown: false
        };
        const result = j.validate(config, schema, options);
        if (result.error) {
            throw result.error;
        }
        Logger.debug('Exiting validatePeer');
    }

    /**
     * Validates the given orderer configuration object.
     * @param {object} config The configuration object.
     * @param {boolean} tls Indicates whether TLS is enabled or known at this point.
     */
    static validateOrderer(config, tls) {
        Logger.debug(`Entering validateOrderer with tls "${tls}"`);
        const urlRegex = tls === undefined ? /^(grpcs|grpc):\/\// : (tls ? /^grpcs:\/\// : /^grpc:\/\//);

        const schema = j.object().keys({
            url: j.string().uri().regex(urlRegex).required(),
            grpcOptions: j.object().optional(),

            // required when using https
            tlsCACerts: j.object().keys({
                pem: j.string().min(1).optional(),
                path: j.string().min(1).optional()
            }).xor('pem', 'path').when('url', {
                is: j.string().regex(/^grpcs:\/\//),
                then: j.required(),
                otherwise: j.forbidden()
            })
        });

        const options = {
            abortEarly: false,
            allowUnknown: false
        };
        const result = j.validate(config, schema, options);
        if (result.error) {
            throw result.error;
        }
        Logger.debug('Exiting validateOrderer');
    }

    /**
     * Validates the given organization configuration object.
     * @param {object} config The configuration object.
     * @param {string[]} validPeers The array of valid peer names.
     * @param {string[]} validCAs The array of valid CA names.
     */
    static validateOrganization(config, validPeers, validCAs) {
        Logger.debug('Entering validateOrganization');
        const schema = j.object().keys({
            mspid: j.string().min(1).required(),
            // optional: to include orderer admin clients, and orderer org must be added, which doesn't have peers
            peers: j.array().items(j.string().valid(validPeers))
                .min(1).sparse(false).unique().optional(),
            certificateAuthorities: j.array().items(j.string().valid(validCAs))
                .min(1).sparse(false).unique().optional(),

            // admin client for orgs are optional
            adminPrivateKey: j.object().keys({
                pem: j.string().min(1).optional(),
                path: j.string().min(1).optional()
            }).xor('pem', 'path').optional(),

            // admin client for orgs are optional
            signedCert: j.object().keys({
                pem: j.string().min(1).optional(),
                path: j.string().min(1).optional()
            }).xor('pem', 'path').optional(),
        }).and('adminPrivateKey', 'signedCert');

        const options = {
            abortEarly: false,
            allowUnknown: false
        };
        const result = j.validate(config, schema, options);
        if (result.error) {
            throw result.error;
        }
        Logger.debug('Exiting validateOrganization');
    }

    /**
     * Validates the given organization wallet configuration object.
     * @param {object} config The configuration object.
     * @param {string[]} validOrgs The valid organizations
     */
    static validateOrganizationWallets(config, validOrgs) {
        Logger.debug('Entering validateOrganizationWallets');

        const options = {
            abortEarly: false,
            allowUnknown: false
        };

        const organizationWallets = Object.keys(config);
        for (const organizationWallet of organizationWallets) {
            // Valid key
            let schema = j.string().valid(validOrgs);
            let result = j.validate(organizationWallet, schema, options);
            if (result.error) {
                throw result.error;
            }

            // Valid object
            const walletObject = config[organizationWallet];
            schema = j.object().keys({
                path: j.string().min(1).required(),
            });

            result = j.validate(walletObject, schema, options);
            if (result.error) {
                throw result.error;
            }
        }

        Logger.debug('Exiting validateOrganizationWallets');
    }

    /**
     * Validates the given client configuration object.
     * @param {object} config The configuration object.
     * @param {string[]} validOrgs The array of valid organization names.
     * @param {boolean} hasOrgWallet flag for presence of wallet for client organization
     */
    static validateClient(config, validOrgs, hasOrgWallet) {
        Logger.debug(`Entering validateClient with validOrgs ${JSON.stringify(validOrgs)} and hasOrgWallet "${hasOrgWallet}"`);
        const walletModif = hasOrgWallet ? 'forbidden' : 'optional';
        const credModif = hasOrgWallet ? 'forbidden' : 'required';

        let clientSchema = j.object().keys({
            organization: j.string().valid(validOrgs).required(),
            // this part is implementation-specific
            credentialStore: j.object().keys({
                path: j.string().min(1).required(),
                cryptoStore: j.object().keys({
                    path: j.string().min(1).required(),
                }).required(),
            })[credModif](),

            clientPrivateKey: j.object().keys({
                pem: j.string().min(1).optional(),
                path: j.string().min(1).optional()
            }).xor('pem', 'path')[walletModif](),

            clientSignedCert: j.object().keys({
                pem: j.string().min(1).optional(),
                path: j.string().min(1).optional()
            }).xor('pem', 'path')[walletModif](),

            affiliation: j.string().min(1)[walletModif](),
            attributes: j.array().items(j.object().keys({
                name: j.string().min(1).required(),
                value: j.string().required(),
                ecert: j.boolean().optional()
            })).min(1).sparse(false).unique('name')[walletModif](),

            enrollmentSecret: j.string().min(1)[walletModif](),

            connection: j.object().keys({
                timeout: j.object().keys({
                    peer: j.object().keys({
                        endorser: j.number().positive().optional(),
                        eventHub: j.number().positive().optional(),
                        eventReg: j.number().positive().optional()
                    }).or('endorser', 'eventHub', 'eventReg').optional(),
                    orderer: j.number().positive().optional()
                }).or('peer', 'orderer').required()
            }).optional()
        });

        if (!hasOrgWallet) {
            // additional constraints for the different "client init" methods without wallet
            // 1) registration and enrollment specified, attributes require affiliation
            // 2) static credentials provided, must be set together
            // 3) only a single method can be specified (enrollment-only has no additional constraints)
            clientSchema = clientSchema
                .with('attributes', 'affiliation') // 1)
                // static init/loading
                .and('clientPrivateKey', 'clientSignedCert') // 2)
                .xor('affiliation', 'enrollmentSecret', 'clientSignedCert'); // 3)
        }

        const schema = j.object().keys({
            client: clientSchema.required()
        });

        const options = {
            abortEarly: false,
            allowUnknown: false
        };
        const result = j.validate(config, schema, options);
        if (result.error) {
            throw result.error;
        }
        Logger.debug('Exiting validateClient');
    }
}

module.exports = ConfigValidator;
