Ext.define("TSMilestoneTraceability", {
    extend: 'Rally.app.App',
    componentCls: 'app',
    logger: new Rally.technicalservices.Logger(),
    defaults: { margin: 10 },
    items: [
        {xtype:'container',layout:'hbox',width: 900, padding: 15, items:[
            {xtype:'container',itemId:'selector_box'},
            {xtype:'container',flex:1},
            {xtype:'container',itemId:'print_box'}
        ]},
        {xtype:'container',itemId:'display_box',width:900}
    ],

    launch: function() {
        var timeboxScope = this.getContext().getTimeboxScope();

        this._addPrintButton(this.down('#print_box'));
        if ( !timeboxScope || timeboxScope.type != "milestone" ) {
            this._addSelectors(this.down('#selector_box'));
            return;
        }
        this._updateData(timeboxScope);
    },

    onTimeboxScopeChange: function(timebox) {
        this.down('#display_box').removeAll();
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

    _addSelectors: function(container) {
        container.add({
            xtype: 'rallymilestonecombobox',
            listeners: {
                scope: this,
                change: this._updateData
            }
        });
    },

    _updateData: function(timebox_selector) {
        var display_box = this.down('#display_box'),
            me = this,
            timebox = timebox_selector.getRecord();

        this.setLoading('Loading items related to ' + timebox.get('_refObjectName'));
        display_box.removeAll();

        Deft.Chain.sequence([
            function() { return me._loadAssociatedStories(timebox); },
            function() { return me._loadAssociatedChildDefects(timebox); },
            function() { return me._loadAssociatedChildTestCases(timebox); },
            function() { return me._loadAssociatedChildTasks(timebox); },
        ],this).then({
            success: function(results) {
                var stories = results[0],
                    defects_by_parent = results[1],
                    testcases_by_parent = results[2]
                    tasks_by_parent = results[3];

                if ( stories.length === 0 ) {
                    display_box.add({xtype:'container',html:''})
                }
                Ext.Array.each(stories, function(story){
                    var oid = story.get('ObjectID');
                    story.set('__defects', defects_by_parent[oid] || []);
                    story.set('__testcases',testcases_by_parent[oid] || []);
                    story.set('__tasks',tasks_by_parent[oid] || []);
                });

                display_box.add({
                    xtype:'tstraceabilitycontainer',
                    artifacts: stories
                });
            },
            failure: function(msg) {
                Ext.Msg.alert('Problem Loading Data', msg);
            },
            scope: this
        }).always(function() { me.setLoading(false); });
    },

    _loadAssociatedStories: function(timebox) {
        var config = {
            model: 'HierarchicalRequirement',
            fetch: ['ObjectID','Name','FormattedID','ScheduleState','PlanEstimate','PortfolioItem'],
            filters: [{property:'Milestones',operator:'contains',value:timebox.get('_ref')}],
            limit: Infinity,
            pageSize: 2000
        };

        return this._loadWsapiRecords(config);
    },

    _loadAssociatedChildDefects: function(timebox){
        var deferred = Ext.create('Deft.Deferred');
        var parent_field = "Requirement";
        var config = {
            model: 'Defect',
            fetch: ['ObjectID','Name','FormattedID','State','PlanEstimate',parent_field],
            filters: [{property:parent_field + '.Milestones',operator:'contains',value:timebox.get('_ref')}],
            limit: Infinity,
            pageSize: 2000
        };

        this._loadWsapiRecords(config).then({
            success: function(results) {
                var items_by_parent_oid = {};
                Ext.Array.each(results, function(result) {
                    var parent_oid = result.get(parent_field).ObjectID;
                    if ( Ext.isEmpty(items_by_parent_oid[parent_oid]) ) {
                        items_by_parent_oid[parent_oid] = [];
                    }
                    items_by_parent_oid[parent_oid].push(result);
                });
                deferred.resolve(items_by_parent_oid);
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });

        return deferred.promise;
    },

    _loadAssociatedChildTestCases: function(timebox){
        var deferred = Ext.create('Deft.Deferred');
        var parent_field = "WorkProduct";
        var config = {
            model: 'TestCase',
            fetch: ['ObjectID','Name','FormattedID','LastVerdict',parent_field],
            filters: [{property:parent_field + '.Milestones',operator:'contains',value:timebox.get('_ref')}],
            limit: Infinity,
            pageSize: 2000
        };

        this._loadWsapiRecords(config).then({
            success: function(results) {
                var items_by_parent_oid = {};
                Ext.Array.each(results, function(result) {
                    var parent = result.get(parent_field);
                    if ( !parent ) { return; }
                    var parent_oid = parent.ObjectID;
                    if ( Ext.isEmpty(items_by_parent_oid[parent_oid]) ) {
                        items_by_parent_oid[parent_oid] = [];
                    }
                    items_by_parent_oid[parent_oid].push(result);
                });
                deferred.resolve(items_by_parent_oid);
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });
        return deferred.promise;
    },

    _loadAssociatedChildTasks: function(timebox){
        var deferred = Ext.create('Deft.Deferred');
        var parent_field = "WorkProduct";
        var config = {
            model: 'Task',
            fetch: ['ObjectID','Name','FormattedID','State',parent_field],
            filters: [{property:parent_field + '.Milestones',operator:'contains',value:timebox.get('_ref')}],
            limit: Infinity,
            pageSize: 2000
        };

        this._loadWsapiRecords(config).then({
            success: function(results) {
                var items_by_parent_oid = {};
                Ext.Array.each(results, function(result) {
                    var parent = result.get(parent_field);
                    if ( !parent ) { return; }
                    var parent_oid = parent.ObjectID;
                    if ( Ext.isEmpty(items_by_parent_oid[parent_oid]) ) {
                        items_by_parent_oid[parent_oid] = [];
                    }
                    items_by_parent_oid[parent_oid].push(result);
                });
                deferred.resolve(items_by_parent_oid);
            },
            failure: function(msg) { deferred.reject(msg); },
            scope: this
        });
        return deferred.promise;
    },

    _loadWsapiRecords: function(config){
        var deferred = Ext.create('Deft.Deferred');
        var me = this;
        var default_config = {
            model: 'Defect',
            fetch: ['ObjectID']
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

    _printPage: function() {
        this.logger.log('print');
        var win = Ext.create('CArABU.utils.PrintWindow',{
            printContainer: this.down('#display_box'),
            currentDocument: Ext.getDoc(),
            title: 'Print Milestone Trace'
        });

        this.logger.log('after win');
        win.show();
        this.logger.log('after show');
        win.print();
        this.logger.log('after print');
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
