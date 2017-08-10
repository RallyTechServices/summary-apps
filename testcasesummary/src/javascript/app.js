Ext.define("TSTestCaseSummary", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    integrationHeaders : {
        name : "TSTestCaseSummary"
    },

    items: [
        {xtype:'container',itemId:'selector_box'},
        {xtype:'container',itemId:'display_box'}
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

        if ( !timeboxScope || ( timeboxScope.type != "milestone" )) {
            this.timebox_type = this.getSetting('timeboxType') || 'milestone';
            this._addSelectors(this.down('#selector_box'), this.timebox_type);
            return;
        }
        this._updateData(timeboxScope);
    },

    onTimeboxScopeChange: function(timebox) {
        this.down('#display_box').removeAll();
        this._updateData(timebox);
    },

    _addSelectors: function(container,timebox_type) {
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

    _updateData: function(timebox_selector){
        var me = this,
            timebox = timebox_selector.getRecord();

        if ( timebox && timebox.get('_type') ) {
            this.timebox_type = timebox.get('_type');
        }
        this.logger.log('Timebox: ', timebox.get('_refObjectName'));
        this.down('#display_box').removeAll();

        this.setLoading('Fetching records...');

        Deft.Chain.pipeline([
            function() { return me._makeTestCaseStore(timebox); },
            me._buildGroupedGrid
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

    _makeTestCaseStore: function(timebox) {
        var config = {
            model: 'TestCase',
            fetch: this.testCaseFetch,
            filters: this._getTestCaseFilters(timebox),
            pageSize:2000,
            limit: 2000,
            compact: false,
            groupField: 'Type',
            getGroupString: function(record) {
                return record.get('Type') + ' : ' + record.get('Method');
            }
        };

        return this._loadAStoreWithAPromise(config);
    },

    _getTestCaseFilters: function(timebox) {
        if ( this.timebox_type == "release" ) {
            // TODO: This doesn't work.  Use Kristy's method to get releases
            return Rally.data.wsapi.Filter.or([
                {property:"WorkProduct.Release.Name", value:timebox.get('_refObjectName')},
                {property:"TestSets.Release.Name",value:timebox.get('_refObjectName')}
            ]);
        } else {
            // milestone
            return [{property:"Workproduct.Milestones",operator:'contains',value:timebox.get('_ref')}];
        }

    },

    _getArtifactFilters: function(timebox) {
        var property = "Release.Name";
        if ( this.timebox_type == "milestone" ) { property = "Milestones.Name"; }
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
        this.logger.log("Starting load:",config.models);
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

    _buildGroupedGrid: function(store){
        var container = this.down('#display_box');
        container.removeAll();

        this.logger.log('_buildGroupedGrid', store);

        if (store && store.totalCount > 2000){
            Rally.ui.notify.Notifier.showWarning({
                message: Ext.String.format("{0} Test Cases were found, but only 2000 are shown.", store.totalCount)
            });
        }

        container.add({
            xtype: 'rallygrid',
            store: store,
            itemId: 'grouped-grid',
            margin: 10,
            pageSize: 2000,
            columnCfgs: this._getColumnCfgs(),
            showPagingToolbar: false,
            features: [{ftype:'grouping'}],
        });
    },

    _getColumnCfgs: function(){

        return [{
            dataIndex: 'FormattedID',
            text: 'ID',
            flex: 1
        },{
            dataIndex: 'Name',
            text: 'Test Case',
            flex: 2
        },{
            dataIndex: 'LastRun',
            text: 'Last Tested',
            flex: 1
        },{
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
            enablePostGet: true
        };
        this.logger.log("Starting load:",config.model);
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

    getOptions: function() {
        return [
            {
                text: 'About...',
                handler: this._launchInfo,
                scope: this
            }
        ];
    },

    _launchInfo: function() {
        if ( this.about_dialog ) { this.about_dialog.destroy(); }
        this.about_dialog = Ext.create('Rally.technicalservices.InfoLink',{});
    },

    isExternal: function(){
        return typeof(this.getAppId()) == 'undefined';
    }

});
