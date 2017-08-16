Ext.define("TSTestCaseSummary", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    integrationHeaders : {
        name : "TSTestCaseSummary"
    },

    items: [
        {xtype:'container', layout: 'hbox', items: [
            {xtype: 'container', itemId:'selector_box'},
            {xtype: 'container', tpl: new CArABU.technicalservices.ProgressBarTemplate({}), itemId: 'summary_box', margin: '0 100 0 100', flex: 1 },
            {xtype:'container',itemId:'print_box'}
        ]},
        {xtype:'container',itemId:'advanced_filter_box'},
        {xtype:'container',itemId:'display_box', width:900}
    ],

    artifactModels: ['Defect', 'UserStory','TestSet'],
    artifactFetch: ['ObjectID','Project','FormattedID','Name'],
    testCaseFetch: ['FormattedID','Name','LastVerdict','ObjectID','WorkProduct','Owner',
        'LastRun','FirstName','LastName','TestSets:summary[FormattedID]','Method','LastBuild',
        'Project','Type','Method'],

    config: {
        defaultSettings: {
          timeboxType: 'milestone'
        }
    },

    launch: function() {
        var timeboxScope = this.getContext().getTimeboxScope();

        this._addPrintButton(this.down('#print_box'));
        this._addFilter(this.down('#selector_box'));

        if ( timeboxScope && ( timeboxScope.type != "milestone" && timeboxScope.type != "release" )) {
            Ext.Msg.alert("","This app is not designed to work on pages of type " + timeboxScope.type);
            return;
        }

        if ( !timeboxScope || ( timeboxScope.type != "milestone" && timeboxScope.type != "release" )) {
            this.timebox_type = this.getSetting('timeboxType') || 'milestone';
            this._addTimeboxSelector(this.down('#selector_box'), this.timebox_type );
            return;
        }
        this._updateData(timeboxScope);
    },

    onTimeboxScopeChange: function(timebox) {
        this.down('#display_box').removeAll();
        this.down('#summary_box').update({casesRun: 0, totalCases: 0});
        this._updateData(timebox);
    },

    _addPrintButton: function(container) {
        container.add({
            xtype:'rallybutton',
            iconCls: 'icon-print',
            cls: 'secondary rly-small',
            margin: '10 5 10 5',
            listeners: {
                click: this._printPage,
                scope: this
            }
        });
    },

    _addTimeboxSelector: function(container,timebox_type) {
        if ( timebox_type == "milestone" ) {
            container.add({
                xtype: 'rallymilestonecombobox',
                listeners: {
                    scope: this,
                    change: this._updateData
                }
            });
        } else if ( timebox_type == "release" ) {
            container.add({
                xtype: 'rallyreleasecombobox',
                listeners: {
                    scope: this,
                    change: this._updateData
                }
            });
        }
    },

    _addFilter: function(container) {
        container.add({
            xtype: 'rallyinlinefilterbutton',
            modelNames: ['TestCase'],
            context: this.getContext(),
            listeners: {
                inlinefilterready: this._addInlineFilterPanel,
                inlinefilterchange: this._updateFilters,
                scope: this
            }
        });
    },

    _addInlineFilterPanel: function(panel) {
        this.down('#advanced_filter_box').add(panel);
    },

    _updateFilters: function(filter) {
        this.logger.log('updateFilters',filter);
        if ( this.lastTimebox ) {
            this._updateData(this.lastTimebox);
        }
    },

    _updateData: function(timebox_selector){
        var me = this,
            timebox = timebox_selector.getRecord();
        this.lastTimebox = timebox_selector;

        if ( timebox && timebox.get('_type') ) {
            this.timebox_type = timebox.get('_type');
        }
        this.logger.log('Timebox: ', timebox.get('_refObjectName'));
        this.down('#display_box').removeAll();

        this.setLoading('Fetching records...');

        Deft.Chain.pipeline([
            function() { return me._fetchTestCases(timebox); },
            me._updateDisplay
        ],this).then({
            success: function(results) {
                //this.logger.log('results:', results);
            },
            failure: function(msg) {
                Ext.Msg.alert("Problem loading records", msg);
            },
            scope: this
        }).always(function() { me.setLoading(false); });
    },

    _fetchArtifacts: function(timebox) {
        var config = {
            models: this.artifactModels,
            fetch: this.artifactFetch,
            filters: this._getArtifactFilters(timebox)
        };
        return this._loadArtifactRecords(config);
    },

    _fetchTestCases: function(timebox) {
        var me = this,
            deferred = Ext.create('Deft.Deferred');

        this.logger.log("_fetchTestCases");
        // getting the filter is a promise because with Releases, we have to go
        // get the associated items to define the filter

        // this is pipeline so that it's ok that the milestone filter is not
        // coming off a promise
        Deft.Chain.pipeline([
            function() { return me._getTestCaseFilters(timebox); }
        ],this).then({
            scope: this,
            success: function(filters) {
                this.logger.log("Filters:", filters);
                if ( Ext.isEmpty(filters) ) {
                    console.log("No filters!");
                    return;
                }
                var config = {
                    model: 'TestCase',
                    fetch: this.testCaseFetch,
                    filters: filters,
                    pageSize:2000,
                    limit: 2000,
                    compact: false,
                    groupField: 'Type',
                    getGroupString: function(record) {
                        return record.get('Type') + ' : ' + record.get('Method');
                    }
                };
                this._loadWsapiRecords(config).then({
                    success: function(results) { deferred.resolve(results); },
                    failure: function(msg) { deferred.reject(msg); }
                });
            },
            failure: function(msg) {
                deferred.reject(msg);
            }
        });
        return deferred.promise;
    },

    _getTestCaseFilters: function(timebox) {
        var deferred = Ext.create('Deft.Deferred'),
            filters = null;

        var filterButton = this.down('rallyinlinefilterbutton');
        if (filterButton && filterButton.inlineFilterPanel && filterButton.getWsapiFilter()){
            filters = filterButton.getWsapiFilter();
        }

        if ( this.timebox_type == "release" ) {
            var config = {
                models: ['UserStory','Defect'],
                filters: this._getArtifactFilters(timebox),
                fetch: ['ObjectID']
            };
            this._loadArtifactRecords(config).then({
                success: function(artifacts) {
                    var oids = Ext.Array.map(artifacts, function(artifact){
                        return {property:'WorkProduct.ObjectID', value:artifact.get('ObjectID')};
                    });
                    var release_filter = Rally.data.wsapi.Filter.or(oids);
                    if ( filters ) {
                        deferred.resolve(filters.and(release_filter));
                    }
                    deferred.resolve(release_filter);
                },
                failure: function(msg) { deferred.reject(msg); }
            });
        } else {
            // milestone
            var milestone_filter = Rally.data.wsapi.Filter.and([
                {property:"Workproduct.Milestones",operator:'contains',value:timebox.get('_ref')}
            ]);
            if ( filters ) { return filters.and(milestone_filter); }
            return milestone_filter;
        }
        return deferred.promise;
    },

    _getArtifactFilters: function(timebox) {
        var property = "Release.Name";
        return [{property:property,value:timebox.get('_refObjectName')}];
    },

    _loadArtifactRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            models: [],
            fetch: ['ObjectID'],
            enablePostGet: true
        };
        this.logger.log("Starting artifact load:",config.models);
        Ext.create('Rally.data.wsapi.artifact.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _updateSummary: function(testcases) {
        var cases_run = _.filter(testcases, function(tc){ return tc.get('LastVerdict');});
        this.down('#summary_box').update({casesRun: cases_run.length, totalCases: testcases.length });
    },

    _updateDisplay: function(testcases){
        var container = this.down('#display_box');
        container.removeAll();
        this._updateSummary(testcases);

        var store = Ext.create('Rally.data.custom.Store',{
            data: testcases,
            groupField: 'Type',
            getGroupString: function(record) {
                return record.get('Type') + ' : ' + record.get('Method');
            }
        });

        container.add({
            xtype: 'rallygrid',
            store: store,
            itemId: 'grouped-grid',
            margin: 10,
            pageSize: 2000,
            columnCfgs: this._getColumnCfgs(),
            showPagingToolbar: false,
            //features: [{ftype:'grouping'}],
            features: [{
                id: 'group',
                ftype:'groupingsummary',
                groupHeaderTpl: '{name}',
                hideGroupedHeader: true,
                enableGroupingMenu: false
            }]
        });
    },

    _getColumnCfgs: function(){

        return [{
            dataIndex: 'FormattedID',
            text: 'ID',
            flex: 1,
            renderer: function(value,meta,record) {
                return Ext.String.format('<a target="_top" href="{0}">{1}</a>',
                    Rally.nav.Manager.getDetailUrl(record),
                    value
                );
            },
            summaryType: 'count',
            summaryRenderer: function(value){
                return Ext.String.format('{0} Test Cases', value);
        }},{
            dataIndex: 'Name',
            text: 'Test Case',
            flex: 2
        },{
            dataIndex: 'LastRun',
            text: 'Last Tested',
            flex: 1
        },{
            dataIndex: 'WorkProduct',
            text: 'Work Product',
            flex: 1,
            renderer: function(value,meta,record){
                if ( Ext.isEmpty(value) ) { return ""; };
                return Ext.String.format('<a target="_top" href="{0}">{1} - {2}</a>',
                    Rally.nav.Manager.getDetailUrl(value),
                    value.FormattedID,
                    value._refObjectName
                );
            }
        },
        {
            dataIndex: 'LastVerdict',
            text: 'Last Verdict',
            flex: 1
        },{
            dataIndex: 'Owner',
            text: 'Owner',
            renderer: function(v,m,r){
                return (v && (v.FirstName || '') + ' ' + (v.LastName || '')) || '(No Owner)';
            },
            flex: 1
        }];
    },

    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID'],
            enablePostGet: true
        };
        this.logger.log("Starting load:",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(records);
                } else {
                    me.logger.log("Failed: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _loadAStoreWithAPromise: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID'],
            enablePostGet: true,
            autoLoad: false
        };
        this.logger.log("Creating store for :",config.model);
        Ext.create('Rally.data.wsapi.Store', Ext.Object.merge(default_config,config)).load({
            callback : function(records, operation, successful) {
                if (successful){
                    deferred.resolve(this);
                } else {
                    me.logger.log("Failed to load store: ", operation);
                    deferred.reject('Problem loading: ' + operation.error.errors.join('. '));
                }
            }
        });
        return deferred.promise;
    },

    _printPage: function() {
        var win = Ext.create('CArABU.utils.PrintWindow',{
            printContainer: this.down('#display_box'),
            currentDocument: Ext.getDoc(),
            title: 'Print TestCase Summary'
        });

        win.show();
        win.print();
    },

    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },

    getSettingsFields: function() {

        var timebox_store = Ext.create('Ext.data.Store',{
            fields: ['name','value'],
            data: [
                {name:'Release',value:'release'},
                {name:'Milestone',value:'milestone'}
            ]
        });

        return [{
            name: 'timeboxType',
            xtype: 'combobox',
            fieldLabel: 'Timebox Type',
            queryMode: 'local',
            displayField: 'name',
            valueField: 'value',
            store: timebox_store

        }];
    },

    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }
});
