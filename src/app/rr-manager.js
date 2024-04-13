
// Namespace definition
Ext.ns('SYNOCOMMUNITY.RRManager');

// Application definition
Ext.define('SYNOCOMMUNITY.RRManager.AppInstance', {
    extend: 'SYNO.SDS.AppInstance',
    appWindowName: 'SYNOCOMMUNITY.RRManager.AppWindow',
    constructor: function () {
        this.callParent(arguments)
    }
});

// Window definition
Ext.define('SYNOCOMMUNITY.RRManager.AppWindow', {
    // Translator
    _V: function (category, element) {
        return _TT("SYNOCOMMUNITY.RRManager.AppInstance", category, element)
    },

    formatString: function (str, ...args) {
        return str.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    },
    extend: "SYNO.SDS.PageListAppWindow",
    activePage: "SYNOCOMMUNITY.RRManager.Overview.Main",
    defaultWinSize: { width: 1160, height: 620 },
    constructor: function (config) {
        const t = this;
        t.callParent([t.fillConfig(config)]);
    },
    fillConfig: function (e) {
        let t;
        t = this.getListItems();
        const i = {
            cls: "syno-app-iscsi",
            width: this.defaultWinSize.width,
            height: this.defaultWinSize.height,
            minWidth: this.defaultWinSize.width,
            minHeight: this.defaultWinSize.height,
            activePage: "SYNOCOMMUNITY.RRManager.Overview.Main",
            listItems: t,
        };
        return Ext.apply(i, e), i;

    },
    getListItems: function () {
        return [
            {
                text: this._V('ui', 'tab_general'),
                iconCls: "icon-overview",
                fn: "SYNOCOMMUNITY.RRManager.Overview.Main",
                // help: "overview.html",
            },
            {
                text: this._V('ui', 'tab_addons'),
                iconCls: "icon-log",
                fn: "SYNOCOMMUNITY.RRManager.Addons.Main",
                // help: "overview.html",
            },
            {
                text: this._V('ui', 'tab_configuration'),
                iconCls: "icon-settings",
                fn: "SYNOCOMMUNITY.RRManager.Setting.Main",
                // help: "setting.html",
            },
            {
                text: this._V('ui', 'tab_debug'),
                iconCls: "icon-debug",
                fn: "SYNOCOMMUNITY.RRManager.Debug.Main",
                // help: "setting.html",
            },
        ];
    },

    onOpen: function (a) {
        SYNOCOMMUNITY.RRManager.AppWindow.superclass.onOpen.call(this, a);
    }
});

