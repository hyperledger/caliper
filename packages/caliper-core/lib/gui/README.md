This is an implementation of temporary GUI demo. 

SSH is used to start local/remote benchmark and fetch results (which are updated in temporary log files) periodically, libssh2-php is required to set up ssh connection.
Go to www/remotecontrol.php to set the host address and login name/password.

EventSource is used in this demo. IE may not support EventSource, so we recommend using Chrome to run the demo.
     
A simple script `caliper/scripts/start.sh` is used to start a benchmark, you may need to add dependent environment such as GOPATH in it.

Only 'simple' benchmark is integrated into the GUI. The supported benchmark is hard coded now.

The demo may support fetch available benchmarks, as well as corresponding configuration files dynamically in the future version.

The demo may also support upload user defined configuration files for specified benchmark in the future.

Directory structure:
* ./www, contains the web portal and php files.
* ./src, contains scripts for caliper benchmark to update performance related log files
* ./output, contains log files mentioned before
* caliper/scripts/start.sh, starts local benchmark 