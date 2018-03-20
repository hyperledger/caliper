This is an implementation of temporary GUI demo. 

SSH is used to start remote benchmark and fetch results (which are updated in temporary log files) periodically. To setup the SSH connection, go to www/remotecontrol.php to define the host address and login name/password.
 
EventSource is used in the demo which is not supported by IE. Although an open source polyfill provided by Yaffle is used to try to fix this problem, we still recommend using chrome to run the demo.     

Only 'simple' benchmark is integrated into the GUI. The config name is hard coded now.

* /www, contains the web portal and php files. Echart v2.2.7 from Baidu company is used to draw dynamic charts.
* /src, contains interfaces for caliper benchmark to update performance log