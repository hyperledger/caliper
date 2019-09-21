/**
Copyright (c) 2007-2013 Alysson Bessani, Eduardo Alchieri, Paulo Sousa, and the authors indicated in the @author tags

Licensed under the Apache License, Version 2.0 (the "License");
you may not use this file except in compliance with the License.
You may obtain a copy of the License at

http://www.apache.org/licenses/LICENSE-2.0

Unless required by applicable law or agreed to in writing, software
distributed under the License is distributed on an "AS IS" BASIS,
WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
See the License for the specific language governing permissions and
limitations under the License.
*/
package bftsmart.reconfiguration.util;

import java.security.PrivateKey;
import java.security.PublicKey;
import java.util.StringTokenizer;

import bftsmart.tom.util.Logger;

public class TOMConfiguration extends Configuration {

    protected int n;
    protected int f;
    protected int requestTimeout;
    protected int tomPeriod;
    protected int paxosHighMark;
    protected int revivalHighMark;
    protected int timeoutHighMark;
    protected int replyVerificationTime;
    protected int maxBatchSize;
    protected int numberOfNonces;
    protected int inQueueSize;
    protected int outQueueSize;
    protected boolean shutdownHookEnabled;
    protected boolean useSenderThread;
    protected RSAKeyLoader rsaLoader;
    private int debug;
    private int numNIOThreads;
    private int useMACs;
    private int useSignatures;
    private boolean stateTransferEnabled;
    private int checkpointPeriod;
    private int globalCheckpointPeriod;
    private int useControlFlow;
    private int[] initialView;
    private int ttpId;
	private boolean isToLog;
	private boolean syncLog;
	private boolean parallelLog;
	private boolean logToDisk;
	private boolean isToWriteCkpsToDisk;
	private boolean syncCkp;
    private boolean isBFT;
    private int numRepliers;
    
    /** Creates a new instance of TOMConfiguration */
    public TOMConfiguration(int processId) {
        super(processId);
    }

    /** Creates a new instance of TOMConfiguration */
    public TOMConfiguration(int processId, String configHome) {
        super(processId, configHome);
    }

    /** Creates a new instance of TOMConfiguration */
    public TOMConfiguration(int processId, String configHome, String hostsFileName) {
        super(processId, configHome, hostsFileName);
    }