//Overview tab
Ext.define("SYNOCOMMUNITY.RRManager.Overview.Main", {
    extend: "SYNO.ux.Panel",
    _V: function (category, element) {
        return _TT("SYNOCOMMUNITY.RRManager.AppInstance", category, element)
    },

    formatString: function (str, ...args) {
        return str.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    },
    _prefix: '/webman/3rdparty/rr-manager/',
    handleFileUpload: function (jsonData) {
        this._handleFileUpload(jsonData).then(x => {
            this.runScheduledTask('ApplyRRConfig');
            this.showMsg(this._V('ui', 'rr_config_applied'));
            this.appWin.clearStatusBusy();
        });
    },
    _handleFileUpload: function (jsonData) {
        let url = `${this._prefix}uploadConfigFile.cgi`;
        return new Promise((resolve, reject) => {
            Ext.Ajax.request({
                url: url,
                method: 'POST',
                jsonData: jsonData,
                headers: {
                    'Content-Type': 'application/json'
                },
                success: function (response) {
                    resolve(Ext.decode(response.responseText));
                },
                failure: function (response) {
                    reject('Failed with status: ' + response.status);
                }
            });
        });
    },
    runScheduledTask: function (taskName) {
        that = this;
        return new Promise((resolve, reject) => {
            let params = {
                task_name: taskName
            };
            let args = {
                api: 'SYNO.Core.EventScheduler',
                method: 'run',
                version: 1,
                params: params,
                stop_when_error: false,
                mode: 'sequential',
                callback: function (success, message) {
                    success ? resolve(message) : reject('Unable to get packages!');
                }
            };
            that.sendWebAPI(args);
        });
    },
    constructor: function (e) {
        const t = this;
        this.installed = false;
        (this.appWin = e.appWin),
            (this.appWin.handleFileUpload = this.handleFileUpload.bind(this)),
            (this.appWin.runScheduledTask = this.runScheduledTask.bind(this)),
            (this.loaded = !1),
            t.callParent([t.fillConfig(e)]),
            t.mon(
                t,
                "data_ready",
                () => {
                    if (t?.getActivePage)
                        t?.getActivePage()?.fireEvent("data_ready");
                },
                t
            );
    },
    fillConfig: function (e) {
        this.panels = {
            healthPanel: new SYNOCOMMUNITY.RRManager.Overview.HealthPanel({
                appWin: e.appWin,
                owner: this,
            }),
        };
        const t = {
            layout: "vbox",
            cls: "blue-border",
            layoutConfig: { align: "stretch" },
            items: Object.values(this.panels),
            listeners: {
                scope: this,
                activate: this.onActivate,
                deactivate: this.onDeactive,
                data_ready: this.onDataReady,
            },
        };
        return Ext.apply(t, e), t;
    }, _getRrConfig: function () {
        const rrConfigJson = localStorage.getItem('rrConfig');
        return JSON.parse(rrConfigJson);
    },
    __checkDownloadFolder: function (callback) {
        var self = this;

        const rrConfig = this._getRrConfig();
        const config = rrConfig.rr_manager_config;
        this.getSharesList().then(x => {
            var shareName = `/${config['SHARE_NAME']}`;
            var sharesList = x.shares;
            var downloadsShareMetadata = sharesList.find(x => x.path.toLowerCase() == shareName.toLowerCase());
            if (!downloadsShareMetadata) {
                var msg = this.formatString(this._V('ui', 'share_notfound_msg'), config['SHARE_NAME']);
                self.appWin.setStatusBusy({ text: this._V('ui', 'checking_dependencies_loader') });
                self.showMsg(msg);
                return;
            }
            if (callback) callback();
        });
    },
    getPasswordConfirm: function (data) {
        self = this;
        return new Promise((resolve, reject) => {
            let args = {
                api: "SYNO.Core.User.PasswordConfirm",
                method: "auth",
                version: 2,
                params: {
                    password: data
                }, callback: function (success, message) {
                    success ? resolve(message?.SynoConfirmPWToken)
                        : reject('Unable to create task!');
                },
            };
            self.sendWebAPI(args);
        });
    },
    __checkRequiredTasks: async function () {
        var self = this;
        var requiredTasks = [{
            name: "RunRrUpdate",
            createTaskCallback: self.createAndRunSchedulerTask.bind(this)
        }, {
            name: "SetRootPrivsToRrManager",
            createTaskCallback: self.createAndRunSchedulerTaskSetRootPrivilegesForRrManager.bind(this)
        }, {
            name: "ApplyRRConfig",
            createTaskCallback: self.createSchedulerTaskApplyRRConfig.bind(this)
        }];

        try {
            let response = await self.getTaskList();
            var tasks = response.tasks;
            var tasksToCreate = requiredTasks.filter(task => !tasks.find(x => x.name === task.name));
            if (tasksToCreate.length > 0) {
                let tasksNames = tasksToCreate.map(task => task.name).join(', ');
                async function craeteTasks() {
                    for (let task of tasksToCreate) {
                        if (task.createTaskCallback) {
                            var data = await self.showPasswordConfirmDialog(task.name);
                            task.createTaskCallback(data);
                        }
                    }
                    // After all tasks have been created, you might want to notify the user.
                    self.showMsg(self._V('ui', 'tasks_created_msg'));
                    self.owner.clearStatusBusy();
                }
                self.appWin.getMsgBox().confirm(
                    "Confirmation",
                    self.formatString(
                        self.formatString(self._V('ui', 'required_tasks_is_missing'), tasksNames),
                        self._V('ui', 'required_components_missing')),
                    (userResponse) => {
                        if ("yes" === userResponse) {
                            craeteTasks();
                        } else {
                            Ext.getCmp(self.id).getEl().mask(self.formatString(self._V('ui', 'required_components_missing_spinner_msg'), tasksNames), "x-mask-loading");
                        }
                    }, self,
                    {
                        cancel: { text: _T("common", "cancel") },
                        yes: { text: _T("common", "agree"), btnStyle: 'red' }
                    }, {
                    icon: "confirm-delete-icon"
                }
                );
            }
        } catch (error) {
            console.error('Error checking or creating tasks:', error);
        }
    },
    showPasswordConfirmDialog: function (taskName) {
        return new Promise((resolve, reject) => {
            var window = new SYNO.SDS.ModalWindow({
                id: "confirm_password_dialog",
                title: `${_T("common", "enter_password_to_continue")} for task: ${taskName}.`,
                width: 500,
                height: 200,
                resizable: false,
                layout: "fit",
                buttons: [
                    {
                        xtype: "syno_button",
                        text: _T("common", "alt_cancel"),
                        scope: this,
                        handler: function () {
                            Ext.getCmp("confirm_password_dialog").close();
                        },
                    },
                    {
                        xtype: "syno_button",
                        text: _T("common", "submit"),
                        btnStyle: "blue",
                        scope: this,
                        handler: function () {
                            const passwordValue = Ext.getCmp("confirm_password").getValue();
                            Ext.getCmp("confirm_password_dialog").close();
                            resolve(passwordValue);
                        }
                    },
                ],
                items: [
                    {
                        xtype: "syno_formpanel",
                        id: "password_form_panel",
                        bodyStyle: "padding: 0",
                        items: [
                            {
                                xtype: "syno_displayfield",
                                value: String.format(_T("common", "enter_user_password")),
                            },
                            {
                                xtype: "syno_textfield",
                                fieldLabel: _T("common", "password"),
                                textType: "password",
                                id: "confirm_password",
                            },
                        ],
                    },
                ],
            });
            window.open();
        });
    },
    createAndRunSchedulerTask: function (data) {
        this.getPasswordConfirm(data).then(data => {
            //TODO: remove hardcoded update.zip file name
            this.createTask("RunRrUpdate",
                ".%20%2Fvar%2Fpackages%2Frr-manager%2Ftarget%2Fapp%2Fconfig.txt%20%26%26%20%2Fusr%2Fbin%2Frr-update.sh%20updateRR%20%22%24UPLOAD_DIR_PATH%24RR_TMP_DIR%22%2Fupdate.zip%20%2Ftmp%2Frr_update_progress",
                data
            );
        });
    },
    createAndRunSchedulerTaskSetRootPrivilegesForRrManager: function (data) {
        that = this;
        this.getPasswordConfirm(data).then(data => {
            this.createTask("SetRootPrivsToRrManager",
                "sed%20-i%20's%2Fpackage%2Froot%2Fg'%20%2Fvar%2Fpackages%2Frr-manager%2Fconf%2Fprivilege%20%26%26%20synopkg%20restart%20rr-manager",
                data
            ).then(x => {
                that.sendRunSchedulerTaskWebAPI(data);
            });
        });
    },
    createSchedulerTaskApplyRRConfig: function (data) {
        this.getPasswordConfirm(data).then(data => {
            this.createTask("ApplyRRConfig",
                "cp%20%2Ftmp%2Fuser-config.yml%20%2Fmnt%2Fp1%2Fuser-config.yml%20%26%26%20cp%20%2Ftmp%2F.build%20%2Fmnt%2Fp1%2F.build",
                data
            );
        });
    },
    createTask: function (task_name, operation, token) {
        that = this;
        return new Promise((resolve, reject) => {
            let params = {
                task_name: task_name,
                owner: { 0: "root" },
                event: "bootup",
                enable: false,
                depend_on_task: "",
                notify_enable: false,
                notify_mail: "",
                notify_if_error: false,
                operation_type: "script",
                operation: decodeURIComponent(operation)
            };

            if (token != "") {
                params.SynoConfirmPWToken = token
            }

            let args = {
                api: token != "" ? "SYNO.Core.EventScheduler.Root" : "SYNO.Core.EventScheduler",
                method: "create",
                version: 1,
                params: params,
                callback: function (success, message) {
                    success ? resolve(message) : reject('Unable to create task!');
                },
                scope: this,
            };
            that.sendWebAPI(args);
        });
    },
    sendRunSchedulerTaskWebAPI: function (token) {
        args = {
            api: "SYNO.Core.EventScheduler",
            method: "run",
            version: 1,
            params: {
                task_name: "SetRootPrivsToRrManager",
            },
            callback: function (success, message, data) {
                if (!success) {
                    console.log("error run EventScheduler task");
                    return;
                }
            },
            scope: this,
        };

        if (token != "") {
            args.params.SynoConfirmPWToken = token
        }
        this.sendWebAPI(args);
    },
    getSharesList: function () {
        that = this;
        return new Promise((resolve, reject) => {
            let params = {
                filetype: 'dir', // URL-encode special characters if needed
                sort_by: 'name',
                check_dir: true,
                additional: '["real_path","owner","time","perm","mount_point_type","sync_share","volume_status","indexed","hybrid_share","worm_share"]',
                enum_cluster: true,
                node: 'fm_root'
            };
            let args = {
                api: 'SYNO.FileStation.List',
                method: 'list_share',
                version: 2,
                params: params,
                callback: function (success, message) {
                    success ? resolve(message) : reject('Unable to get getSytemInfo!');
                }
            };
            that.sendWebAPI(args);
        });
    },
    getTaskList: function () {
        that = this;
        return new Promise((resolve, reject) => {
            let params = {
                sort_by: "next_trigger_time",
                sort_direction: "ASC",
                offset: 0,
                limit: 50
            };
            let args = {
                api: 'SYNO.Core.TaskScheduler',
                method: 'list',
                version: 3,
                params: params,
                callback: function (success, message) {
                    success ? resolve(message) : reject('Unable to get packages!');
                }
            };
            that.sendWebAPI(args);
        });
    },
    checkRRVersion: function () {
        return this.callCustomScript('getRrReleaseInfo.cgi');
    },
    showPrompt: function (title, message, text, yesCallback) {
        var window = new SYNO.SDS.ModalWindow({
            closeAction: "hide",
            cls: "x-window-dlg",
            layout: 'anchor',
            width: 750,
            height: 600,
            resizable: false,
            modal: true,
            title: title,
            buttons: [{
                text: _T("common", "alt_cancel"),
                // Handle Cancel
                handler: function () {
                    window.close();
                }
            }, {
                text: _V("ui", "alt_confirm"),
                itemId: "confirm",
                btnStyle: "blue",
                // Handle Confirm
                handler: function () {
                    if (yesCallback) yesCallback();
                    window.close();
                }
            }],
            items: [
                {
                    // Display the prompt message
                    xtype: 'box',
                    autoEl: { tag: 'div', html: message },
                    style: 'margin: 10px;',
                    anchor: '100%'
                },
                {
                    // Display changelog title
                    xtype: 'syno_displayfield',
                    anchor: '100%',
                    style: 'margin: 10px; font-weight: bold;',
                    value: 'Changelog:'
                },
                {
                    // Display the changelog in a scrollable view
                    xtype: 'box',
                    autoEl: { tag: 'div', html: text.replace(/\n/g, '<br>') },
                    style: 'margin: 10px; overflow-y: auto; border: 1px solid #ccc; padding: 5px;',
                    height: '75%', // Fixed height for the scrollable area
                    anchor: '100%'
                }
            ]
        });
        window.open();
    },
    onActivate: function () {
        const self = this;
        if (this.loaded) return;
        self.appWin.setStatusBusy(null, null, 50);
        self.runScheduledTask('MountLoaderDisk');
        (async () => {
            self.systemInfo = await self.getSytemInfo();
            self.packages = await self.getPackagesList();
            self.rrCheckVersion = await self.checkRRVersion();
            if (self.systemInfo && self.packages) {
                self.systemInfoTxt = `Model: ${self.systemInfo?.model}, RAM: ${self.systemInfo?.ram} MB, DSM version: ${self.systemInfo?.version_string} `;
                const rrManagerPackage = self.packages.packages.find(package => package.id == 'rr-manager');
                self.rrManagerVersionText = `🛡️RR Manager v.: ${rrManagerPackage?.version}`;
                self.panels.healthPanel.fireEvent(
                    "select",
                    self.panels.healthPanel.clickedBox
                );
                await self.updateAllForm();
                self.rrVersionText = self.rrConfig.rr_version;
                if (!self.installed) {
                    //create rr tmp folder
                    self.rrManagerConfig = self.rrConfig.rr_manager_config;
                    SYNO.API.currentManager.requestAPI('SYNO.FileStation.CreateFolder', "create", "2", {
                        folder_path: `/${self.rrManagerConfig.SHARE_NAME}`,
                        name: self.rrManagerConfig.RR_TMP_DIR,
                        force_parent: false
                    });
                    self.installed = true;
                }

                self.panels.healthPanel.fireEvent("data_ready");
                self.loaded = true;
            }
            function donwloadUpdate() {
                SYNO.API.currentManager.requestAPI('SYNO.DownloadStation2.Task', "create", "2", {
                    type: "url",
                    destination: `${self.rrManagerConfig.SHARE_NAME}/${self.rrManagerConfig.RR_TMP_DIR}`,
                    create_list: true,
                    url: [self.rrCheckVersion.updateAllUrl]
                });
            }
            if (self?.rrCheckVersion?.status == "update available"
                && self?.rrCheckVersion?.tag != "null"
                && self.rrConfig.rr_version !== self?.rrCheckVersion?.tag) {
                self.showPrompt(self._T('ui', 'prompt_update_available_title'),
                    self.formatString(self._T('ui', 'prompt_update_available_message'), self.rrCheckVersion.tag), self.rrCheckVersion.notes, donwloadUpdate);
            }
        })();
        self.__checkDownloadFolder(self.__checkRequiredTasks.bind(self));
    },
    getUpdateFileInfo: function (file) {
        return new Promise((resolve, reject) => {
            Ext.Ajax.request({
                url: `${this._prefix}readUpdateFile.cgi`,
                method: 'GET',
                timeout: 60000,
                params: {
                    file: file
                },
                headers: {
                    'Content-Type': 'text/html'
                },
                success: function (response) {
                    // if response text is string need to decode it
                    if (typeof response?.responseText === 'string' && response?.responseText != "") {
                        resolve(Ext.decode(response?.responseText));
                    } else {
                        resolve(response?.responseText);
                    }
                },
                failure: function (result) {
                    if (typeof result?.responseText === 'string' && result?.responseText) {
                        var response = Ext.decode(result?.responseText);
                        reject(response?.error);
                    }
                    else {
                        reject('Failed with status: ' + response?.status);
                    }
                }
            });
        });
    },
    showMsg: function (msg) {
        this.owner.getMsgBox().alert("title", msg);
    },
    onRunRrUpdateManuallyClick: function () {
        const self = this;
        const rrConfigJson = localStorage.getItem('rrConfig');
        const rrConfig = JSON.parse(rrConfigJson);
        const rrManagerConfig = rrConfig.rr_manager_config;
        //TODO: remove hardcoded update.zip file name
        const url = `${rrManagerConfig?.UPLOAD_DIR_PATH}${rrManagerConfig?.RR_TMP_DIR}/update.zip`;
        this.getUpdateFileInfo(url).then((responseText) => {
            if (!responseText.success) {
                self.owner.getEl()?.unmask();
                this.showMsg(self.formatString(self._V('ui', 'unable_update_rr_msg'), responseText?.error ?? "No response from the readUpdateFile.cgi script."));
                return;
            }
            const configName = 'rrUpdateFileVersion';
            self.owner[configName] = responseText;
            const currentRrVersion = rrConfig.rr_version;
            const updateRrVersion = self.owner[configName].updateVersion;

            async function runUpdate() {
                //show the spinner
                self.owner.getEl().mask(_T("common", "loading"), "x-mask-loading");
                self.appWin.runScheduledTask('RunRrUpdate');
                const maxCountOfRefreshUpdateStatus = 350;
                let countUpdatesStatusAttemp = 0;

                const updateStatusInterval = setInterval(async function () {
                    const checksStatusResponse = await self.callCustomScript('checkUpdateStatus.cgi');
                    if (!checksStatusResponse?.success) {
                        clearInterval(updateStatusInterval);
                        self.owner.getEl()?.unmask();
                        self.showMsg(checksStatusResponse?.status);
                    }
                    const response = checksStatusResponse.result;
                    self.owner.getEl()?.mask(self.formatString(self._V('ui', 'update_rr_progress_msg'), response?.progress ?? "--", response?.progressmsg ?? "--"), 'x-mask-loading');
                    countUpdatesStatusAttemp++;
                    if (countUpdatesStatusAttemp == maxCountOfRefreshUpdateStatus || response?.progress?.startsWith('-')) {
                        clearInterval(updateStatusInterval);
                        self.owner.getEl()?.unmask();
                        self.showMsg(self.formatString(self._V('ui'), response?.progress, response?.progressmsg));
                    } else if (response?.progress == '100') {
                        self.owner.getEl()?.unmask();
                        clearInterval(updateStatusInterval);
                        self.showMsg(self._V('ui', 'update_rr_completed'));
                    }
                }, 1500);
            }
            self.appWin.getMsgBox().confirmDelete(
                "Confirmation",
                self.formatString(self._V('ui', 'update_rr_confirmation'), currentRrVersion, updateRrVersion),
                (userResponse) => {
                    if ("yes" === userResponse) {
                        runUpdate();
                    }
                },
                e,
                {
                    yes: {
                        text: "Proceed",
                        btnStyle: "red",
                    },
                    no: { text: "Cancel" },
                }
            );
        }).catch(error => {
            this.showMsg(`Error. ${error}`);
        });
    },
    updateAllForm: async function () {
        that = this.appWin;
        this.owner.setStatusBusy();
        try {
            const rrConfig = await this.getConf();
            var configName = 'rrConfig';
            that[configName] = rrConfig;
            this[configName] = rrConfig;

            localStorage.setItem(configName, JSON.stringify(rrConfig));
        } catch (e) {
            SYNO.Debug(e);
        } finally {
            this.owner.clearStatusBusy();
        }
    },
    _prefix: '/webman/3rdparty/rr-manager/',
    callCustomScript: function (scriptName) {

        return new Promise((resolve, reject) => {
            Ext.Ajax.request({
                url: `${this._prefix}${scriptName}`,
                method: 'GET',
                timeout: 60000,
                headers: {
                    'Content-Type': 'text/html'
                },
                success: function (response) {
                    // if response text is string need to decode it
                    if (typeof response?.responseText === 'string') {
                        resolve(Ext.decode(response?.responseText));
                    } else {
                        resolve(response?.responseText);
                    }
                },
                failure: function (result) {
                    if (typeof result?.responseText === 'string' && result?.responseText && !result?.responseText.startsWith('<')) {
                        var response = Ext.decode(result?.responseText);
                        reject(response?.error);
                    }
                    else {
                        reject('Failed with status: ' + result?.status);
                    }
                }
            });
        });
    },
    getConf: function () {
        return this.callCustomScript('getConfig.cgi')
    },
    onDeactive: function () {
        this.panels.healthPanel.fireEvent(
            "deactivate",
            this.panels.healthPanel.clickedBox
        );
    },
    getSytemInfo: function () {
        that = this;
        return new Promise((resolve, reject) => {
            let args = {
                api: 'SYNO.DSM.Info',
                method: 'getinfo',
                version: 2,
                callback: function (success, message) {
                    success ? resolve(message) : reject('Unable to get getSytemInfo!');
                }
            };
            that.sendWebAPI(args);
        });
    },
    getPackagesList: function () {
        that = this;
        return new Promise((resolve, reject) => {
            let params = {
                additional: ["description", "description_enu", "dependent_packages", "beta", "distributor", "distributor_url", "maintainer", "maintainer_url", "dsm_apps", "dsm_app_page", "dsm_app_launch_name", "report_beta_url", "support_center", "startable", "installed_info", "support_url", "is_uninstall_pages", "install_type", "autoupdate", "silent_upgrade", "installing_progress", "ctl_uninstall", "updated_at", "status", "url", "available_operation", "install_type"],
                ignore_hidden: false,
            };
            let args = {
                api: 'SYNO.Core.Package',
                method: 'list',
                version: 2,
                params: params,
                callback: function (success, message) {
                    success ? resolve(message) : reject('Unable to get packages!');
                }
            };
            that.sendWebAPI(args);
        });
    },
    onDataReady: async function () {
        const e = this;
        e.loaded = true;
        // need to clean the spinner when form has been loaded
        e.appWin.clearStatusBusy();
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.Overview.HealthPanel", {
    extend: "SYNO.ux.Panel",
    _V: function (category, element) {
        return _TT("SYNOCOMMUNITY.RRManager.AppInstance", category, element)
    },

    formatString: function (str, ...args) {
        return str.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    },

    constructor: function (e) {
        this.appWin = e.appWin;
        this.owner = e.owner;
        this.callCustomScript = this.owner.callCustomScript.bind(this.owner);
        this.callParent([this.fillConfig(e)]);
    },
    onDataReady: function () {
        let status = "normal";
        this.iconTemplate.overwrite(this.getComponent("icon").getEl(), { status: status }),
            this.titleTemplate.overwrite(this.upperPanel.getComponent("title").getEl(), {
                status: status,
            }),
            this.updateDescription("current");
        this.getComponent("rrActionsPanel")?.setVisible(true);
        this.owner.fireEvent("data_ready");
    },
    createUploadPannel: function () {
        var myFormPanel = new Ext.form.FormPanel({
            title: this._V("ui", "lb_select_update_file"),
            fileUpload: true,
            name: 'upload_form',
            border: !1,
            bodyPadding: 10,
            items: [{
                xtype: 'syno_filebutton',
                text: this._V('ui', 'select_file'),
                name: 'filename',
                allowBlank: false,
            }],
        });
        this["upload_form"] = myFormPanel;
        return myFormPanel;
    },
    _baseUrl: 'webapi/entry.cgi?',
    sendArray: function (formData, fileDetails, fileData, chunkDetails, tempFile) {
        var self = this;
        var headers = {}, requestParams = {};
        var uploadData;

        if (fileDetails.status !== "CANCEL") {
            if (fileDetails.chunkmode) {
                headers = {
                    "Content-Type": "multipart/form-data; boundary=" + formData.boundary
                };
                requestParams = {
                    "X-TYPE-NAME": "SLICEUPLOAD",
                    "X-FILE-SIZE": fileDetails.size,
                    "X-FILE-CHUNK-END": chunkDetails.total <= 1 || chunkDetails.index === chunkDetails.total - 1 ? "true" : "false"
                };
                if (tempFile) {
                    Ext.apply(requestParams, {
                        "X-TMP-FILE": tempFile
                    });
                }
                if (window.XMLHttpRequest.prototype.sendAsBinary) {
                    uploadData = formData.formdata + (fileData !== "" ? fileData : "") + "\r\n--" + formData.boundary + "--\r\n";
                } else if (window.Blob) {
                    var data = new Uint8Array(formData.formdata.length + fileData.length + "\r\n--" + formData.boundary + "--\r\n".length);
                    data.set(new TextEncoder().encode(formData.formdata + fileData + "\r\n--" + formData.boundary + "--\r\n"));
                    uploadData = data;
                }
            } else {
                formData.append("size", fileDetails.size);
                fileDetails.name ? formData.append(this.opts.filefiledname, fileDetails, this.opts.params.filename) : formData.append(this.opts.filefiledname, fileDetails.file);
                uploadData = formData;
            }
            this.conn = new Ext.data.Connection({
                method: 'POST',
                url: `${this._baseUrl}api=SYNO.FileStation.Upload&method=upload&version=2&SynoToken=${localStorage['SynoToken']}`,
                defaultHeaders: headers,
                timeout: null
            });
            var request = this.conn.request({
                headers: requestParams,
                html5upload: true,
                chunkmode: fileDetails.chunkmode,
                uploadData: uploadData,
                success: (response) => {
                    self.appWin.clearStatusBusy();
                    self.appWin.getMsgBox().confirmDelete(
                        self.appWin.title,
                        self._V('ui', 'file_uploading_succesfull_msg'),
                        (result) => {
                            if (result === "yes") {
                                self.owner.onRunRrUpdateManuallyClick();
                            }
                        },
                        formData,
                        {
                            yes: {
                                text: "Yes",
                                btnStyle: "red",
                            },
                            no: { text: Ext.MessageBox.buttonText.no },
                        }
                    );
                },
                failure: (response) => {
                    self.appWin.clearStatusBusy();
                    self.showMsg(self._V('ui', 'file_uploading_failed_msg'));
                    console.error(self._V('ui', 'file_uploading_failed_msg'));
                    console.log(response);
                },
                progress: (progressEvent) => {
                    const percentage = ((progressEvent.loaded / progressEvent.total) * 100).toFixed(2);
                    self.appWin.clearStatusBusy();
                    self.appWin.setStatusBusy({ text: `${_T("common", "loading")}. ${self._V("ui", "completed")} ${percentage}%.` }, percentage);
                },
            });
        }
    },
    MAX_POST_FILESIZE: Ext.isWebKit ? -1 : window.console && window.console.firebug ? 20971521 : 4294963200,
    showMsg: function (msg) {
        //TODO: use native alerts
        alert(msg);
    },
    showUpdateUploadDialog: function () {
        that = this;
        var window = new SYNO.SDS.ModalWindow({
            id: "upload_file_dialog",
            title: this._V("ui", "upload_file_dialog_title"),
            width: 500,
            height: 400,
            resizable: false,
            layout: "fit",
            buttons: [
                {
                    xtype: "syno_button",
                    text: _T("common", "alt_cancel"),
                    scope: this,
                    handler: function () {
                        Ext.getCmp("upload_file_dialog")?.close();
                    },
                },
                {
                    xtype: "syno_button",
                    text: _T("common", "submit"),
                    btnStyle: "blue",
                    scope: this,
                    handler: function () {
                        const form = that["upload_form"].getForm();
                        var fileObject = form.el.dom[1].files[0];
                        if (!form.isValid()) {
                            that.showMsg(this._V('ui', 'upload_update_file_form_validation_invalid_msg'));
                            return;
                        }
                        this.appWin.setStatusBusy();
                        that.onUploadFile(fileObject, that);
                        Ext.getCmp("upload_file_dialog")?.close();
                    }
                },
            ],
            items: [
                this.createUploadPannel()
            ],
        });
        window.open();
    },
    onUploadFile: function (e, d) {
        let rrConfigJson = localStorage.getItem('rrConfig');
        let rrConfig = JSON.parse(rrConfigJson);
        let rrManagerConfig = rrConfig.rr_manager_config;
        this.opts.params.path = `/${rrManagerConfig.SHARE_NAME}/${rrManagerConfig.RR_TMP_DIR}`;
        let file = new File([e], this.opts.params.filename);
        let isChunkMode = false;
        if (-1 !== this.MAX_POST_FILESIZE && file.size > this.MAX_POST_FILESIZE && isChunkMode)
            this.onError({
                errno: {
                    section: "error",
                    key: "upload_too_large"
                }
            }, file);
        else {
            let formData = this.prepareStartFormdata(file);
            if (file.chunkmode) {
                let chunkSize = this.opts.chunksize;
                let totalChunks = Math.ceil(file.size / chunkSize);
                this.onUploadPartailFile(formData, file, {
                    start: 0,
                    index: 0,
                    total: totalChunks
                })
            } else
                this.sendArray(formData, file)
        }
    },
    opts: {
        chunkmode: false,
        filefiledname: "file",
        file: function (file) {
            var createFileObject = function (file, params, id, dtItem) {
                var modifiedParams = SYNO.SDS.copy(params || {});
                var lastModifiedTime = SYNO.webfm.utils.getLastModifiedTime(file);

                if (lastModifiedTime) {
                    modifiedParams = Ext.apply(modifiedParams, {
                        mtime: lastModifiedTime
                    });
                }

                return {
                    id: id,
                    file: file,
                    dtItem: dtItem,
                    name: file.name || file.fileName,
                    size: file.size || file.fileSize,
                    progress: 0,
                    status: "NOT_STARTED",
                    params: modifiedParams,
                    chunkmode: false
                };
            }

            var lastModifiedTime = SYNO.webfm.utils.getLastModifiedTime(file);
            var fileObject = new createFileObject(file, { mtime: lastModifiedTime });
            return fileObject;
        },
        //TODO: remove hard coding
        params: {
            // populating from the config in onOpen
            path: '',
            //TODO: remove hardcoding of the filename
            filename: "update.zip",
            overwrite: true
        }
    },
    prepareStartFormdata: function (file) {
        const isChunkMode = (-1 !== this.MAX_POST_FILESIZE && file.size > this.MAX_POST_FILESIZE);
        if (isChunkMode) {
            const boundary = `----html5upload-${new Date().getTime()}${Math.floor(65535 * Math.random())}`;
            let contentPrefix = "";

            if (this.opts.params) {
                for (const paramName in this.opts.params) {
                    if (this.opts.params.hasOwnProperty(paramName)) {
                        contentPrefix += `--${boundary}\r\n`;
                        contentPrefix += `Content-Disposition: form-data; name="${paramName}"\r\n\r\n`;
                        contentPrefix += `${unescape(encodeURIComponent(this.opts.params[paramName]))}\r\n`;
                    }
                }
            }

            if (file.params) {
                for (const paramName in file.params) {
                    if (file.params.hasOwnProperty(paramName)) {
                        contentPrefix += `--${boundary}\r\n`;
                        contentPrefix += `Content-Disposition: form-data; name="${paramName}"\r\n\r\n`;
                        contentPrefix += `${unescape(encodeURIComponent(file.params[paramName]))}\r\n`;
                    }
                }
            }

            const filename = unescape(encodeURIComponent(file.name));
            contentPrefix += `--${boundary}\r\n`;
            contentPrefix += `Content-Disposition: form-data; name="${this.opts.filefiledname || "file"}"; filename="${filename}"\r\n`;
            contentPrefix += 'Content-Type: application/octet-stream\r\n\r\n';

            return {
                formData: contentPrefix,
                boundary: boundary
            };
        } else {
            const formData = new FormData();

            if (this.opts.params) {
                for (const paramName in this.opts.params) {
                    if (this.opts.params.hasOwnProperty(paramName)) {
                        formData.append(paramName, this.opts.params[paramName]);
                    }
                }
            }

            if (file.params) {
                for (const paramName in file.params) {
                    if (file.params.hasOwnProperty(paramName)) {
                        formData.append(paramName, file.params[paramName]);
                    }
                }
            }

            return formData;
        }
    },
    onUploadPartailFile: function (e, t, i, o) {
        i.start = i.index * this.opts.chunksize;
        var chunkSize = Math.min(this.opts.chunksize, t.size - i.start);

        if ("PROCESSING" === t.status) {
            var fileSlice;

            if (window.File && File.prototype.slice) {
                fileSlice = t.file.slice(i.start, i.start + chunkSize);
            } else if (window.File && File.prototype.webkitSlice) {
                fileSlice = t.file.webkitSlice(i.start, i.start + chunkSize);
            } else if (window.File && File.prototype.mozSlice) {
                fileSlice = t.file.mozSlice(i.start, i.start + chunkSize);
            } else {
                this.onError({}, t);
                return;
            }

            this.sendArray(e, t, fileSlice, i, o);
        }
    },
    createActionsSection: function () {
        return new SYNO.ux.FieldSet({
            title: this._V('ui', 'section_rr_actions'),
            items: [
                {
                    xtype: 'syno_panel',
                    // cls: 'panel-with-border',
                    activeTab: 0,
                    plain: true,
                    items: [
                        {
                            xtype: 'syno_compositefield',
                            hideLabel: true,
                            items: [{
                                xtype: 'syno_displayfield',
                                value: this._V('ui', 'run_update'),
                                width: 140
                            }, {
                                xtype: 'syno_button',
                                btnStyle: 'green',
                                text: this._V('ui', 'upload_file_dialog_title'),
                                handler: this.showUpdateUploadDialog.bind(this)
                            }, {
                                xtype: 'syno_button',
                                btnStyle: 'green',
                                text: "New Upload Update",
                                handler: this.showUpdateUploadWizard.bind(this)
                            }]
                        },
                    ],
                    deferredRender: true
                },
            ]
        });
    },
    //TODO: modify to zip
    tabType: "zip",
    showUpdateUploadWizard: function () {
        var a = new SYNOCOMMUNITY.RRManager.UpdateWizard.Wizard({
            owner: this.appWin,
            //TODO: use localized text
            title: "Add Update*.zip file",
            imageType: this.tabType,
            pollingWindow: this.owner,
            records: {
                data: {
                    items: []
                }
            } //this.overviewPanel.store,
        });
        a.open();
    },
    fillConfig: function (e) {
        this.poolLinkId = Ext.id();
        this.iconTemplate = this.createIconTpl();
        this.titleTemplate = this.createTitleTpl();
        this.upperPanel = this.createUpperPanel();
        this.lowerPanel = this.createLowerPanel();

        this.descriptionMapping = {
            normal: this._V('ui', 'greetings_text'),
            target_abnormal: []
        };

        const panelConfig = {
            layout: "hbox",
            cls: "iscsi-overview-health-panel",
            autoHeight: true,
            items: [
                { xtype: "box", itemId: "icon", cls: "health-icon-block" },
                {
                    xtype: "syno_panel",
                    itemId: "rightPanel",
                    cls: "health-text-block",
                    flex: 1,
                    height: 180,
                    layout: "vbox",
                    layoutConfig: { align: "stretch" },
                    items: [this.upperPanel, this.lowerPanel],
                },
                {
                    xtype: "syno_panel",
                    itemId: "rrActionsPanel",
                    flex: 1,
                    height: 96,
                    hidden: true,
                    layout: "vbox",
                    layoutConfig: { align: "stretch" },
                    items: [this.createActionsSection()],
                },
            ],
            listeners: { scope: this, data_ready: this.onDataReady },
        };
        return Ext.apply(panelConfig, e), panelConfig;

    },
    createIconTpl: function () {
        return new Ext.XTemplate('<div class="health-icon {status}"></div>', {
            compiled: !0,
            disableFormats: !0,
        });
    },
    createTitleTpl: function () {
        return new Ext.XTemplate(
            '<div class="health-text-title {status}">{[this.getStatusText(values.status)]}</div>',
            {
                compiled: !0,
                disableFormats: !0,
                statusText: {
                    normal: "Healthy",
                    warning: "Warning",
                    error: "Error"
                },
                getStatusText: function (e) {
                    return this.statusText[e];
                },
            }
        );
    },
    createUpperPanel: function () {
        return new SYNO.ux.Panel({
            layout: "hbox",
            items: [
                {
                    xtype: "box",
                    itemId: "title",
                    flex: 1,
                    cls: "iscsi-overview-health-title-block",
                },
                {
                    xtype: "syno_button",
                    itemId: "leftBtn",
                    hidden: !0,
                    cls: "iscsi-overview-health-prev-btn",
                    scope: this,
                    handler: this.onLeftBtnClick,
                    text: " ",
                },
                {
                    xtype: "syno_button",
                    itemId: "rightBtn",
                    hidden: !0,
                    cls: "iscsi-overview-health-next-btn",
                    scope: this,
                    handler: this.onRightBtnClick,
                    text: " ",
                },
            ],
        });
    },
    createLowerPanel: function () {
        return new SYNO.ux.Panel({
            flex: 1,
            items: [
                {
                    xtype: "syno_displayfield",
                    itemId: "desc",
                    cls: "health-text-content",
                    htmlEncode: !1,
                },
                {
                    xtype: "syno_displayfield",
                    itemId: "desc2",
                    cls: "health-text-content",
                    htmlEncode: !1,
                },
                {
                    xtype: "syno_displayfield",
                    itemId: "desc3",
                    cls: "health-text-content",
                    htmlEncode: !1,
                },
            ],
        });
    },
    updateDescription: function (status) {
        const self = this;
        this.descriptions = [];
        let description,
            statusDescription,
            index = -1;
        const
            descriptionCount = this.descriptions.length,
            rightPanel = this.getComponent("rightPanel"),
            descriptionField = this.lowerPanel.getComponent("desc"),
            versionField = this.lowerPanel.getComponent("desc3"),
            rrVersionField = this.lowerPanel.getComponent("desc2"),
            leftButton = this.upperPanel.getComponent("leftBtn"),
            rightButton = this.upperPanel.getComponent("rightBtn"),
            initialHeight = descriptionField.getHeight();
        let panelHeight = rightPanel.getHeight(),
            isHeightChanged = false;
        statusDescription = this.descriptionMapping.normal;
        descriptionField.setValue(self.owner.systemInfoTxt);
        versionField.setValue(self.owner.rrManagerVersionText);
        rrVersionField.setValue(`💊RR v. ${self.owner.rrVersionText}`);

        const updatedHeight = descriptionField.getHeight();
        if (
            (updatedHeight !== initialHeight && ((panelHeight = panelHeight - initialHeight + updatedHeight), (isHeightChanged = true)),
                isHeightChanged && ((rightPanel.height = panelHeight), this.doLayout(), this.owner.doLayout()),
                this.descriptions.length <= 1)
        )
            return leftButton.hide(), void rightButton.hide();
        (leftButton.hidden || rightButton.hidden) && (leftButton.show(), rightButton.show(), this.doLayout());
    },
    prepareSummaryStatus: function (status, data) {
        // Function body goes here
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.Overview.StatusBoxTmpl", {
    extend: "Ext.XTemplate",
    _V: function (category, element) {
        return _TT("SYNOCOMMUNITY.RRManager.AppInstance", category, element)
    },

    formatString: function (str, ...args) {
        return str.replace(/{(\d+)}/g, function (match, number) {
            return typeof args[number] !== 'undefined' ? args[number] : match;
        });
    },
    constructor: function (e) {
        const t = this.createTpl();
        t.push(this.fillConfig(e)), this.callParent(t);
    },
    fillConfig: function (e) {
        const templateConfig = { compiled: true, disableFormats: true },
            translations = {};

        return (
            {
                getTranslate: (key) => translations[key],
                getStatusText: (type, status) => {
                    const statusTexts = {
                        'fctarget': translations.status.fctarget[status],
                        'target': translations.status.target[status],
                        'lun': translations.status.lun[status],
                        'event': translations.status.event[status]
                    };
                    return statusTexts[type];
                },
                isBothErrorWarn: (error, warning) => error !== 0 && warning !== 0,
                showNumber: (number) => number > 99 ? '99+' : number
            },
            Ext.apply(templateConfig, e)
        );
    },
    createTpl: function () {
        return [
            '<div class="iscsi-overview-statusbox iscsi-overview-statusbox-{type} iscsi-overview-statusbox-{errorlevel} iscsi-overview-statusbox-{clickType}">',
            '<div class="statusbox-titlebar"></div>',
            '<div class="statusbox-box">',
            '<div class="statusbox-title">',
            "<h3>{[ this.getTranslate(values.type) ]}</h3>",
            "</div>",
            '<div class="statusbox-title-right">',
            "<h3>{[ this.showNumber(values.total) ]}</h3>",
            "</div>",
            '<div class="x-clear"></div>',
            '<div class="statusbox-title-padding">',
            "</div>",
            '<tpl if="this.isBothErrorWarn(error, warning)">',
            '<div class="statusbox-halfblock-left statusbox-block-error">',
            '<div class="statusbox-number">{[ this.showNumber(values.error) ]}</div>',
            '<div class="statusbox-text" ext:qtip="{[ this.getStatusText(values.type, "error") ]}">{[ this.getStatusText(values.type, "error") ]}</div>',
            "</div>",
            '<div class="statusbox-halfblock-right statusbox-block-warning">',
            '<div class="statusbox-number">{[ this.showNumber(values.warning) ]}</div>',
            '<div class="statusbox-text" ext:qtip="{[ this.getStatusText(values.type, "warning") ]}">{[ this.getStatusText(values.type, "warning") ]}</div>',
            "</div>",
            "</tpl>",
            '<tpl if="! this.isBothErrorWarn(error, warning)">',
            '<div class="statusbox-block statusbox-block-{errorlevel}">',
            '<div class="statusbox-number">{[ this.showNumber(values[values.errorlevel]) ]}</div>',
            '<div class="statusbox-text" ext:qtip="{[ this.getStatusText(values.type, values.errorlevel) ]}">{[ this.getStatusText(values.type, values.errorlevel) ]}</div>',
            "</div>",
            "</tpl>",
            "</div>",
            "</div>",
        ];
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.Overview.StatusBox", {
    extend: "SYNO.ux.Panel",
    constructor: function (e) {
        this.callParent([this.fillConfig(e)]);
    },
    fillConfig: function (e) {
        (this.appWin = e.appWin),
            (this.tpl = new SYNOCOMMUNITY.RRManager.Overview.StatusBoxTmpl());
        const t = {
            items: [
                {
                    itemId: "statusBox",
                    xtype: "box",
                    cls: "iscsi-overview-statusbox-block",
                    html: "",
                },
            ],
            listeners: {
                scope: this,
                afterrender: this.onAfterRender,
                update: this.updateTpl,
                data_ready: this.onDataReady,
            },
        };
        return Ext.apply(t, e), t;
    },
    onAfterRender: function () {
        this.mon(this.body, "click", this.onMouseClick, this);
    },
    updateTpl: function () {
        this.tpl.overwrite(
            this.getComponent("statusBox").getEl(),
            Ext.apply(
                {
                    type: this.type,
                    clickType:
                        this.owner.clickedBox === this.type ? "click" : "unclick",
                    errorlevel: this.errorlevel,
                    total:
                        this.data.total ||
                        this.data.error + this.data.warning + this.data.healthy,
                },
                this.data
            )
        );
    },
    onMouseClick: function () {
        this.owner.fireEvent("selectchange", this.type);
    },
    processFCTrgSummary: function () {
        const self = this;
        const targets = self.appWin.fcTargets.getAll();
        self.data.total = 0;
        Ext.each(
            targets,
            (target) => {
                self.data.total++;
                if ("connected" === target.get("status")) {
                    self.data.healthy++;
                } else if (target.get("is_enabled") || target.get("status") !== false) {
                    self.data.warning++;
                }
            },
            self
        );
    },
    processTrgSummary: function () {
        const e = this,
            t = e.appWin.iscsiTargets.getAll();
        (e.data.total = 0),
            Ext.each(
                t,
                (t) => {
                    e.data.total++,
                        "connected" === t.get("status")
                            ? e.data.healthy++
                            : t.get("is_enabled") &&
                            "offline" === t.get("status") &&
                            e.data.warning++;
                },
                e
            );
    },
    processLUNSummary: function () {
        const e = this,
            t = e.appWin.iscsiLuns.getAll();
        Ext.each(
            t,
            function (t) {
                let i = "healthy";
                t.isSummaryCrashed(
                    this.appWin.volumes,
                    this.appWin.pools,
                    this.appWin.isLowCapacityWriteEnable()
                )
                    ? (i = "error")
                    : t.isSummaryWarning(this.appWin.volumes, this.appWin.pools) &&
                    (i = "warning"),
                    e.data[i]++;
            },
            e
        );
    },
    processEventSummary: function () {
        const e = this.appWin.summary;
        (this.data.warning = e.warn_count ? e.warn_count : 0),
            (this.data.error = e.error_count ? e.error_count : 0),
            (this.data.healthy = e.info_count ? e.info_count : 0);
    },
    onDataReady: function () {
        console.log("--onDataReady2")
        switch (
        ((this.data = { error: 0, warning: 0, healthy: 0 }), this.storeKey)
        ) {
            case "fc_target_summ":
                this.processFCTrgSummary();
                break;
            case "target_summ":
                this.processTrgSummary();
                break;
            case "lun_summ":
                this.processLUNSummary();
                break;
            case "event_summ":
                this.processEventSummary();
        }
        this.data.error
            ? (this.errorlevel = "error")
            : this.data.warning
                ? (this.errorlevel = "warning")
                : (this.errorlevel = "healthy"),
            this.updateTpl();
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.Overview.StatusBoxsPanel", {
    extend: "SYNO.ux.Panel",
    constructor: function (e) {
        this.callParent([this.fillConfig(e)]);
    },
    fillConfig: function (e) {
        const statusBoxConfig = { owner: this, appWin: e.appWin, flex: 1 };
        this.selectedBox = "lun";
        this.statusBoxes = [
            new SYNOCOMMUNITY.RRManager.Overview.StatusBox(
                Ext.apply({ type: "lun", title: "LUN", storeKey: "lun_summ" }, statusBoxConfig)
            ),
            new SYNO.ux.Panel({ width: 10 }),
            new SYNOCOMMUNITY.RRManager.Overview.StatusBox(
                Ext.apply(
                    { type: "target", title: "Target", storeKey: "target_summ" },
                    statusBoxConfig
                )
            ),
            new SYNO.ux.Panel({ width: 10 }),
            new SYNOCOMMUNITY.RRManager.Overview.StatusBox(
                Ext.apply(
                    {
                        type: "fctarget",
                        title: "FCTarget",
                        storeKey: "fc_target_summ",
                    },
                    statusBoxConfig
                )
            ),
            new SYNO.ux.Panel({ width: 10 }),
            new SYNOCOMMUNITY.RRManager.Overview.StatusBox(
                Ext.apply(
                    {
                        type: "event",
                        title: "Events",
                        storeKey: "event_summ",
                    },
                    statusBoxConfig
                )
            ),
        ];
        if (!e.appWin.supportFC) {
            this.statusBoxes.splice(4, 2);
        }
        const panelConfig = {
            cls: "iscsi-overview-status-panel",
            layout: "hbox",
            layoutConfig: { align: "stretch" },
            items: this.statusBoxes,
            listeners: {
                scope: this,
                selectchange: this.onSelectChange,
                data_ready: this.onDataReady,
            },
        };
        return Ext.apply(panelConfig, e), panelConfig;
    },
    onSelectChange: function (e) {
        (this.clickedBox = e),
            Ext.each(this.statusBoxs, (e) => {
                e.fireEvent("update");
            }),
            this.owner.panels.detailPanel.fireEvent("select", e);
    },

    onDataReady: function () {
        console.log("--onDataReady3")
        Ext.each(this.statusBoxs, (e) => {
            e.fireEvent("data_ready");
        });
    },
});

//Addons tab
Ext.define("SYNOCOMMUNITY.RRManager.Addons.Main", {
    extend: "SYNO.ux.GridPanel",
    itemsPerPage: 1e3,
    constructor: function (e) {
        this.appWin = e.appWin;
        const self = this;
        Ext.apply(self, e);
        let config = self.fillConfig(e);
        self.itemsPerPage = self.appWin.appInstance.getUserSettings(self.itemId + "-dsPageLimit") || self.itemsPerPage;
        self.callParent([config]);
        self.mon(
            self,
            "resize",
            (e, width, height) => {
                self.updateFbarItems(width);
            },
            self
        );
    },
    getPageRecordStore: function () {
        return new Ext.data.SimpleStore({
            fields: ["value", "display"],
            data: [
                [100, 100],
                [500, 500],
                [1e3, 1e3],
                [3e3, 3e3],
            ],
        });
    },
    getCategoryStore: function () {
        return new Ext.data.SimpleStore({
            fields: ["value", "display"],
            data: [
                ["", this.owner._V('ui', 'addons_all')],
                ["system", this.owner._V('ui', 'addons_system')],
            ],
        });
    },
    onChangeDisplayRecord: function (e, t, i) {
        const self = this,
            addonsStore = self.addonsStore;
        const newItemsPerPage = e.getValue();
        if (self.itemsPerPage !== newItemsPerPage) {
            self.itemsPerPage = newItemsPerPage;
            self.paging.pageSize = self.itemsPerPage;
            addonsStore.load({ params: { offset: 0, limit: self.itemsPerPage } });
            self.appWin.appInstance.setUserSettings(
                self.itemId + "-dsPageLimit",
                self.itemsPerPage
            );
        }
    },
    onChangeCategory: function (e, t, i) {
        const s = this,
            n = s.addonsStore,
            a = e.getValue();
        a !== n.baseParams.category &&
            (Ext.apply(n.baseParams, { category: a }), s.loadData());
    },
    initPageComboBox: function (e) {
        return new SYNO.ux.ComboBox({
            name: "page_rec",
            hiddenName: "page_rec",
            hiddenId: Ext.id(),
            store: e,
            displayField: "display",
            valueField: "value",
            triggerAction: "all",
            value: this.itemsPerPage,
            editable: !1,
            width: 72,
            mode: "local",
            listeners: { select: { fn: this.onChangeDisplayRecord, scope: this } },
        });
    },
    initCategoryComboBox: function (e) {
        return new SYNO.ux.ComboBox({
            name: "category",
            store: e,
            displayField: "display",
            valueField: "value",
            value: "",
            width: 120,
            mode: "local",
            listeners: { select: { fn: this.onChangeCategory, scope: this } },
        });
    },
    initPagingToolbar: function () {
        return new SYNO.ux.PagingToolbar({
            store: this.addonsStore,
            displayInfo: !0,
            pageSize: this.itemsPerPage,
            showRefreshBtn: !0,
            cls: "iscsi-log-toolbar",
            items: [
                {
                    xtype: "tbtext",
                    style: "padding-right: 4px",
                    text: "Items per page",
                },
                this.initPageComboBox(this.getPageRecordStore()),
            ],
        });
    },
    initSearchForm: function () {
        // return new SYNO.SDS.iSCSI.SearchFormPanel({
        //     cls: "iscsi-search-panel",
        //     renderTo: Ext.getBody(),
        //     shadow: !1,
        //     hidden: !0,
        //     owner: this,
        // });
    },
    initToolbar: function () {
        const e = this,
            t = new SYNO.ux.Toolbar();
        return (
            // (e.clearButton = new SYNO.ux.Button({
            //     xtype: "syno_button",
            //     text: "Clear",
            //     handler: e.onLogClear,
            //     scope: e,
            // })),
            (e.saveButton = new SYNO.ux.Button({
                xtype: "syno_button",
                text: e.owner._V("ui", "save_addons_btn"),
                handler: e.onAddonsSave,
                btnStyle: "blue",
                scope: e,
            })),
            (e.searchField = new SYNOCOMMUNITY.RRManager.AdvancedSearchField({
                iconStyle: "filter",
                owner: e,
            })),
            (e.searchField.searchPanel = e.searchPanel),
            // t.add(e.clearButton),
            t.add(e.saveButton),
            t.add("->"),
            t.add(e.initCategoryComboBox(e.getCategoryStore())),
            t.add({ xtype: "tbspacer", width: 4 }),
            t.add(e.searchField),
            t
        );
        // return [];
    },
    initEvents: function () {
        // this.mon(this.searchPanel, "search", this.onSearch, this),
        this.mon(this, "activate", this.onActive, this);
    },
    _getLng: function (lng) {
        const localeMapping = {
            'dan': 'da_DK', // Danish in Denmark
            'ger': 'de_DE', // German in Germany
            'enu': 'en_US', // English (United States)
            'spn': 'es_ES', // Spanish (Spain)
            'fre': 'fr_FR', // French in France
            'ita': 'it_IT', // Italian in Italy
            'hun': 'hu_HU', // Hungarian in Hungary
            'nld': 'nl_NL', // Dutch in The Netherlands
            'nor': 'no_NO', // Norwegian in Norway
            'plk': 'pl_PL', // Polish in Poland
            'ptg': 'pt_PT', // European Portuguese
            'ptb': 'pt_BR', // Brazilian Portuguese
            'sve': 'sv_SE', // Swedish in Sweden
            'trk': 'tr_TR', // Turkish in Turkey
            'csy': 'cs_CZ', // Czech in Czech Republic
            'gre': 'el_GR', // Greek in Greece
            'rus': 'uk-UA',
            'heb': 'he_IL', // Hebrew in Israel
            'ara': 'ar_SA', // Arabic in Saudi Arabia
            'tha': 'th_TH', // Thai in Thailand
            'jpn': 'ja_JP', // Japanese in Japan
            'chs': 'zh_CN', // Simplified Chinese in China
            'cht': 'zh_TW', // Traditional Chinese in Taiwan
            'krn': 'ko_KR', // Korean in Korea
            'vi': 'vi-VN', // Vietnam in Vietnam 
        };
        return Object.keys(localeMapping).indexOf(lng) > -1
            ? localeMapping[lng] : localeMapping['enu'];
    },
    getStore: function () {
        var gridStore = new SYNO.API.JsonStore({
            autoDestroy: true,
            appWindow: this.appWin,
            restful: true,
            root: "result",
            url: `/webman/3rdparty/rr-manager/getAddons.cgi`,
            idProperty: "name",
            fields: [{
                name: 'name',
                type: 'string'
            }, {
                name: 'version',
                type: 'string'
            }, {
                name: 'description',
                type: 'object'
            }, {
                name: 'system',
                type: 'boolean'
            }, {
                name: 'installed',
                type: 'boolean'
            }],
            listeners: {
                exception: this.loadException,
                beforeload: this.onBeforeStoreLoad,
                load: this.onAfterStoreLoad,
                scope: this,
            }
        });
        return gridStore;
    },
    getColumnModel: function () {
        var currentLngCode = this._getLng(SYNO?.SDS?.Session?.lang || "enu");
        this.Col1 = new SYNO.ux.EnableColumn({
            header: this.owner._V("ui", "col_system"),
            dataIndex: "system",
            id: "system",
            name: "system",
            width: 100,
            align: "center",
            enableFastSelectAll: false,
            disabled: true,
            bindRowClick: true
        })
        this.Col2 = new SYNO.ux.EnableColumn({
            header: this.owner._V("ui", "col_installed"),
            dataIndex: "installed",
            name: "installed",
            id: "installed",
            width: 100,
            align: "center",
            enableFastSelectAll: false,
            disabled: true,
            bindRowClick: true
        });

        return new Ext.grid.ColumnModel({
            columns: [
                {
                    header: this.owner._V("ui", "col_name"),
                    width: 60,
                    dataIndex: 'name'
                }, {
                    header: this.owner._V("ui", "col_version"),
                    width: 30,
                    dataIndex: 'version'
                }, {
                    header: this.owner._V("ui", "col_description"),
                    width: 300,
                    dataIndex: 'description',
                    renderer: function (value, metaData, record, row, col, store, gridView) {
                        return value[currentLngCode] ?? value['en_US'];
                    }
                }, this.Col1, this.Col2,
            ],
            defaults: { sortable: !1, menuDisabled: !1 },
        });
    },
    fillConfig: function (e) {
        const t = this;
        // (t.searchPanel = t.initSearchForm()),
        (t.addonsStore = t.getStore()),
            (t.paging = t.initPagingToolbar());
        const i = {
            border: !1,
            trackResetOnLoad: !0,
            layout: "fit",
            itemId: "iscsi_log",
            tbar: t.initToolbar(),
            enableColumnMove: !1,
            enableHdMenu: !1,
            bbar: t.paging,
            store: t.addonsStore,
            colModel: t.getColumnModel(),
            view: new SYNO.ux.FleXcroll.grid.BufferView({
                rowHeight: 27,
                scrollDelay: 30,
                borderHeight: 1,
                emptyText: "no_log_available",
                templates: {
                    cell: new Ext.XTemplate(
                        '<td class="x-grid3-col x-grid3-cell x-grid3-td-{id} x-selectable {css}" style="{style}" tabIndex="-1" {cellAttr}>',
                        '<div class="{this.selectableCls} x-grid3-cell-inner x-grid3-col-{id}" {attr}>{value}</div>',
                        "</td>",
                        { selectableCls: SYNO.SDS.Utils.SelectableCLS }
                    ),
                },
            }),
            plugins: [this.Col1, this.Col2],
            selModel: new Ext.grid.RowSelectionModel({
                singleSelect: false
            }),
            loadMask: !0,
            stripeRows: !0,
            listeners: {
                cellclick: {
                    delay: 100,
                    scope: this,
                    fn: this.onCellClick
                },
            }
        };
        return Ext.apply(i, e), i;
    },
    onCellClick: function (grid, recordIndex, i, s) {
        var record = grid.store.data.get(recordIndex);
        var id = grid.getColumnModel().getColumnAt(i).id;
        if (id !== 'system' && record.data['system'] === false) {
            record.data[id] = !record.data[id];
            grid.getView().refresh();
        }
    },
    isBelong: function (e, t) {
        let i;
        for (i in t) if (t[i] !== e[i]) return !1;
        return !0;
    },
    isTheSame: function (e, t) {
        return this.isBelong(e, t) && this.isBelong(t, e);
    },
    onSearch: function (e, t) {
        const i = this,
            s = i.addonsStore;
        if (!i.isTheSame(s.baseParams, t)) {
            const e = ["name", "description"];
            if (
                (t.date_from &&
                    (t.date_from =
                        Date.parseDate(
                            t.date_from,
                            SYNO.SDS.DateTimeUtils.GetDateFormat()
                        ) / 1e3),
                    t.date_to)
            ) {
                const e = Date.parseDate(
                    t.date_to,
                    SYNO.SDS.DateTimeUtils.GetDateFormat()
                );
                e.setDate(e.getDate() + 1), (t.date_to = e / 1e3 - 1);
            }
            e.forEach((e) => {
                s.baseParams[e] = t[e];
            }),
                i.loadData();
        }
        i.searchField.searchPanel.hide();
    },
    onActive: function () {
        if (this.loaded) return;
        this.loadData();
    },
    enableButtonCheck: function () {
        this.addonsStore.getTotalCount()
            ? (this.saveButton.enable())
            : (this.saveButton.disable());
    },
    loadData: function () {
        const e = this.addonsStore;
        const t = { offset: 0, limit: this.itemsPerPage };
        e.load({ params: t });
        this.enableButtonCheck();
        this.loaded = true;
    },
    loadException: function () {
        this.appWin.clearStatusBusy(), this.setMask(!0);
    },
    onBeforeStoreLoad: function (e, t) {
        this.appWin.setStatusBusy();
    },
    onAfterStoreLoad: function (e, t, i) {
        const s = this;
        s.appWin.clearStatusBusy(),
            t.length < 1 ? s.setMask(!0) : s.setMask(!1),
            s.setPagingToolbar(e, s.paging),
            this.enableButtonCheck();
    },
    setMask: function (e) {
        SYNOCOMMUNITY.RRManager.SetEmptyIcon(this, e);
    },
    setPagingToolbar: function (e, t) {
        this.setPagingToolbarVisible(t, e.getTotalCount() > this.itemsPerPage);
    },
    setPagingToolbarVisible: function (e, t) {
        e.setButtonsVisible(!0);
    },
    updateFbarItems: function (e) {
        this.isVisible();
    },
    showMsg: function (msg) {
        this.owner.getMsgBox().alert("title", msg);
    },
    onClearLogDone: function (e, t, i, s) {
        e
            ? this.loadData()
            : this.appWin
                .getMsgBox()
                .alert(
                    this.appWin.title,
                    "error_system"
                ),
            this.appWin.clearStatusBusy();
    },
    onAddonsSave: function (e) {
        var installedAddons = this.addonsStore.getRange().filter(x => { return x.data.installed == true }).map((x) => { return x.id });
        var newAddons = {};
        installedAddons.forEach((x) => {
            newAddons[x] = '';
        });
        var rrConfigJson = localStorage.getItem("rrConfig");
        var rrConfig = JSON.parse(rrConfigJson);
        rrConfig.user_config.addons = newAddons;
        this.appWin.setStatusBusy();
        this.appWin.handleFileUpload(rrConfig.user_config);
    },
    onLogClear: function () {
    },
    onExportCSV: function () {
        this.onLogSave("csv");
    },
    onExportHtml: function () {
        this.onLogSave("html");
    },
    onLogSave: function (e) {
    },
    saveLog: function (e) {
    },
    destroy: function () {
        this.rowNav && (Ext.destroy(this.rowNav), (this.rowNav = null)),
            this.searchField && this.searchField.fireEvent("destroy"),
            this.callParent([this]);
    },
});

SYNOCOMMUNITY.RRManager.SetEmptyIcon = (e, t) => {
    let i = e.el.child(".contentwrapper");
    if (i) {
        for (; i.child(".contentwrapper");)
            i = i.child(".contentwrapper");
        t && !i.hasClass("san-is-empty") ? i.addClass("san-is-empty") : !t && i.hasClass("san-is-empty") && i.removeClass("san-is-empty")
    }
};

Ext.define("SYNOCOMMUNITY.RRManager.AdvancedSearchField", {
    extend: "SYNO.ux.SearchField",
    initEvents: function () {
        this.callParent(arguments),
            this.mon(Ext.getDoc(), "mousedown", this.onMouseDown, this),
            this.mon(this, "keypress", (function (e, t) {
                t.getKey() === Ext.EventObject.ENTER && (this.searchPanel?.setKeyWord(this.getValue()),
                    this.searchPanel?.onSearch())
            }
            ), this),
            this.mon(this, "destroy", (function () {
                this.searchPanel?.destroy()
            }
            ), this)
    },
    isInnerComponent: function (event, form) {
        let isInside = false;
        if (event.getTarget(".syno-datetimepicker-inner-menu")) {
            isInside = true;
        }
        form.items.each((item) => {
            if (item instanceof Ext.form.ComboBox) {
                if (item.view && event.within(item.view.getEl())) {
                    isInside = true;
                    return false;
                }
            } else if (item instanceof Ext.form.DateField) {
                if (item.menu && event.within(item.menu.getEl())) {
                    isInside = true;
                    return false;
                }
            } else if (item instanceof Ext.form.CompositeField && this.isComponentInside(event, item)) {
                isInside = true;
                return false;
            }
        }, this);
        return isInside;

    },
    onMouseDown: function (e) {
        const t = this.searchPanel;
        !t || !t.isVisible() || t.inEl || e.within(t.getEl()) || e.within(this.searchtrigger) || this.isInnerComponent(e, this.searchPanel.getForm()) || t.hide()
    },
    onSearchTriggerClick: function () {
        this.searchPanel.isVisible() ? this.searchPanel.hide() : (this.searchPanel.getEl().alignTo(this.wrap, "tr-br?", [6, 0]),
            this.searchPanel.show(),
            this.searchPanel.setKeyWord(this.getValue()))
    },
    onTriggerClick: function () {
        this.callParent(),
            this.searchPanel.onReset()
    }
});

//Settings tab
Ext.define("SYNOCOMMUNITY.RRManager.Setting.Main", {
    extend: "SYNO.SDS.Utils.TabPanel",
    API: {},// SYNO.SDS.iSCSI.Utils.API,
    constructor: function (e) {
        (this.appWin = e.appWin),
            (this.owner = e.owner),
            this.callParent([this.fillConfig(e)]);
    },
    fillConfig: function (e) {
        this.generalTab = new SYNOCOMMUNITY.RRManager.Setting.GeneralTab({
            appWin: this.appWin,
            owner: this,
            itemId: "GeneralTab",
        });

        this.rrConfigTab = new SYNOCOMMUNITY.RRManager.Setting.RRConfigTab({
            appWin: this.appWin,
            owner: this,
            itemId: "RRConfigTab",
        });

        this.synoInfoTab = new SYNOCOMMUNITY.RRManager.Setting.SynoInfoTab({
            appWin: this.appWin,
            owner: this,
            itemId: "SynoInfoTab",
        });

        const tabs = [this.generalTab, this.rrConfigTab, this.synoInfoTab];

        const settingsConfig = {
            title: "Settings",
            autoScroll: true,
            useDefaultBtn: true,
            labelWidth: 200,
            fieldWidth: 240,
            activeTab: 0,
            deferredRender: false,
            items: tabs,
            listeners: {
                activate: this.updateAllForm,
                scope: this
            },
        };

        return Ext.apply(settingsConfig, e);
    },
    loadAllForms: function (e) {
        this.items.each((t) => {
            if (Ext.isFunction(t.loadForm)) {
                if (t.itemId == "SynoInfoTab") {
                    t.loadForm(e.synoinfo);
                } else {
                    t.loadForm(e);
                }
            }
        });
    },
    updateEnv: function (e) {
    },
    updateAllForm: async function () {
        this.setStatusBusy();
        try {
            const e = await this.getConf();
            this.loadAllForms(e), this.updateEnv(e);
        } catch (e) {
            SYNO.Debug(e);
        }
        this.clearStatusBusy();
    },
    applyHandler: function () {
        this.confirmApply() && this.doApply().catch(() => { });
    },
    doApply: async function () {
        this.setStatusBusy();
        try {
            (async () => {
                await this.setConf();
                await this.updateAllForm();
                await this.appWin.runScheduledTask('ApplyRRConfig');
                this.clearStatusBusy();
                this.setStatusOK();
            })();
        } catch (e) {
            SYNO.Debug(e);
            this.clearStatusBusy();
            this.appWin.getMsgBox().alert(this.title, this.API.getErrorString(e));
            throw e;
        }
    },
    getParams: function () {
        const generalTab = this.generalTab.getForm().getValues();
        const rrConfigTab = this.rrConfigTab.getForm().getValues();

        const synoInfoTab = this.synoInfoTab.getForm().getValues();
        const synoInfoTabFixed = {
            synoinfo: synoInfoTab
        };

        var rrConfigJson = localStorage.getItem("rrConfig");
        var rrConfig = JSON.parse(rrConfigJson);
        return Object.assign(rrConfig?.user_config, generalTab, rrConfigTab, synoInfoTabFixed);
    },
    getConf: function () {
        var rrConfigJson = localStorage.getItem("rrConfig");
        var rrConfig = JSON.parse(rrConfigJson);

        return rrConfig?.user_config;
    },
    setConf: function () {
        var user_config = this.getParams();
        var rrConfigJson = localStorage.getItem("rrConfig");
        var rrConfigOrig = JSON.parse(rrConfigJson);
        rrConfigOrig.user_config = user_config;
        localStorage.setItem("rrConfig", JSON.stringify(rrConfigOrig));

        return this.appWin.handleFileUpload(user_config);
    },
    confirmApply: function () {
        if (!this.isAnyFormDirty())
            return (
                this.setStatusError({
                    text: this._V("ui", "frm_validation_no_change"),
                    clear: !0,
                }),
                !1
            );
        const e = this.getAllForms().find((e) => !e.isValid());
        return (
            !e ||
            (this.setActiveTab(e.itemId),
                this.setStatusError({
                    text: this._V("ui", "frm_validation_fill_required_fields"),
                }),
                !1)
        );
    },
    onPageConfirmLostChangeSave: function () {
        return this.confirmApply() ? this.doApply() : Promise.reject();
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.Setting.GeneralTab", {
    extend: "SYNO.SDS.Utils.FormPanel",
    constructor: function (e) {
        this.callParent([this.fillConfig(e)])
    },
    fillConfig: function (e) {
        this.suspendLcwPrompt = !1;
        const t = {
            title: "General",
            items: [{
                xtype: "syno_fieldset",
                title: "Device Info",
                itemId: "lcw",
                name: "lcw",
                id: "lcw",
                items: [
                    {
                        fieldLabel: 'model',
                        name: 'model',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'productver',
                        name: 'productver',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'buildnum',
                        name: 'buildnum',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'sn',
                        name: 'sn',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    },
                ]
            },
            new SYNO.ux.FieldSet({
                title: 'Network Info',
                collapsible: true,
                columns: 2,
                items: [
                    {
                        fieldLabel: 'mac1',
                        name: 'mac1',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'mac2',
                        name: 'mac2',
                        allowBlank: true,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'mac3',
                        name: 'mac3',
                        allowBlank: true,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'mac4',
                        name: 'mac4',
                        allowBlank: true,
                        xtype: 'syno_textfield',
                    }
                ],
            }),
            new SYNO.ux.FieldSet({
                title: 'Boot Config',
                collapsible: true,
                items: [{
                    fieldLabel: 'vid',
                    name: 'vid',
                    allowBlank: false,
                    xtype: 'syno_textfield',
                }, {
                    fieldLabel: 'pid',
                    name: 'pid',
                    allowBlank: false,
                    xtype: 'syno_textfield',
                }, {
                    boxLabel: 'emmcboot',
                    name: 'emmcboot',
                    xtype: 'syno_checkbox',

                },
                ]
            })
            ]
        };
        return Ext.apply(t, e),
            t
    },
    initEvents: function () {
        this.mon(this, "activate", this.onActivate, this)
    },
    onActivate: function () {
    },
    loadForm: function (e) {
        this.getForm().setValues(e);
    },
    promptLcwDialog: function (e, t) {
        t && !this.suspendLcwPrompt && this.appWin.getMsgBox().show({
            title: this.title,
            msg: "ddd",
            buttons: {
                yes: {
                    text: Ext.MessageBox.buttonText.yes,
                    btnStyle: "red"
                },
                no: {
                    text: Ext.MessageBox.buttonText.no
                }
            },
            fn: function (e) {
                "yes" !== e && this.form.findField("lcw_enabled").setValue(!1)
            },
            scope: this,
            icon: Ext.MessageBox.ERRORRED,
            minWidth: Ext.MessageBox.minWidth
        })
    }
});

Ext.define("SYNOCOMMUNITY.RRManager.Setting.RRConfigTab", {
    extend: "SYNO.SDS.Utils.FormPanel",
    constructor: function (e) {
        this.callParent([this.fillConfig(e)])
    },
    fillConfig: function (e) {
        this.suspendLcwPrompt = !1;
        const t = {
            title: "RR Config",
            items: [
                new SYNO.ux.FieldSet({
                    title: 'RR Config',
                    collapsible: true,
                    items: [{
                        fieldLabel: 'lkm',
                        name: 'lkm',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'kernel',
                        name: 'kernel',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        boxLabel: 'dsmlogo',
                        name: 'dsmlogo',
                        xtype: 'syno_checkbox',

                    }, {
                        boxLabel: 'directboot',
                        name: 'directboot',
                        xtype: 'syno_checkbox',
                    }, {
                        boxLabel: 'prerelease',
                        name: 'prerelease',
                        xtype: 'syno_checkbox',
                    }, {
                        fieldLabel: 'bootwait',
                        name: 'bootwait',
                        xtype: 'syno_numberfield',
                    }, {
                        fieldLabel: 'bootipwait',
                        name: 'bootipwait',
                        xtype: 'syno_numberfield',
                    }, {
                        fieldLabel: 'kernelway',
                        name: 'kernelway',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'kernelpanic',
                        name: 'kernelpanic',
                        allowBlank: false,
                        xtype: 'syno_numberfield',
                    }, {
                        boxLabel: 'odp',
                        name: 'odp',
                        xtype: 'syno_checkbox',
                    }, {
                        boxLabel: 'hddsort',
                        name: 'hddsort',
                        xtype: 'syno_checkbox',
                    }, {
                        fieldLabel: 'smallnum',
                        name: 'smallnum',
                        allowBlank: false,
                        xtype: 'syno_numberfield',
                    }, {
                        fieldLabel: 'paturl',
                        name: 'paturl',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'patsum',
                        name: 'patsum',
                        allowBlank: false,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'layout',
                        name: 'layout',
                        allowBlank: true,
                        xtype: 'syno_textfield',
                    }, {
                        fieldLabel: 'keymap',
                        name: 'keymap',
                        allowBlank: true,
                        xtype: 'syno_textfield',
                    }
                    ]
                })
            ]
        };
        return Ext.apply(t, e),
            t
    },
    initEvents: function () {
        this.mon(this, "activate", this.onActivate, this)
    },
    onActivate: function () {
    },
    loadForm: function (e) {
        this.getForm().setValues(e);
    },
    promptLcwDialog: function (e, t) {
        t && !this.suspendLcwPrompt && this.appWin.getMsgBox().show({
            title: this.title,
            msg: "ddd",
            buttons: {
                yes: {
                    text: Ext.MessageBox.buttonText.yes,
                    btnStyle: "red"
                },
                no: {
                    text: Ext.MessageBox.buttonText.no
                }
            },
            fn: function (e) {
                "yes" !== e && this.form.findField("lcw_enabled").setValue(!1)
            },
            scope: this,
            icon: Ext.MessageBox.ERRORRED,
            minWidth: Ext.MessageBox.minWidth
        })
    }
});

Ext.define("SYNOCOMMUNITY.RRManager.Setting.SynoInfoTab", {
    extend: "SYNO.SDS.Utils.FormPanel",
    constructor: function (e) {
        this.callParent([this.fillConfig(e)])
    },
    fillConfig: function (e) {
        this.suspendLcwPrompt = !1;
        const t = {
            title: "Syno Info",
            items: [
                new SYNO.ux.FieldSet({
                    title: 'SynoInfo Config',
                    collapsible: true,
                    name: 'synoinfo',
                    items: [
                        {
                            boxLabel: 'Support Disk compatibility',
                            name: 'support_disk_compatibility',
                            xtype: 'syno_checkbox',

                        }, {
                            boxLabel: 'Support Memory compatibility',
                            name: 'support_memory_compatibility',
                            xtype: 'syno_checkbox',

                        }, {
                            boxLabel: 'Support Led brightness adjustment',
                            name: 'support_led_brightness_adjustment',
                            xtype: 'syno_checkbox',

                        }, {
                            boxLabel: 'Support leds lp3943',
                            name: 'support_leds_lp3943',
                            xtype: 'syno_checkbox',

                        }, {
                            boxLabel: 'Support syno hybrid RAID',
                            name: 'support_syno_hybrid_raid',
                            xtype: 'syno_checkbox',

                        }, {
                            boxLabel: 'Support RAID group',
                            name: 'supportraidgroup',
                            xtype: 'syno_checkbox',

                        }, {
                            fieldLabel: 'Max LAN port',
                            name: 'maxlanport',
                            allowBlank: false,
                            xtype: 'syno_numberfield',
                        }, {
                            fieldLabel: 'Netif seq',
                            name: 'netif_seq',
                            allowBlank: false,
                            xtype: 'syno_textfield',
                        }, {
                            fieldLabel: 'Buzzer offen',
                            name: 'buzzeroffen',
                            allowBlank: true,
                            xtype: 'syno_textfield',
                        }
                    ]
                })
            ]
        };
        return Ext.apply(t, e),
            t
    },
    initEvents: function () {
        this.mon(this, "activate", this.onActivate, this)
    },
    onActivate: function () {
    },
    loadForm: function (e) {
        this.getForm().setValues(e);
    },
    promptLcwDialog: function (e, t) {
        t && !this.suspendLcwPrompt && this.appWin.getMsgBox().show({
            title: this.title,
            msg: "ddd",
            buttons: {
                yes: {
                    text: Ext.MessageBox.buttonText.yes,
                    btnStyle: "red"
                },
                no: {
                    text: Ext.MessageBox.buttonText.no
                }
            },
            fn: function (e) {
                "yes" !== e && this.form.findField("lcw_enabled").setValue(!1)
            },
            scope: this,
            icon: Ext.MessageBox.ERRORRED,
            minWidth: Ext.MessageBox.minWidth
        })
    }
});


//Settings tab
Ext.define("SYNOCOMMUNITY.RRManager.Debug.Main", {
    extend: "SYNO.SDS.Utils.TabPanel",
    API: {},
    constructor: function (e) {
        (this.appWin = e.appWin),
            (this.owner = e.owner),
            this.callParent([this.fillConfig(e)]);
    },
    _prefix: '/webman/3rdparty/rr-manager/',
    callCustomScript: function (scriptName) {

        return new Promise((resolve, reject) => {
            Ext.Ajax.request({
                url: `${this._prefix}${scriptName}`,
                method: 'GET',
                timeout: 60000,
                headers: {
                    'Content-Type': 'text/html'
                },
                success: function (response) {
                    // if response text is string need to decode it
                    if (typeof response?.responseText === 'string') {
                        resolve(Ext.decode(response?.responseText));
                    } else {
                        resolve(response?.responseText);
                    }
                },
                failure: function (result) {
                    if (typeof result?.responseText === 'string' && result?.responseText && !result?.responseText.startsWith('<')) {
                        var response = Ext.decode(result?.responseText);
                        reject(response?.error);
                    }
                    else {
                        reject('Failed with status: ' + result?.status);
                    }
                }
            });
        });
    },
    fillConfig: function (e) {
        this.generalTab = new SYNOCOMMUNITY.RRManager.Debug.GeneralTab({
            appWin: this.appWin,
            owner: this,
            itemId: "GeneralTab",
        });

        const tabs = [this.generalTab];

        const settingsConfig = {
            title: "Settings",
            autoScroll: true,
            useDefaultBtn: true,
            labelWidth: 200,
            fieldWidth: 240,
            activeTab: 0,
            deferredRender: false,
            items: tabs,
            listeners: {
                activate: this.updateAllForm,
                scope: this
            },
        };

        return Ext.apply(settingsConfig, e);
    },
    loadAllForms: function (e) {
        this.items.each((t) => {
            if (Ext.isFunction(t.loadForm)) {
                if (t.itemId == "SynoInfoTab") {
                    t.loadForm(e.synoinfo);
                } else {
                    t.loadForm(e);
                }
            }
        });
    },
    updateEnv: function (e) {
    },
    updateAllForm: async function () {
        this.setStatusBusy();
        try {
            const e = await this.getConf();
            this.loadAllForms(e), this.updateEnv(e);
        } catch (e) {
            SYNO.Debug(e);
        }
        this.clearStatusBusy();
    },
    getConf: function () {
        return this.callCustomScript('getNetworkInfo.cgi')
    },
    setConf: function () {
        var user_config = this.getParams();
        var rrConfigJson = localStorage.getItem("rrConfig");
        var rrConfigOrig = JSON.parse(rrConfigJson);
        rrConfigOrig.user_config = user_config;
        localStorage.setItem("rrConfig", JSON.stringify(rrConfigOrig));

        return this.appWin.handleFileUpload(user_config);
    }
});

Ext.define("SYNOCOMMUNITY.RRManager.Debug.GeneralTab", {
    extend: "SYNO.SDS.Utils.FormPanel",
    constructor: function (e) {
        this.getConf = e.owner.getConf.bind(e.owner);
        this.callParent([this.fillConfig(e)])
    },
    fillConfig: function (e) {
        this.suspendLcwPrompt = !1;
        const t = {
            title: "General",
            name: 'debugGeneral',
            id: 'debugGeneral',
            items: [new SYNO.ux.FieldSet({
                title: 'CMD Line',
                collapsible: true,
                collapsed: false,
                name: 'cmdLine',
                id: 'cmdLine',
                columns: 2,
                items: [],
            }), new SYNO.ux.FieldSet({
                title: 'Ethernet Interfaces',
                collapsible: true,
                name: 'ethernetInterfaces',
                id: 'ethernetInterfaces',
                columns: 2,
                items: [],
            }), new SYNO.ux.FieldSet({
                title: 'Syno Mac Addresses',
                collapsible: true,
                name: 'macAdresses',
                id: 'macAdresses',
                columns: 2,
                items: [],
            })
            ]
        };
        return Ext.apply(t, e),
            t
    },
    initEvents: function () {
        this.mon(this, "activate", this.onActivate, this)
    },
    onActivate: function () {
        self = this;
        if (self.loaded) return;
        this.getConf().then((e) => {
            var config = e.result;
            var cmdLineFieldSet = Ext.getCmp('cmdLine');
            Object.keys(config.bootParameters).forEach((key) => {
                cmdLineFieldSet.add(
                    {
                        fieldLabel: key,
                        name: key,
                        xtype: 'syno_displayfield',
                        value: config.bootParameters[key]
                    });
            });
            cmdLineFieldSet.doLayout();

            var ethernetInterfacesFieldSet = Ext.getCmp('ethernetInterfaces');
            config.ethernetInterfaces.forEach((eth) => {
                ethernetInterfacesFieldSet.add(
                    {
                        fieldLabel: eth.interface,
                        name: eth.interface,
                        xtype: 'syno_displayfield',
                        value: `MAC: ${eth.address}, Status: ${eth.operstate}, Speed: ${eth.speed}, Duplex: ${eth.duplex}`
                    });
            });
            ethernetInterfacesFieldSet.doLayout();

            var macAdressesFieldSet = Ext.getCmp('macAdresses');
            config.syno_mac_addresses.forEach((mac_address, index) => {
                macAdressesFieldSet.add(
                    {
                        fieldLabel: `Mac ${index}`,
                        columns: 2,
                        xtype: 'syno_displayfield',
                        value: mac_address
                    });
            });

            var debugGeneral = Ext.getCmp('debugGeneral');
            debugGeneral.doLayout();
            self.loaded = true;
        });
    },
    loadForm: function (e) {
        // this.getForm().setValues(e);
    }
});

SYNOCOMMUNITY.RRManager.UpdateWizard.Helper = {
    T: function (a, b) {
        return _T(a, b);
    },
    maskLoading: function (a) {
        a.getEl().mask(this.T("common", "loading"), "x-mask-loading");
    },
    unmask: function (a) {
        a.getEl().unmask();
    },
    mask: function (b, a) {
        b.getEl().mask(a, "x-mask-loading");
    },
    diskSizeRenderer: function (a) {
        return Ext.util.Format.fileSize(a);
    },
    tryUnmaskAndReload: function (a, b, c) {
        this.unmask(a);
        b.reload();
        c();
    },
    getError: function (a) {
        return _T("error", a);
    },
};

Ext.define("SYNOCOMMUNITY.RRManager.UpdateWizard.Utils.Wizard", {
    extend: "SYNO.SDS.Wizard.ModalWindow",
    constructor: function (a) {
        this.callParent([Ext.apply({ width: 700, height: 500 }, a)]);
        this.setAllStepSize();
    },
    getValues: function () {
        return this.getAllSteps().reduce(function (b, a) {
            if (Ext.isFunction(a.getValues)) {
                b[a.itemId] = a.getValues();
            }
            return b;
        }, {});
    },
    getSummary: function () {
        return this.getAllSteps().reduce(function (b, a) {
            if (Ext.isFunction(a.getSummary)) {
                b[a.itemId] = a.getSummary();
            }
            return b;
        }, {});
    },
    fireEventToAllSteps: function (b, a) {
        this.getAllSteps().forEach(function (c) {
            c.fireEvent(b, a);
        });
    },
    setAllStepSize: function () {
        this.getAllSteps().forEach(function (a) {
            a.setHeight(Math.max(this.height - 155, 155));
            a.setWidth(Math.max(this.width - 80, 80));
            a.doLayout();
        }, this);
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.UpdateWizard.Utils.Step", {
    extend: "SYNO.SDS.Wizard.Step",
    autoHideBanner: false,
    constructor: function (a) {
        if (!a.layout) {
            a.layout = { type: "vbox", align: "stretch" };
        }
        if (!a.height) {
            a.height = 330;
        }
        this.callParent([a]);
    },
    hideBanner: function () {
        if (this.owner.banner) {
            this.owner.getComponent("banner").hide();
            this.owner.doLayout();
        }
    },
    showBanner: function () {
        if (this.owner.banner) {
            this.owner.getComponent("banner").show();
            this.owner.doLayout();
        }
    },
    validate: function () {
        return true;
    },
    getValues: Ext.emptyFn,
    getNext: function () {
        debugger
        if (Ext.isFunction(this.validate) && this.validate() !== true) {
            return false;
        }
        this.formPanel.submit();
       // return this.callParent(arguments);
    },
    activate: function () {
        if (this.autoHideBanner) {
            this.hideBanner();
        }
        this.fireEvent("activate");
    },
    deactivate: function () {
        if (this.autoHideBanner) {
            this.showBanner();
        }
        this.fireEvent("deactivate");
    },
    stepWebapiWithMask: function (c) {
        var a = c.scope || this;
        var b = c.callback ? c.callback.bind(a) : null;
        SYNO.SDS.Virtualization.Utils.Helper.maskLoading(this.owner);
        this.sendWebAPI(
            Ext.apply(c, {
                callback: function (g, e, f, d) {
                    SYNO.SDS.Virtualization.Utils.Helper.unmask(this.owner);
                    if (b) {
                        b(g, e, f, d);
                    }
                }.bind(this),
            })
        );
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.UpdateWizard.NewImagePanel", {
    extend: "SYNO.SDS.Utils.FormPanel",
    uploadTimeout: 86400000,
    helper: SYNOCOMMUNITY.RRManager.UpdateWizard.Helper,
    exts: {
        zip: [".zip"],
    },
    constructor: function (a) {
        this.callParent([this.fillConfig(a)]);
    },
    fillConfig: function (a) {
        this.store = this.createStore();
        this.imageType = a.imageType;
        this.existNameList = this.createExistNameList(a.records);
        this.gridPanel = this.createGridPanel(a);
        this.tbar = this.createTBar(a);
        var b = {
            cls: "image-new-image-panel",
            tbar: this.tbar,
            labelWidth: 204,
            labelPad: 20,
            fileUpload: true,
            trackResetOnLoad: true,
            layout: "fit",
            items: [this.gridPanel],
        };
        Ext.apply(b, a);
        return b;
    },
    createTBar: function (a) {
        return new SYNO.ux.Toolbar({
            items: [
                {
                    xtype: "syno_filebutton",
                    buttonOnly: true,
                    itemId: "btn_from_PC",
                    id: (this.form_pc_id = Ext.id()),
                    buttonText: this.helper.T("ui", "from_pc"),
                    listeners: {
                        scope: this,
                        afterrender: function (b) {
                            b.el.set({
                                accept: this.getFileExtsByImageType().toString(),
                                multiple: true,
                            });
                            this.mon(b.el, "change", this.onFromPC, this);
                        },
                    },
                },
                {
                    xtype: "syno_button",
                    itemId: "btn_from_DS",
                    id: (this.form_ds_id = Ext.id()),
                    text: this.helper.T("ui", "from_ds"),
                    handler: this.onFromDS,
                    scope: this,
                },
                // {
                //     xtype: "syno_button",
                //     itemId: "btn_download_vdsm",
                //     id: (this.download_vdsm_id = Ext.id()),
                //     text: this.helper.T("image", "download_syno_vdsm"),
                //     hidden: "vdsm" !== a.imageType,
                //     scope: this,
                //     handler: this.onDownloadVDSM,
                // },
            ],
        });
    },
    createStore: function () {
        var a = [
            { name: "name" },
            { name: "path" },
            { name: "get_patch_by" },
            { name: "action" },
            { name: "input_elm" },
            { name: "real_path" },
            { name: "file_size" },
            { name: "file" },
        ];
        return new Ext.data.JsonStore({
            autoDestroy: true,
            idProperty: "name",
            root: "",
            fields: a,
        });
    },
    createGridPanel: function (a) {
        this.nameTextField = new SYNO.ux.TextField({
            name: "name",
            allowBlank: false,
            itemId: "name_field",
            maxlength: 127,
            vtype: "taskname",
            selectOnFocus: true,
            listeners: {
                scope: this,
                focus: function () {
                    var b = this.gridPanel
                        .getView()
                        .getCell(this.nameTextField.gridEditor.row, 0);
                    var c = b.itip;
                    if (!c) {
                        this.nameTextField.clearInvalid();
                    } else {
                        this.nameTextField.markInvalid(c);
                    }
                },
            },
        });
        return new SYNO.ux.EditorGridPanel({
            cls: "vm-textfield-grid",
            store: this.store,
            flex: 1,
            clicksToEdit: 1,
            enableHdMenu: false,
            enableColumnMove: false,
            colModel: new Ext.grid.ColumnModel({
                defaults: { menuDisabled: true },
                columns: [
                    {
                        header: this.helper.T("ui", "image_name"),
                        dataIndex: "name",
                        align: "left",
                        editor: this.nameTextField,
                    },
                    {
                        header: this.helper.T("common", "file"),
                        dataIndex: "real_path",
                        renderer: this.helper.toolTipRenderer,
                    },
                    {
                        header: this.helper.T("common", "size"),
                        dataIndex: "file_size",
                        renderer: function (b) {
                            if (0 >= b) {
                                return "-";
                            }
                            return this.helper.diskSizeRenderer(b);
                        }.createDelegate(this),
                    },
                    {
                        xtype: "actioncolumn",
                        header: this.helper.T("common", "action"),
                        dataIndex: "action",
                        scope: this,
                        items: [
                            {
                                iconCls: "vm-fileupload-delete-icon",
                                handler: function (d, e, c) {
                                    var b = this.store.getAt(e).get("input_elm");
                                    this.store.removeAt(e);
                                    if (Ext.isObject(b)) {
                                        Ext.removeNode(Ext.getDom(b));
                                    }
                                    this.nameValidate();
                                }.createDelegate(this),
                            },
                        ],
                        width: 40,
                        align: "center",
                    },
                ],
            }),
            listeners: {
                scope: this,
                afteredit: function (b) {
                    this.nameValidate();
                },
            },
        });
    },
    createExistNameList: function (b) {
        var c = [];
        var a = b.snapshot || b.data;
        a.items.forEach(function (d) {
            c.push(d.get("name"));
        });
        return c;
    },
    getFileExtsByImageType: function () {
        return this.exts[this.imageType];
    },
    getValues: function () {
        var a = [];
        for (var b = 0; b < this.store.getCount(); b++) {
            var c = this.store.getAt(b);
            a.push({
                get_patch_by: c.get("get_patch_by"),
                name: c.get("name"),
                path: c.get("path"),
                file: c.get("file"),
                file_size: c.get("file_size"),
            });
        }
        return a;
    },
    addStore: function (a) {
        this.store.add(new Ext.data.Record(a));
        this.nameValidate();
    },
    isUniqueExistName: function (a) {
        if (-1 !== this.existNameList.indexOf(a)) {
            return false;
        }
        return true;
    },
    isUniqueNewName: function (a, c) {
        for (var b = 0; b < this.store.getCount(); b++) {
            if (b === c) {
                continue;
            }
            if (a === this.store.getAt(b).get("name")) {
                return false;
            }
        }
        return true;
    },
    nameValidate: function () {
        var isValid = true;
        var errorMessage;
        for (var index = 0; index < this.store.getCount(); index++) {
            var record = this.store.getAt(index);
            var cell = this.gridPanel.getView().getCell(index, 0);
            var invalidCharactersRegex = /([\\\{\}\|\^\[\]\?\=\:\+\/\*\(\)\$\!"#%&',;<>@`~])/;
            if (null !== record.get("name").match(invalidCharactersRegex)) {
                errorMessage = this.helper.T("error", "invalid_name");
            } else {
                if (!this.isUniqueExistName(record.get("name")) || !this.isUniqueNewName(record.get("name"), index)) {
                    errorMessage = this.helper.T("error", "name_conflict");
                }
            }
            var cellFirstChild = Ext.get(Ext.getDom(cell).firstChild);
            cellFirstChild.removeClass("validCell");
            cellFirstChild.removeClass("invalidCell");
            if (errorMessage) {
                cellFirstChild.addClass("invalidCell");
                Ext.getDom(cell).setAttribute("ext:anchor", "top");
                Ext.getDom(cell).itip = errorMessage;
                isValid = false;
            } else {
                cellFirstChild.addClass("validCell");
                Ext.getDom(cell).itip = "";
            }
            errorMessage = "";
        }
        return isValid;
    },
    onDownloadVDSM: function () {
        // var a = new SYNOCOMMUNITY.RRManager.Image.DownloadVDSMWindow({
        //     parent: this,
        //     owner: this.appWin,
        // });
        // a.open();
    },
    onFromPC: function (b, d, c) {
        var a = b.target.files;
        Ext.each(
            a,
            function (f) {
                var e = {
                    input_elm: d,
                    name: f.name.substring(0, f.name.lastIndexOf(".")),
                    path: f.name,
                    real_path: f.name,
                    get_patch_by: "upload",
                    file_size: f.size,
                    file: f,
                };
                if (!this.preCheck(e)) {
                    return true;
                }
                this.addStore(e);
            },
            this
        );
        this.getTopToolbar().getComponent("btn_from_PC").reset();
    },
    onFromDS: function () {
        if (!Ext.isDefined(this.dialog)) {
            var a = this.getFileExtsByImageType().toString().replace(/\./g, "");
            this.dialog = new SYNO.SDS.Utils.FileChooser.Chooser({
                parent: this,
                owner: this.appWin,
                closeOwnerWhenNoShare: true,
                closeOwnerNumber: 0,
                enumRecycle: true,
                superuser: true,
                usage: { type: "open", multiple: true },
                title: this.helper.T("vm", "import_vm_from_ds"),
                folderToolbar: true,
                getFilterPattern: function () {
                    return a;
                },
                treeFilter: this.helper.VMMDSChooserTreeFilter,
                listeners: {
                    scope: this,
                    choose: function (d, b, c) {
                        b.records.forEach(function (f) {
                            var e = {
                                name: f
                                    .get("path")
                                    .substring(
                                        f.get("path").lastIndexOf("/") + 1,
                                        f.get("path").lastIndexOf(".")
                                    ),
                                path: f.get("path"),
                                real_path: _S("hostname") + f.get("path"),
                                get_patch_by: "from_ds",
                                file_size: f.get("filesize"),
                            };
                            if (!this.preCheck(e)) {
                                return true;
                            }
                            this.addStore(e);
                        }, this);
                        this.dialog.close();
                    },
                    close: function () {
                        delete this.dialog;
                    },
                },
            });
        }
        this.dialog.show();
    },
    preCheck: function (a) {
        var b = a.path.substring(a.path.lastIndexOf("."));
        if (-1 === this.getFileExtsByImageType().indexOf(b)) {
            return false;
        }
        return true;
    },
    getNext: function () {
        return this.isValid();
    },
    isValid: function () {
        var c = true;
        var a = this.getValues();
        if (!this.nameValidate()) {
            this.appWin
                .getMsgBox()
                .alert(
                    this.helper.T("app", "displayname"),
                    this.helper.T("error", "invalid_name")
                );
            return false;
        }
        if (0 === a.length) {
            this.appWin
                .getMsgBox()
                .alert(
                    this.helper.T("app", "displayname"),
                    this.helper.T("error", "error_nochoosefile")
                );
            return false;
        }
        var d = { zip: this.exts.zip };
        var b = {
            zip: [".zip"],
        };
        a.forEach(function (i) {
            if ("upload" === i.get_patch_by || "from_ds" === i.get_patch_by) {
                var e = i.path.substr(i.path.lastIndexOf("."));
                var g = d.hasOwnProperty(this.imageType) ? d[this.imageType] : [];
                var h = b.hasOwnProperty(this.imageType)
                    ? b[this.imageType]
                    : Object.values(b).reduce(function (k, j) {
                        return k.concat(j);
                    }, []);
                var f = false;
                g.forEach(function (j) {
                    if (e === j) {
                        f = true;
                    }
                });
                if (f === false) {
                    this.appWin
                        .getMsgBox()
                        .alert(
                            this.helper.T("app", "displayname"),
                            String.format(
                                this.helper.T("error", "image_filename_bad_ext"),
                                h.join(", ")
                            )
                        );
                    c = false;
                    return false;
                }
            }
        }, this);
        return c;
    },
    doCreate: function (a) {
        // this.sendWebAPI({
        //     api: "SYNO.Virtualization.Guest.Image",
        //     method: "create",
        //     version: 2,
        //     params: a,
        //     scope: this,
        //     callback: function (c, b) {
        //         if (!c) {
        //             this.owner.owner
        //                 .getMsgBox()
        //                 .alert("alert", this.helper.getError(b.code));
        //         }
        //         this.nonUploadTaskNum--;
        //         this.checkAllTaskDone();
        //     },
        // });
    },
    doUploadAndCreate: function (c, a) {
        var b = new FormData();
        b.append("file", a);
        // this.sendWebAPI({
        //     api: "SYNO.Virtualization.Guest.Image",
        //     method: "upload_and_create",
        //     version: 1,
        //     params: c,
        //     uploadData: b,
        //     html5upload: true,
        //     timeout: this.uploadTimeout,
        //     scope: this,
        //     callback: function (e, d) {
        //         if (!e) {
        //             this.owner.owner
        //                 .getMsgBox()
        //                 .alert("alert", this.helper.getError(d.code));
        //         }
        //         this.uploadTaskNum--;
        //         this.checkAllTaskDone();
        //     },
        // });
    },
    doImageCreate: function (b) {
        // this.uploadTaskNum = 0;
        // this.nonUploadTaskNum = 0;
        // var a = this.getValues();
        // this.waitingSendTaskNum = a.length;
        // this.uploadTaskNum = a.filter(function (c) {
        //     return "upload" === c.get_patch_by;
        // }).length;
        // this.nonUploadTaskNum = a.length - this.uploadTaskNum;
        // this.uploadErrorFile = [];
        // this.helper.maskLoading(this.appWin);
        // this.helper.maskLoading(this.pollingWindow.getActivateOverviewPanel());
        // a.forEach(function (c) {
        //     var d = {
        //         synovmm_ui_id: SYNO.SDS.Virtualization.Utils.GlobalVar.mainAppId,
        //         image_repos: JSON.stringify(b),
        //         type: this.imageType,
        //         get_patch_by: c.get_patch_by,
        //         name: c.name,
        //         ds_file_path: c.path,
        //     };
        //     if (d.get_patch_by !== "upload") {
        //         this.doCreate(d);
        //         this.waitingSendTaskNum--;
        //         this.checkAllTaskSend();
        //     } else {
        //         this.reader(d, c.file).then(
        //             function (e) {
        //                 this.doUploadAndCreate(e.params, e.file);
        //                 this.waitingSendTaskNum--;
        //                 this.checkAllTaskSend();
        //             }.bind(this),
        //             function (e) {
        //                 this.uploadErrorFile.push(e);
        //                 this.uploadTaskNum--;
        //                 this.waitingSendTaskNum--;
        //                 this.checkAllTaskSend();
        //             }.bind(this)
        //         );
        //     }
        // }, this);
    },
    checkAllTaskSend: function () {
        if (0 !== this.waitingSendTaskNum) {
            return;
        }
        if (0 !== this.uploadErrorFile.length) {
            this.owner.owner
                .getMsgBox()
                .alert(
                    "alert",
                    String.format(
                        this.helper.T("image", "upload_file_missing"),
                        this.uploadErrorFile.join(", ")
                    )
                );
        }
        this.helper.tryUnmaskAndReload(
            this,
            this.pollingWindow.getActivateOverviewPanel(),
            this.pollingWindow.pollingTask
        );
        this.helper.unmask(this.appWin);
        this.appWin.hide();
        this.checkAllTaskDone();
    },
    checkAllTaskDone: function () {
        if (0 === this.uploadTaskNum && 0 === this.nonUploadTaskNum) {
            this.appWin.close();
        }
    },
    reader: function (b, a) {
        return new Promise(function (f, e) {
            var d = a.slice(0, 4);
            if (0 >= d.size) {
                e(b.name);
                return;
            }
            var c = new FileReader();
            c.args = { params: b, file: a };
            c.addEventListener("load", function () {
                f(this.args);
            });
            c.addEventListener("error", function () {
                e(this.args.params.name);
            });
            c.readAsText(d);
        });
    },
    submit: function () {
        var c = this.getValues();
        var d = 0;
        var g = {};
        c.forEach(function (h) {
            d += h.file_size;
        });
        var b = this.appWin.getMsgBox();
        // var f = this.appWin.getValues().storage.image_hosts_and_repos;
        // var a = [];
        // for (var e = 0; e < f.length; e++) {
        //     if (-1 === a.indexOf(f[e].host_id)) {
        //         a.push(f[e].host_id);
        //     }
        // }
        g.file_size = JSON.stringify(d);
        // g.host_ids = a;
        this.helper.maskLoading(this.appWin);
        this.helper.unmask(this.appWin);
        this.doImageCreate();
        // this.sendWebAPI({
        //     api: "SYNO.Virtualization.Cluster",
        //     method: "check_multi_host_upload",
        //     version: 1,
        //     params: g,
        //     scope: this,
        //     callback: function (m, l) {
        //       
        //         if (!m) {
        //             b.alert("alert", this.helper.getError(l.code));
        //             return;
        //         }
        //         if (0 < l.unavailabe_hosts.length) {
        //             var k = "";
        //             for (e = 0; e < l.unavailabe_hosts.length; e++) {
        //                 k = k + "[" + l.unavailabe_hosts[e] + "]";
        //                 if (e !== l.unavailabe_hosts.length - 1) {
        //                     k += ",";
        //                 }
        //             }
        //             b.alert(
        //                 "alert",
        //                 String.format(
        //                     this.helper.T("error", "guest_image_upload_no_available_repo"),
        //                     k
        //                 )
        //             );
        //         }
        //         if (0 < l.availabe_host_ids.length) {
        //             var i = [];
        //             for (e = 0; e < l.availabe_host_ids.length; e++) {
        //                 for (var h = 0; h < f.length; h++) {
        //                     if (l.availabe_host_ids[e] === f[h].host_id) {
        //                         i.push(f[h].repo_id);
        //                     }
        //                 }
        //             }
        //             this.doImageCreate(i);
        //         }
        //     },
        // });
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.UpdateWizard.ImagePanel", {
    extend: "SYNOCOMMUNITY.RRManager.UpdateWizard.Utils.Step",
    helper: SYNOCOMMUNITY.RRManager.UpdateWizard.Helper,
    constructor: function (a) {
        this.callParent([this.fillConfig(a)]);
    },
    fillConfig: function (a) {
        this.formPanel = new SYNOCOMMUNITY.RRManager.UpdateWizard.NewImagePanel({
            appWin: a.appWin,
            owner: a.owner,
            imageType: a.imageType,
            pollingWindow: a.pollingWindow,
            records: a.records,
            nextId: a.nextId,
        });
        var b = {
            headline: this.helper.T("vm", "specify_image_spec"),
            layout: "fit",
            items: [this.formPanel],
            listeners: { scope: this, activate: this.onActivate },
        };
        Ext.apply(b, a);
        return b;
    },
    checkState: function () {
        this.callParent();
        this.owner.getButton("back").hide();
    },
    onActivate: function () {
        this.formPanel.fireEvent("activate");
    },
    getValues: function () {
        return this.formPanel.getValues();
    },
    validate: function () {
        return this.formPanel.isValid();
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.UpdateWizard.StoragePanel", {
    extend: "SYNOCOMMUNITY.RRManager.UpdateWizard.Utils.Step",
    helper: SYNOCOMMUNITY.RRManager.UpdateWizard.Helper,
    selectedVolume: {},
    constructor: function (a) {
        this.callParent([this.fillConfig(a)]);
    },
    fillConfig: function (a) {
        this.store = this.createStore(a);
        this.gridPanel = this.createGridPanel(a);
        var b = {
            headline: this.helper.T("host", "select_storage_desc_new"),
            layout: "fit",
            items: [this.gridPanel],
            listeners: { scope: this, activate: this.onActivate },
        };
        Ext.apply(b, a);
        return b;
    },
    createGridPanel: function (a) {
        return new SYNO.ux.GridPanel({
            cls: "vmm-panel-no-padding",
            flex: 1,
            store: this.store,
            enableHdMenu: false,
            colModel: new Ext.grid.ColumnModel({
                defaults: { sortable: true, width: 120 },
                columns: [
                    { header: this.helper.T("common", "host"), dataIndex: "host_name" },
                    {
                        header: this.helper.T("volume", "volume"),
                        dataIndex: "volume_path",
                        renderer: SYNO.SDS.Utils.StorageUtils.VolumeNameRenderer,
                    },
                    {
                        header: this.helper.T("common", "total_space"),
                        dataIndex: "size",
                        renderer: this.helper.diskSizeRenderer,
                    },
                    {
                        header: this.helper.T("common", "free_space"),
                        dataIndex: "free_size",
                        renderer: this.helper.diskSizeRenderer,
                    },
                ],
            }),
            selModel: new Ext.grid.RowSelectionModel({ singleSelect: true }),
            viewConfig: { trackResetOnLoad: false },
        });
    },
    createStore: function (a) {
        return new SYNO.API.JsonStore({
            api: "SYNO.Virtualization.Repo",
            method: "list_avail_volume",
            version: 1,
            appWindow: a.owner,
            autoDestroy: true,
            root: "volumes",
            fields: [
                { name: "host_name" },
                { name: "host_id" },
                { name: "volume_path" },
                { name: "size" },
                { name: "free_size" },
            ],
            sortInfo: { field: "host_name", direction: "ASC" },
            listeners: {
                scope: this,
                exception: this.onStoreException,
                beforeload: this.onStoreBeforeLoad,
                load: this.onStoreLoad,
            },
        });
    },
    getSelection: function () {
        return this.gridPanel.getSelectionModel().getSelected();
    },
    saveSelectedVolume: function () {
        var a = this.getSelection();
        if (!a) {
            this.selectedVolume = {};
            return;
        }
        this.selectedVolume = this.getValues();
    },
    onStoreException: function () {
        this.helper.unmask(this.owner);
        this.helper.mask(
            this.gridPanel,
            this.helper.T("error", "cluster_not_ready")
        );
        this.owner.getButton("next").disable();
    },
    onStoreBeforeLoad: function (a, b) {
        this.saveSelectedVolume();
    },
    onStoreLoad: function (b) {
        this.helper.unmask(this.owner);
        if (0 !== b.getTotalCount()) {
            this.helper.unmask(this.owner);
            if (
                !this.selectedVolume.hasOwnProperty("host_id") ||
                !this.selectedVolume.hasOwnProperty("volume_path")
            ) {
                return;
            }
            var a = b.findBy(
                function (c) {
                    return (
                        c.get("host_id") === this.selectedVolume.host_id &&
                        c.get("volume_path") === this.selectedVolume.volume_path
                    );
                }.createDelegate(this)
            );
            if (a !== -1) {
                this.gridPanel.getSelectionModel().selectRow(a);
            }
            this.owner.getButton("next").enable();
        } else {
            this.helper.mask(
                this.gridPanel,
                this.helper.T("storage", "no_available_storage")
            );
            this.owner.getButton("next").disable();
        }
    },
    onActivate: function () {
      //  this.helper.unmask(this.gridPanel);
      // this.helper.maskLoading(this.owner);
       // this.store.load();
       this.owner.getButton("next").enable();
    },
    validate: function () {
        // var a = this.getSelection();
        // if (!a) {
        //     this.owner
        //         .getMsgBox()
        //         .alert("alert", this.helper.T("error", "no_storage_error"));
        //     return false;
        // }
        return true;
    },
    getValues: function () {
        return {
            host_id: this.getSelection().get("host_id"),
            volume_path: this.getSelection().get("volume_path"),
        };
    },
    getNext: function () {
        if (!this.validate()) {
            return false;
        }
        this.saveSelectedVolume();
        this.owner.goNext(this.nextId);
        return false;
    },
});

Ext.define("SYNOCOMMUNITY.RRManager.UpdateWizard.Wizard", {
    extend: "SYNOCOMMUNITY.RRManager.UpdateWizard.Utils.Wizard",
    helper: SYNOCOMMUNITY.RRManager.UpdateWizard.Helper,
    constructor: function (a) {
        this.callParent([this.fillConfig(a)]);
    },
    fillConfig: function (a) {
        var b = {
            cls: "vm-create-wizard",
            steps: [
                new SYNOCOMMUNITY.RRManager.UpdateWizard.ImagePanel({
                    appWin: this,
                    owner: this,
                    imageType: a.imageType,
                    pollingWindow: a.pollingWindow,
                    records: a.records,
                    itemId: "image",
                    nextId: "storage",
                }),
                new SYNOCOMMUNITY.RRManager.UpdateWizard.StoragePanel({
                    appWin: this,
                    owner: this,
                    itemId: "storage",
                    nextId: null,
                }),
            ],
        };
        Ext.apply(b, a);
        return b;
    },
    onOpen: function () {
        this.helper.maskLoading(this);
        // this.sendWebAPI({
        //     api: "SYNO.Virtualization.Repo",
        //     method: "list",
        //     version: 2,
        //     scope: this,
        //     callback: function (f, d, e, b) {
        //         if (!f) {
        //             this.getMsgBox().alert(
        //                 "alert",
        //                 this.helper.getError(d.code),
        //                 function () {
        //                     this.close();
        //                 },
        //                 this
        //             );
        //             return;
        //         }
        //         var a = false;
        //         d.repos.every(function (g) {
        //             if ("healthy" === g.status_type || "warning" === g.status_type) {
        //                 a = true;
        //                 return false;
        //             }
        //             return true;
        //         });
        //         if (!a) {
        //             var c = this.helper.createLinkText(
        //                 this.helper.T("common", "here_to_go")
        //             );
        //             this.getMsgBox().alert(
        //                 "alert",
        //                 String.format(
        //                     "{0} ({1})",
        //                     this.helper.T("error", "no_available_storage"),
        //                     c.linkText
        //                 ),
        //                 function () {
        //                     this.close();
        //                 },
        //                 this
        //             );
        //             Ext.get(c.id).on(
        //                 {
        //                     click: function () {
        //                         this.owner.selectPage("SYNO.SDS.Virtualization.Storage.Panel");
        //                         this.close();
        //                     }.createDelegate(this),
        //                 },
        //                 this
        //             );
        //             return;
        //         }
                this.helper.unmask(this);
        //     },
        // });
        this.callParent(arguments);
    },
});
