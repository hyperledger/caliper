# A unified configuration framework
Adopt a unified configuration framework to handle configuration in caliper project.
## Hierarchical configuration
Using [nconf](https://github.com/indexzero/nconf) to give caliper the ability to add hierarchical configuration with files, environment variables, command-line arguments, and atomic object merging.
In the framework, create a Config object that is defined as follows:
```
const Config = class {
    constructor() {
        nconf.use('memory');
        nconf.argv();
        nconf.env();
        this._fileStores = [];
        // reference to configuration settings
        this._config = nconf;
    }
```
The Config object constructor read command line arguments, environment variables, and environment config files in that order of specificity. Later loaded config items will override any previous item, It merges the config items supplied across all the different methods into one single dictionary.

Config load config files such as default.yaml which looks like this:
```
    core:
        client-request-timeout: 45000
        tx-update-time: 3000
    fabric:
    sawtooth:
```

Import Config whenever need to access configuration values like so:
```
    let txUpdateTime = cfUtil.getConfigSetting('core:tx-update-time', 1000);
```