    @Override
    protected void init() {
        super.init();
        try {
            n = Integer.parseInt(configs.remove("system.servers.num").toString());
            String s = (String) configs.remove("system.servers.f");
            if (s == null) {
                f = (int) Math.ceil((n - 1) / 3);
            } else {
                f = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.shutdownhook");
            shutdownHookEnabled = (s != null) ? Boolean.parseBoolean(s) : false;

            s = (String) configs.remove("system.totalordermulticast.period");
            if (s == null) {
                tomPeriod = n * 5;
            } else {
                tomPeriod = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.totalordermulticast.timeout");
            if (s == null) {
                requestTimeout = 10000;
            } else {
                requestTimeout = Integer.parseInt(s);
                if (requestTimeout < 0) {
                    requestTimeout = 0;
                }
            }

            s = (String) configs.remove("system.totalordermulticast.highMark");
            if (s == null) {
                paxosHighMark = 10000;
            } else {
                paxosHighMark = Integer.parseInt(s);
                if (paxosHighMark < 10) {
                    paxosHighMark = 10;
                }
            }

            s = (String) configs.remove("system.totalordermulticast.revival_highMark");
            if (s == null) {
                revivalHighMark = 10;
            } else {
                revivalHighMark = Integer.parseInt(s);
                if (revivalHighMark < 1) {
                    revivalHighMark = 1;
                }
            }

            s = (String) configs.remove("system.totalordermulticast.timeout_highMark");
            if (s == null) {
                timeoutHighMark = 100;
            } else {
                timeoutHighMark = Integer.parseInt(s);
                if (timeoutHighMark < 1) {
                    timeoutHighMark = 1;
                }
            }
            
            s = (String) configs.remove("system.totalordermulticast.maxbatchsize");
            if (s == null) {
                maxBatchSize = 100;
            } else {
                maxBatchSize = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.debug");
            if (s == null) {
                Logger.debug = false;
            } else {
                debug = Integer.parseInt(s);
                if (debug == 0) {
                    Logger.debug = false;
                } else {
                    Logger.debug = true;
                }
            }

            s = (String) configs.remove("system.totalordermulticast.replayVerificationTime");
            if (s == null) {
                replyVerificationTime = 0;
            } else {
                replyVerificationTime = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.totalordermulticast.nonces");
            if (s == null) {
                numberOfNonces = 0;
            } else {
                numberOfNonces = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.communication.useSenderThread");
            if (s == null) {
                useSenderThread = false;
            } else {
                useSenderThread = Boolean.parseBoolean(s);
            }

            s = (String) configs.remove("system.communication.numNIOThreads");
            if (s == null) {
                numNIOThreads = 2;
            } else {
                numNIOThreads = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.communication.useMACs");
            if (s == null) {
                useMACs = 0;
            } else {
                useMACs = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.communication.useSignatures");
            if (s == null) {
                useSignatures = 0;
            } else {
                useSignatures = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.totalordermulticast.state_transfer");
            if (s == null) {
                stateTransferEnabled = false;
            } else {
                stateTransferEnabled = Boolean.parseBoolean(s);
            }

            s = (String) configs.remove("system.totalordermulticast.checkpoint_period");
            if (s == null) {
                checkpointPeriod = 1;
            } else {
                checkpointPeriod = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.communication.useControlFlow");
            if (s == null) {
                useControlFlow = 0;
            } else {
                useControlFlow = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.initial.view");
            if (s == null) {
                initialView = new int[n];
                for (int i = 0; i < n; i++) {
                    initialView[i] = i;
                }
            } else {
                StringTokenizer str = new StringTokenizer(s, ",");
                initialView = new int[str.countTokens()];
                for (int i = 0; i < initialView.length; i++) {
                    initialView[i] = Integer.parseInt(str.nextToken());
                }
            }

            s = (String) configs.remove("system.ttp.id");
            if (s == null) {
                ttpId = -1;
            } else {
                ttpId = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.communication.inQueueSize");
            if (s == null) {
                inQueueSize = 1000;
            } else {

                inQueueSize = Integer.parseInt(s);
                if (inQueueSize < 1) {
                    inQueueSize = 1000;
                }

            }

            s = (String) configs.remove("system.communication.outQueueSize");
            if (s == null) {
                outQueueSize = 1000;
            } else {
                outQueueSize = Integer.parseInt(s);
                if (outQueueSize < 1) {
                    outQueueSize = 1000;
                }
            }

			s = (String) configs.remove("system.totalordermulticast.log");
			if (s != null) {
				isToLog = Boolean.parseBoolean(s);
			} else {
				isToLog = false;
			}

			s = (String) configs
					.remove("system.totalordermulticast.log_parallel");
			if (s != null) {
				parallelLog = Boolean.parseBoolean(s);
			} else {
				parallelLog = false;
			}

			s = (String) configs
					.remove("system.totalordermulticast.log_to_disk");
			if (s != null) {
				logToDisk = Boolean.parseBoolean(s);
			} else {
				logToDisk = false;
			}
			
			s = (String) configs
					.remove("system.totalordermulticast.sync_log");
			if (s != null) {
				syncLog = Boolean.parseBoolean(s);
			} else {
				syncLog = false;
			}

			s = (String) configs
					.remove("system.totalordermulticast.checkpoint_to_disk");
			if (s == null) {
				isToWriteCkpsToDisk = false;
			} else {
				isToWriteCkpsToDisk = Boolean.parseBoolean(s);
			}
			
			s = (String) configs
					.remove("system.totalordermulticast.sync_ckp");
			if (s == null) {
				syncCkp = false;
			} else {
				syncCkp = Boolean.parseBoolean(s);
			}

            s = (String) configs.remove("system.totalordermulticast.global_checkpoint_period");
            if (s == null) {
                globalCheckpointPeriod = 1;
            } else {
                globalCheckpointPeriod = Integer.parseInt(s);
            }

            s = (String) configs.remove("system.bft");
            isBFT = (s != null) ? Boolean.parseBoolean(s) : true;

            s = (String) configs.remove("system.numrepliers");
            if (s == null) {
                numRepliers = 1;
            } else {
                numRepliers = Integer.parseInt(s);
            }
            
            rsaLoader = new RSAKeyLoader(processId, TOMConfiguration.configHome);
        } catch (Exception e) {
            e.printStackTrace(System.err);
        }

    }

    public String getViewStoreClass() {
        String s = (String) configs.remove("view.storage.handler");
        if (s == null) {
            return "bftsmart.reconfiguration.views.DefaultViewStorage";
        } else {
            return s;
        }

    }

    public boolean isTheTTP() {
        return (this.getTTPId() == this.getProcessId());
    }

    public final int[] getInitialView() {
        return this.initialView;
    }

    public int getTTPId() {
        return ttpId;
    }

    public int getRequestTimeout() {
        return requestTimeout;
    }

    public int getReplyVerificationTime() {
        return replyVerificationTime;
    }

    public int getN() {
        return n;
    }

    public int getF() {
        return f;
    }
    
    public int getPaxosHighMark() {
        return paxosHighMark;
    }

    public int getRevivalHighMark() {
        return revivalHighMark;
    }
    
    public int getTimeoutHighMark() {
        return timeoutHighMark;
    }
    
    public int getMaxBatchSize() {
        return maxBatchSize;
    }

    public boolean isShutdownHookEnabled() {
        return shutdownHookEnabled;
    }

    public boolean isStateTransferEnabled() {
        return stateTransferEnabled;
    }

    public int getInQueueSize() {
        return inQueueSize;
    }

    public int getOutQueueSize() {
        return outQueueSize;
    }

    public boolean isUseSenderThread() {
        return useSenderThread;
    }

    /**
     *     *
     */
    public int getNumberOfNIOThreads() {
        return numNIOThreads;
    }

    /**     * @return the numberOfNonces     */
    public int getNumberOfNonces() {
        return numberOfNonces;
    }

    /**
     * Indicates if signatures should be used (1) or not (0) to authenticate client requests
     */
    public int getUseSignatures() {
        return useSignatures;
    }

    /**
     * Indicates if MACs should be used (1) or not (0) to authenticate client-server and server-server messages
     */
    public int getUseMACs() {
        return useMACs;
    }

    /**
     * Indicates the checkpoint period used when fetching the state from the application
     */
    public int getCheckpointPeriod() {
        return checkpointPeriod;
    }

	public boolean isToWriteCkpsToDisk() {
		return isToWriteCkpsToDisk;
	}
	
	public boolean isToWriteSyncCkp() {
		return syncCkp;
	}

	public boolean isToLog() {
		return isToLog;
	}

	public boolean isToWriteSyncLog() {
		return syncLog;
	}

	public boolean logToDisk() {
		return logToDisk;
	}

	public boolean isToLogParallel() {
		// TODO Auto-generated method stub
		return parallelLog;
	}

    /**
     * Indicates the checkpoint period used when fetching the state from the application
     */
    public int getGlobalCheckpointPeriod() {
        return globalCheckpointPeriod;
    }

    /**
     * Indicates if a simple control flow mechanism should be used to avoid an overflow of client requests
     */
    public int getUseControlFlow() {
        return useControlFlow;
    }

    public PublicKey getRSAPublicKey() {
        try {
            return rsaLoader.loadPublicKey();
        } catch (Exception e) {
            e.printStackTrace(System.err);
            return null;
        }

    }

    public PublicKey getRSAPublicKey(int id) {
        try {
            return rsaLoader.loadPublicKey(id);
        } catch (Exception e) {
            e.printStackTrace(System.err);
            return null;
        }

    }
    
    public PrivateKey getRSAPrivateKey() {
        try {
            return rsaLoader.loadPrivateKey();
        } catch (Exception e) {
            e.printStackTrace(System.err);
            return null;
        }
    }

    public boolean isBFT(){
    	
    	return this.isBFT;
    }

    public int getNumRepliers() {
        return numRepliers;
    }
}
